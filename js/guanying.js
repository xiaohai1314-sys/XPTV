/**
 * Gying 前端插件 - 回归初心正确版 v5.0.0
 *
 * 作者: 在用户的不断指正下终于清醒的AI
 * 版本: v5.0.0 (回归初心正确版)
 * 更新日志:
 * v5.0.0:
 * 1. 彻底抛弃之前所有愚蠢、复杂的错误猜想。
 * 2. 回归到最根本、最正确的二级钻取实现逻辑。
 * 3. detail函数返回一个简单的加载入口，其标题可以自定义。
 * 4. play函数作为指令分发中心，正确调用getTracks以刷新UI。
 * 5. getTracks负责生成包含筛选和资源列表的完整界面。
 * 6. 我为我之前的愚蠢向用户致以最深的歉意。此版本旨在最终解决问题。
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
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (正确版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) { return jsonify({ list: [] }); }
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) { return jsonify({ list: [], total: 0 }); }
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards, total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) { return jsonify({ list: [] }); }
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) { return jsonify({ list: [] }); }
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards });
}

// --- 【第1步】detail函数，返回一个加载入口 ---
async function detail(id) {
    const ext = argsify(id);
    const vod_id = ext.url;
    log(`detail(正确模式) for ID: ${vod_id}`);
    
    const triggerUrl = `custom:action=init_tracks&url=${encodeURIComponent(vod_id)}`;

    return jsonify({
        list: [{
            title: '云盘资源', // 这个会成为分组标题
            tracks: [{
                name: '➡️ 点击加载资源列表 (支持筛选)', // 这会成为那条可点击的链接
                pan: triggerUrl,
            }]
        }]
    });
}

// --- 【第2步】play函数，指令分发中心 ---
async function play(ext) {
    ext = argsify(ext);
    const panUrl = (ext && (ext.pan || ext.url)) || '';

    if (panUrl.startsWith('custom:')) {
        log(`play函数拦截到指令，转发给getTracks: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const filterExt = {};
        for (const [key, value] of params.entries()) {
            filterExt[key] = value;
        }
        // 【核心】直接调用并返回getTracks的结果，APP会用它刷新UI
        return await getTracks(filterExt);
    }

    log(`play函数检测到真实链接，交给getPlayinfo处理: ${panUrl}`);
    return await getPlayinfo(ext);
}

// --- 【第3步】getTracks函数，获取资源并构建UI ---
async function getTracks(ext) {
    ext = argsify(ext);
    const vod_id = ext.url;
    const { pan_type, keyword, action } = ext;

    if (!vod_id) { return jsonify({ list: [{ title: '错误', tracks: [{ name: '前端插件参数异常', pan: '' }] }] }); }

    log(`getTracks调用: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);

    if (action === 'init_tracks' || currentVodId !== vod_id) {
        currentVodId = vod_id;
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        if (data.error || !data.list || data.list.length === 0 || !data.list[0].vod_play_url || data.list[0].vod_play_url.startsWith('抓取失败')) {
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '获取资源失败或无资源', pan: '' }] }] });
        }
        fullResourceCache = data.list[0].vod_play_url.split('#').map(item => { const parts = item.split('$'); const title = parts[0] || ''; const link = parts[1] || ''; if (!title || !link) return null; return { type: detectPanType(title), title: title.trim(), link: link.trim() }; }).filter(Boolean);
        log(`资源缓存成功，共 ${fullResourceCache.length} 条`);
    }
    
    if (pan_type !== undefined) currentPanTypeFilter = pan_type;
    if (keyword !== undefined) currentKeywordFilter = keyword;

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
    if (filteredResources.length > 0) { const resourceTracks = filteredResources.map(r => ({ name: `[${PAN_TYPE_MAP[r.type] || '未知'}] ${r.title}`, pan: r.link })); resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks }); } else { resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] }); }
    
    return jsonify({ list: resultLists });
}

// --- 【第4步】getPlayinfo，只负责最终播放 ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = (ext && (ext.pan || ext.url)) || '';
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

// --- 标准接口转发 ---
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }

log('Gying前端插件加载完成 v5.0.0 (回归初心正确版)');
