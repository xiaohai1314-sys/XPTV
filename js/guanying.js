/**
 * Gying 前端插件 - v2.1 最终正确版
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v2.1
 * 更新日志:
 * v2.1: 终极版。修复了 v2.0 中 play 函数调用链中断的致命错误。
 * 1. detail 函数现在返回一个调用 play 函数的指令。
 * 2. play 函数现在是所有二级钻取操作的总指挥，负责请求数据和调用 getTracks 刷新UI。
 * 3. getTracks 函数回归纯粹的UI构建角色。
 * 4. 这次，它真的可以了。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (与之前版本完全相同) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) {} }
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

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) return jsonify({ list: [] });
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) return jsonify({ list: [] });
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { vod_id: item.vod_id } }));
    return jsonify({ list: cards, total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) return jsonify({ list: [] });
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) return jsonify({ list: [] });
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { vod_id: item.vod_id } }));
    return jsonify({ list: cards });
}

// --- 【第1步: detail函数返回一个调用play的指令】 ---
async function detail(ext) {
    ext = argsify(ext);
    const vod_id = ext.vod_id;
    log(`进入详情页，准备加载按钮，ID: ${vod_id}`);
    
    // 【关键修正】这个按钮的指令是调用 play 函数，并告诉它这是初始化操作
    const triggerUrl = `custom:action=init&vod_id=${encodeURIComponent(vod_id)}`;

    return jsonify({
        list: [{
            title: '在线播放',
            tracks: [{
                name: '➡️ 点击加载资源列表 (支持筛选)',
                pan: triggerUrl,
            }]
        }]
    });
}

// --- 【第2步: getTracks只负责构建UI】 ---
function buildTracksUI(vod_id) {
    log(`buildTracksUI刷新UI: vod_id=${vod_id}`);
    
    let filteredResources = [...fullResourceCache];
    if (currentPanTypeFilter !== 'all') { filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter); }
    if (currentKeywordFilter !== 'all') {
        const lowerKeyword = currentKeywordFilter.toLowerCase();
        if (lowerKeyword === '其他') { filteredResources = filteredResources.filter(r => !KEYWORD_FILTERS.slice(0, -1).some(kw => r.title.toLowerCase().includes(kw.toLowerCase()))); } 
        else { filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword)); }
    }
    
    const resultLists = [];
    const panTypeCounts = {};
    fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
    
    const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all&vod_id=${encodeURIComponent(vod_id)}` }];
    Object.keys(panTypeCounts).forEach(typeCode => { panTypeButtons.push({ name: `${PAN_TYPE_MAP[typeCode] || `类型${typeCode}`} (${panTypeCounts[typeCode]})`, pan: `custom:action=filter&pan_type=${typeCode}&vod_id=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🗂️ 网盘分类', tracks: panTypeButtons });
    
    const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all&vod_id=${encodeURIComponent(vod_id)}` }];
    KEYWORD_FILTERS.forEach(kw => { keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}&vod_id=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🔍 关键字筛选', tracks: keywordButtons });
    
    if (filteredResources.length > 0) {
        const resourceTracks = filteredResources.map(r => ({ name: `[${PAN_TYPE_MAP[r.type]}] ${r.title}`, pan: r.link }));
        resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks });
    } else {
        resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] });
    }
    
    // 【关键修正】让播放器用新的UI来刷新界面
    if (typeof $ui === 'object' && typeof $ui.update === 'function') {
        $ui.update(jsonify({ list: resultLists }));
    }
}

// --- 【第3步: play函数是总指挥】 ---
async function play(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    if (panUrl.startsWith('custom:')) {
        log(`处理指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const filterExt = Object.fromEntries(params.entries());
        const { action, vod_id, pan_type, keyword } = filterExt;

        if (action === 'init') {
            log(`首次加载详情, ID: ${vod_id}`);
            currentVodId = vod_id;
            currentPanTypeFilter = 'all';
            currentKeywordFilter = 'all';
            
            const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
            const data = await request(detailUrl);

            if (data.error || !data.list || data.list.length === 0) { /* 错误处理 */ return jsonify({url:''}); }
            const playUrlString = data.list[0].vod_play_url;
            if (!playUrlString || playUrlString === '暂无任何网盘资源') { /* 错误处理 */ return jsonify({url:''}); }
            
            fullResourceCache = playUrlString.split('#').map(item => {
                const parts = item.split('$');
                if (!parts[0] || !parts[1]) return null;
                return { type: detectPanType(parts[0]), title: (parts[0] || '').trim(), link: (parts[1] || '').trim() };
            }).filter(item => item !== null);
            log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);
            
            buildTracksUI(vod_id);

        } else if (action === 'filter') {
            log(`筛选操作: pan_type=${pan_type}, keyword=${keyword}`);
            if (pan_type !== undefined) currentPanTypeFilter = pan_type;
            if (keyword !== undefined) currentKeywordFilter = keyword;
            buildTracksUI(vod_id);
        }
        
        // 告诉播放器，我们已经处理了指令，不需要播放
        return jsonify({ url: '' });
    }
    
    log(`准备播放: ${panUrl}`);
    return jsonify({ url: panUrl });
}

// --- 标准接口转发 ---
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
