/**
 * Gying 前端插件 - 终极融合版 v1.0
 *
 * 功能特性:
 * - 完美适配 XPTV App 环境，兼容手机与TV端。
 * - 与 Gying 后端代理服务（终极融合版）完美配合，支持钻取式两级筛选功能。
 * - 【已修复】调用详情接口时参数传递错误的问题，确保向后端发送正确的影片ID。
 * - 强大的错误处理和用户体验优化。
 * - 支持分类浏览、搜索、详情查看等完整功能。
 *
 * 作者: Manus (根据用户需求整合优化)
 * 版本: v1.0 (2025年最终版)
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请修改为你的后端服务实际局域网IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// 网盘类型映射
const PAN_TYPE_MAP = {
    '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里',
    '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知'
};

// 关键字筛选选项
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];

// ==================== 工具函数区 ====================
function log(msg) { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } return await response.json(); } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度') || lowerTitle.includes('baidu')) return '0'; if (lowerTitle.includes('迅雷') || lowerTitle.includes('thunder')) return '1'; if (lowerTitle.includes('夸克') || lowerTitle.includes('quark')) return '2'; if (lowerTitle.includes('阿里') || lowerTitle.includes('aliyun')) return '3'; if (lowerTitle.includes('天翼') || lowerTitle.includes('cloud.189')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }

// ==================== 缓存区 ====================
let fullResourceCache = []; let currentPanTypeFilter = 'all'; let currentKeywordFilter = 'all'; let currentVodId = '';

// ==================== XPTV App 标准接口 ====================

async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (融合版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) { return jsonify({ list: [] }); } log(`获取分类: ${id}, 页码: ${page}`); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); } return jsonify({ list: data.list || [], total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) { return jsonify({ list: [] }); } log(`搜索: ${text}`); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) { log(`搜索失败: ${data.error}`); return jsonify({ list: [] }); } return jsonify({ list: data.list || [] }); }

async function getTracks(ext) {
    ext = argsify(ext);

    // 【关键修复】从App传入的参数中，正确提取出影片的ID字符串
    let vod_id;
    if (typeof ext === 'string') { vod_id = ext; } 
    else if (ext && ext.vod_id) { vod_id = ext.vod_id; } 
    else { vod_id = ext.url || ext.id; }

    if (!vod_id || typeof vod_id !== 'string') {
        log(`无效的详情ID，收到参数: ${JSON.stringify(ext)}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无法获取有效的影片ID', pan: '' }] }] });
    }

    const { pan_type, keyword, action = 'init' } = ext;
    log(`getTracks调用: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);

    if (action === 'init' || fullResourceCache.length === 0 || currentVodId !== vod_id) {
        fullResourceCache = []; currentPanTypeFilter = 'all'; currentKeywordFilter = 'all'; currentVodId = vod_id;
        log(`首次加载详情: ${vod_id}`);
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);

        if (data.error || !data.list || data.list.length === 0) {
            log(`详情获取失败: ${data.error || '数据为空'}`);
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败，请检查后端服务', pan: '' }] }] });
        }

        const playUrlString = data.list[0].vod_play_url;
        if (!playUrlString || playUrlString === '暂无任何网盘资源') {
            log('无有效资源链接');
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
        }

        log(`开始解析资源字符串，长度: ${playUrlString.length}`);
        fullResourceCache = playUrlString.split('#').map(item => {
            const parts = item.split('$');
            const title = parts[0] || ''; const link = parts[1] || '';
            if (!title || !link) { return null; }
            return { type: detectPanType(title), title: title.trim(), link: link.trim() };
        }).filter(item => item !== null);
        log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);
    }

    if (pan_type !== undefined) { currentPanTypeFilter = pan_type; }
    if (keyword !== undefined) { currentKeywordFilter = keyword; }

    let filteredResources = [...fullResourceCache];
    if (currentPanTypeFilter !== 'all') { filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter); }
    if (currentKeywordFilter !== 'all') {
        const lowerKeyword = currentKeywordFilter.toLowerCase();
        if (lowerKeyword === '其他') {
            filteredResources = filteredResources.filter(r => KEYWORD_FILTERS.slice(0, -1).every(kw => !r.title.toLowerCase().includes(kw.toLowerCase())));
        } else {
            filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword));
        }
    }

    const resultLists = [];
    const panTypeCounts = {};
    fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
    const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all&url=${encodeURIComponent(vod_id)}` }];
    Object.keys(panTypeCounts).forEach(typeCode => { panTypeButtons.push({ name: `${PAN_TYPE_MAP[typeCode] || '未知'} (${panTypeCounts[typeCode]})`, pan: `custom:action=filter&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🗂️ 网盘分类', tracks: panTypeButtons });

    const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all&url=${encodeURIComponent(vod_id)}` }];
    KEYWORD_FILTERS.forEach(kw => { keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🔍 关键字筛选', tracks: keywordButtons });

    if (filteredResources.length > 0) {
        const resourceTracks = filteredResources.map(r => ({ name: r.title, pan: r.link }));
        resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks });
    } else {
        resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] });
    }

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

log('Gying前端插件加载完成 v1.0');

