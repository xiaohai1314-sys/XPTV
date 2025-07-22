/**
 * Gying 前端插件 - 完美复刻修正版 v1.3.0
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.3.0 (最终修复版)
 * 更新日志:
 * v1.3.0:
 * 1. 【核心修复】重构了 play 和 getPlayinfo 函数的逻辑，彻底解决了二级钻取筛选功能不生效的问题。
 * 2. play 函数现在作为指令分发中心，正确地将筛选指令转发给 getTracks 函数，并返回其结果以刷新UI。
 * 3. getPlayinfo 函数回归其本职，仅处理真实的播放链接。
 * 4. 优化了部分代码，增加了对空参数的健壮性处理。
 * 5. 这是经过问题分析后，可以直接使用的最终版本。
 * 
 * v1.2.0: 终极版。
 * 1. 严格遵循用户最初的“两步走”设计：detail函数只返回一个加载按钮，点击按钮才真正触发getTracks。
 * 2. 保留了已验证成功的、在getCards/search中构建标准ext对象的做法。
 * 3. 完整恢复了二级钻取筛选功能，并确保所有参数在流程中正确传递。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
let fullResourceCache = [];
let currentPanTypeFilter = 'all';
let currentKeywordFilter = 'all';
let currentVodId = '';

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (钻取筛选版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

// --- 【第1步: 稳定可靠的列表获取】 ---
async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); }
    log(`获取分类: ${id}, 页码: ${page}`);
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { url: item.vod_id }
    }));
    return jsonify({ list: cards, total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) { log('搜索关键词为空'); return jsonify({ list: [] }); }
    log(`搜索: ${text}`);
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) { log(`搜索失败: ${data.error}`); return jsonify({ list: [] }); }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { url: item.vod_id }
    }));
    return jsonify({ list: cards });
}

// --- 【第2步: 详情页只返回一个加载按钮】 ---
async function detail(id) {
    const ext = argsify(id);
    const vod_id = ext.url;
    log(`进入详情页，准备加载按钮，ID: ${vod_id}`);
    
    // 构建一个特殊的 "pan" 链接，用于在 play 函数中识别并触发 getTracks
    const triggerUrl = `custom:action=init&url=${encodeURIComponent(vod_id)}`;

    return jsonify({
        list: [{
            title: '资源列表',
            tracks: [{
                name: '➡️ 点击加载资源列表 (支持筛选)',
                pan: triggerUrl,
            }]
        }]
    });
}

// --- 【第3步: 资源获取与筛选逻辑】 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const vod_id = ext.url;
    const { pan_type, keyword, action = 'init' } = ext;

    if (typeof vod_id !== 'string' || vod_id.length === 0) {
        log('严重错误：getTracks未能接收到有效的url参数。');
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '前端插件参数传递异常', pan: '' }] }] });
    }

    log(`getTracks调用: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);

    if (action === 'init' || fullResourceCache.length === 0 || currentVodId !== vod_id) {
        fullResourceCache = [];
        currentPanTypeFilter = 'all';
        currentKeywordFilter = 'all';
        currentVodId = vod_id;
        log(`首次加载或切换影片, 清空缓存并重新获取, ID: ${vod_id}`);
        
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        
        const data = await request(detailUrl);
        if (data.error) { return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] }); }
        if (!data.list || data.list.length === 0) { return jsonify({ list: [{ title: '提示', tracks: [{ name: '未找到相关资源', pan: '' }] }] }); }
        const playUrlString = data.list[0].vod_play_url;
        if (!playUrlString || playUrlString === '暂无任何网盘资源') { return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] }); }
        
        fullResourceCache = playUrlString.split('#').map(item => { const parts = item.split('$'); const title = parts[0] || ''; const link = parts[1] || ''; if (!title || !link) { return null; } return { type: detectPanType(title), title: title.trim(), link: link.trim() }; }).filter(item => item !== null);
        log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);
    }
    
    if (pan_type !== undefined) { currentPanTypeFilter = pan_type; }
    if (keyword !== undefined) { currentKeywordFilter = keyword; }
    let filteredResources = [...fullResourceCache];
    if (currentPanTypeFilter !== 'all') { filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter); }
    if (currentKeywordFilter !== 'all') { const lowerKeyword = currentKeywordFilter.toLowerCase(); if (lowerKeyword === '其他') { filteredResources = filteredResources.filter(r => { const lowerTitle = r.title.toLowerCase(); return KEYWORD_FILTERS.slice(0, -1).every(kw => !lowerTitle.includes(kw.toLowerCase())); }); } else { filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword)); } }
    
    const resultLists = [];
    const panTypeCounts = {};
    fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
    const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all&url=${encodeURIComponent(vod_id)}` }];
    Object.keys(panTypeCounts).sort().forEach(typeCode => { panTypeButtons.push({ name: `${PAN_TYPE_MAP[typeCode] || `类型${typeCode}`} (${panTypeCounts[typeCode]})`, pan: `custom:action=filter&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🗂️ 网盘分类', tracks: panTypeButtons });
    const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all&url=${encodeURIComponent(vod_id)}` }];
    KEYWORD_FILTERS.forEach(kw => { keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🔍 关键字筛选', tracks: keywordButtons });
    if (filteredResources.length > 0) { const resourceTracks = filteredResources.map(r => { const panTypeName = PAN_TYPE_MAP[r.type] || '未知'; return { name: `[${panTypeName}] ${r.title}`, pan: r.link }; }); resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks }); } else { resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] }); }
    
    log(`UI构建完成: 网盘='${currentPanTypeFilter}', 关键字='${currentKeywordFilter}', 显示${filteredResources.length}/${fullResourceCache.length}条`);
    return jsonify({ list: resultLists });
}

// ==================== 【核心修复区】标准接口转发 ====================

async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }

/**
 * 【play 函数 - 指令分发中心】
 * 这是修复二级钻取的关键。它会检查被点击的链接（panUrl）。
 * - 如果是 'custom:' 开头的指令，它会解析指令并直接调用 getTracks 函数，
 *   然后返回 getTracks 生成的新列表，从而实现UI刷新（筛选）。
 * - 如果是普通的播放链接，它会把它交给 getPlayinfo 函数处理。
 */
async function play(ext) {
    ext = argsify(ext);
    const panUrl = (ext && (ext.pan || ext.url)) || '';

    if (panUrl.startsWith('custom:')) {
        log(`play函数拦截到指令，直接转发给getTracks: ${panUrl}`);
        
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const filterExt = {};
        for (const [key, value] of params.entries()) {
            filterExt[key] = value;
        }
        
        // 核心：直接调用并返回 getTracks 的结果，让APP用新列表刷新UI
        return await getTracks(filterExt); 
    }

    log(`play函数检测到真实链接，交给getPlayinfo处理: ${panUrl}`);
    return await getPlayinfo(ext);
}

/**
 * 【getPlayinfo 函数 - 最终播放处理器】
 * 这个函数现在只负责一件事：接收一个真实的播放链接，并将其包装成APP可以播放的格式。
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = (ext && (ext.pan || ext.url)) || '';
    log(`准备播放: ${panUrl}`);
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

log('Gying前端插件加载完成 v1.3.0 (最终修复版)');
