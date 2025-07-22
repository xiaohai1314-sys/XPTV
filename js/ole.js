/**
 * Gying 前端插件 - 回归初心正确版 v5.0.0
 *
 * 最终真相: APP支持弹出式菜单的二级钻取。本脚本的逻辑与此完全吻合。
 *
 * 工作流程:
 * 1. detail函数返回一个简单的加载入口（将显示为“网盘分类 v”）。
 * 2. 点击该入口，触发play函数。
 * 3. play函数调用getTracks函数。
 * 4. getTracks函数返回包含“网盘分类”、“关键字筛选”、“资源列表”的JSON。
 * 5. APP将此JSON渲染为截图所示的弹出菜单。
 * 6. 后续筛选操作将不断重复步骤2-5，实现UI刷新。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) return { error: `HTTP ${status}` }; return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
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
async function getConfig() { return jsonify({ ver: 1, title: 'Gying (筛选版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) { /* ...代码同v5.0.0... */ ext = argsify(ext); const { id, page = 1 } = ext; if (!id) { return jsonify({ list: [] }); } const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) { return jsonify({ list: [], total: 0 }); } const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { /* ...代码同v5.0.0... */ ext = argsify(ext); const { text } = ext; if (!text) { return jsonify({ list: [] }); } const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) { return jsonify({ list: [] }); } const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards }); }

// --- 【第1步】detail函数，返回一个加载入口 ---
async function detail(id) {
    const ext = argsify(id);
    const vod_id = ext.url;
    log(`detail(弹出菜单模式) for ID: ${vod_id}`);
    
    const triggerUrl = `custom:action=init_tracks&url=${encodeURIComponent(vod_id)}`;

    // 返回的这个单一列表，将被APP渲染成那个“网盘分类 v”的条目
    return jsonify({
        list: [{
            title: '云盘', // 这个是分组标题，可能会显示在弹出菜单的上方
            tracks: [{
                name: '网盘分类', // 这个会成为可点击的条目的文字
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
        return await getTracks(filterExt);
    }

    log(`play函数检测到真实链接，交给getPlayinfo处理: ${panUrl}`);
    return await getPlayinfo(ext);
}

// --- 【第3步】getTracks函数，获取资源并构建弹出菜单的UI ---
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
    
    // 【核心】构建这个JSON，来生成弹出菜单
    const resultLists = [];
    const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all&url=${encodeURIComponent(vod_id)}` }];
    Object.keys(PAN_TYPE_MAP).forEach(typeCode => {
        const count = fullResourceCache.filter(r => r.type === typeCode).length;
        if (count > 0) {
            panTypeButtons.push({ name: `${PAN_TYPE_MAP[typeCode]} (${count})`, pan: `custom:action=filter&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}` });
        }
    });
    resultLists.push({ title: '网盘分类', tracks: panTypeButtons });

    const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all&url=${encodeURIComponent(vod_id)}` }];
    KEYWORD_FILTERS.forEach(kw => { keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '关键字筛选', tracks: keywordButtons });
    
    if (filteredResources.length > 0) { const resourceTracks = filteredResources.map(r => ({ name: `[${PAN_TYPE_MAP[r.type] || '未知'}] ${r.title}`, pan: r.link })); resultLists.push({ title: `资源列表 (${filteredResources.length}条)`, tracks: resourceTracks }); } else { resultLists.push({ title: '资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] }); }
    
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
