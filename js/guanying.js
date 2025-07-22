/**
 * Gying 前端插件 - 兼容修复版 v1.2
 * 
 * --- 版本说明 ---
 * v1.2: 增强App兼容性。修复了某些App因传递的ID键名不标准（不是'id'或'url'）
 *       而导致“无法获取影片ID”的问题。现在会尝试从多个常见键名中解析ID。
 * v1.1: 修复了将整个参数对象作为ID传递给后端的bug，解决了`ids=[object Object]`问题。
 * 
 * 功能特性:
 * - 完美适配 XPTV App 环境，借鉴"网盘资源社"脚本的成功经验
 * - 与 Gying 后端服务完美配合，支持钻取式两级筛选功能
 * - 修复了前后端接口参数和数据格式不匹配的问题
 * - 强大的错误处理和用户体验优化
 * - 支持分类浏览、搜索、详情查看等完整功能
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.2 (2024年兼容修复版)
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请修改为您的后端服务实际地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// 网盘类型映射
const PAN_TYPE_MAP = {
    '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里',
    '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知'
};

// 关键字筛选选项
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];

// ==================== 工具函数区 ====================
function log(msg) { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功: 获取到 ${result.list ? result.list.length : 0} 条数据`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功: 获取到 ${result.list ? result.list.length : 0} 条数据`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const l = title.toLowerCase(); if (l.includes('百度') || l.includes('baidu')) return '0'; if (l.includes('迅雷') || l.includes('thunder')) return '1'; if (l.includes('夸克') || l.includes('quark')) return '2'; if (l.includes('阿里') || l.includes('aliyun')) return '3'; if (l.includes('天翼') || l.includes('cloud.189')) return '4'; if (l.includes('115')) return '5'; if (l.includes('uc')) return '6'; return 'unknown'; }

// ==================== 缓存区 ====================
let fullResourceCache = []; let currentPanTypeFilter = 'all'; let currentKeywordFilter = 'all'; let currentVodId = '';

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (钻取筛选版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); } log(`获取分类: ${id}, 页码: ${page}`); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); } return jsonify({ list: data.list || [], total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) { log('搜索关键词为空'); return jsonify({ list: [] }); } log(`搜索: ${text}`); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) { log(`搜索失败: ${data.error}`); return jsonify({ list: [] }); } return jsonify({ list: data.list || [] }); }

async function getTracks(ext) {
    ext = argsify(ext);

    // ==================== [v1.2 核心修复] ====================
    // 增加了对更多可能键名的兼容性检查，以适配不同的App。
    // App可能使用 'id', 'url', 'vod_id', 'vid' 等不同键名来传递影片ID。
    let vod_id;
    if (typeof ext === 'string') {
        vod_id = ext;
    } else if (ext && typeof ext === 'object') {
        // 按优先级尝试从多个常见键名中获取ID
        vod_id = ext.url || ext.id || ext.vod_id || ext.vid;
    }

    if (typeof vod_id !== 'string' || !vod_id) {
        log(`严重错误：未能解析出有效的影片ID。App传递的原始参数: ${JSON.stringify(ext)}`);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: '无法获取影片 ID, 请检查插件或 App 兼容性', pan: '' }]
            }]
        });
    }
    // ==================== [修复结束] ====================
    
    const { pan_type, keyword, action = 'init' } = ext;
    log(`getTracks调用: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);
    
    if (action === 'init' || fullResourceCache.length === 0 || currentVodId !== vod_id) {
        fullResourceCache = []; currentPanTypeFilter = 'all'; currentKeywordFilter = 'all'; currentVodId = vod_id;
        log(`首次加载或切换影片，请求详情: ${vod_id}`);
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        if (data.error) { log(`详情获取失败: ${data.error}`); return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败，请检查网络或后端服务', pan: '' }] }] }); }
        if (!data.list || data.list.length === 0) { log('详情数据为空'); return jsonify({ list: [{ title: '提示', tracks: [{ name: '未找到相关资源', pan: '' }] }] }); }
        const playUrlString = data.list[0].vod_play_url;
        if (!playUrlString || playUrlString.startsWith('抓取失败') || playUrlString === '暂无任何网盘资源') { log(`无有效资源链接或抓取失败: ${playUrlString}`); return jsonify({ list: [{ title: '提示', tracks: [{ name: playUrlString || '暂无任何网盘资源', pan: '' }] }] }); }
        log(`开始解析资源字符串，长度: ${playUrlString.length}`);
        fullResourceCache = playUrlString.split('#').map(item => { const parts = item.split('$'); const title = parts[0] || ''; const link = parts[1] || ''; if (!title || !link) { log(`跳过无效资源: ${item}`); return null; } const panType = detectPanType(title); return { type: panType, title: title.trim(), link: link.trim() }; }).filter(item => item !== null);
        log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);
    }
    
    if (pan_type !== undefined) { currentPanTypeFilter = pan_type; log(`更新网盘筛选: ${pan_type}`); }
    if (keyword !== undefined) { currentKeywordFilter = keyword; log(`更新关键字筛选: ${keyword}`); }
    
    let filteredResources = [...fullResourceCache];
    if (currentPanTypeFilter !== 'all') { filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter); }
    if (currentKeywordFilter !== 'all') { const lk = currentKeywordFilter.toLowerCase(); if (lk === '其他') { filteredResources = filteredResources.filter(r => { const lt = r.title.toLowerCase(); return KEYWORD_FILTERS.slice(0, -1).every(kw => !lt.includes(kw.toLowerCase())); }); } else { filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lk)); } }
    
    const resultLists = [];
    const panTypeCounts = {}; fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
    const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all&url=${encodeURIComponent(vod_id)}` }];
    Object.keys(panTypeCounts).forEach(typeCode => { const typeName = PAN_TYPE_MAP[typeCode] || `类型${typeCode}`; const count = panTypeCounts[typeCode]; panTypeButtons.push({ name: `${typeName} (${count})`, pan: `custom:action=filter&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🗂️ 网盘分类', tracks: panTypeButtons });
    
    const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all&url=${encodeURIComponent(vod_id)}` }];
    KEYWORD_FILTERS.forEach(kw => { keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🔍 关键字筛选', tracks: keywordButtons });
    
    if (filteredResources.length > 0) { const resourceTracks = filteredResources.map(r => { const panTypeName = PAN_TYPE_MAP[r.type] || '未知'; return { name: `[${panTypeName}] ${r.title}`, pan: r.link }; }); resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks }); } else { resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] }); }
    
    log(`UI构建完成: 网盘='${currentPanTypeFilter}', 关键字='${currentKeywordFilter}', 显示${filteredResources.length}/${fullResourceCache.length}条`);
    return jsonify({ list: resultLists });
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';
    if (panUrl.startsWith('custom:')) {
        log(`处理筛选指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const filterExt = Object.fromEntries(params.entries());
        setTimeout(() => { getTracks(filterExt); }, 100);
        return jsonify({ urls: [] });
    }
    log(`准备播放: ${panUrl}`);
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

// ==================== 兼容性接口 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.2');
