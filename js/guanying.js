/**
 * Gying 前端插件 - v1.1.2 (数据对齐最终版)
 * 
 * 作者: 在发现并修复了致命的数据结构假设错误后，编写的最终版本。
 * 版本: v1.1.2
 * 更新日志:
 * 1. 【终极修正】修正了 getTracks 中对后端返回数据的解析逻辑。现在它能正确地从 `{ "vod_play_url": "..." }` 结构中提取数据，而不是错误的 `{ "list": [...] }` 结构。
 * 2. 【数据对齐】这是解决了“后端成功，前端失败”这一最终谜题的关键。
 * 3. 【架构不变】完全保留 v1.1.1 的正确架构和参数处理逻辑。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (无变化) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v1.1.2] ${msg}`); } else { console.log(`[Gying v1.1.2] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 }); if (status !== 200) { return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
let fullResourceCache = {};
let currentPanTypeFilter = {};
let currentKeywordFilter = {};

// ==================== XPTV App 标准接口 (无变化) ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (钻取版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards }); }

// 【核心】getTracks: 修正了对后端数据的解析逻辑
async function getTracks(ext) {
    ext = argsify(ext);
    
    let vod_id;
    if (typeof ext === 'string') {
        vod_id = ext;
    } else if (typeof ext === 'object' && ext !== null) {
        vod_id = ext.url || ext.id || ext.vod_id;
    }

    if (!vod_id || typeof vod_id !== 'string') {
        return jsonify({ list: [] });
    }

    const { pan_type, keyword, action = 'init' } = ext;
    log(`getTracks调用: vod_id=${vod_id}, action=${action}`);

    if (action === 'init' || !fullResourceCache[vod_id]) {
        currentPanTypeFilter[vod_id] = 'all';
        currentKeywordFilter[vod_id] = 'all';
        
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        
        // 【终极修正】直接从 data.vod_play_url 获取数据
        const playUrlString = data ? data.vod_play_url : null;

        if (!playUrlString) {
            log(`获取资源失败或无资源: ${data ? data.error : '返回数据为空'}`);
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '获取资源失败或无资源', pan: '' }] }] });
        }
        
        fullResourceCache[vod_id] = playUrlString.split('#').map(item => {
            const parts = item.split('$');
            if (!parts[0] || !parts[1]) return null;
            return { type: detectPanType(parts[0]), title: parts[0].trim(), link: parts[1].trim() };
        }).filter(Boolean);
        log(`资源解析完成，共 ${fullResourceCache[vod_id].length} 条有效资源`);
    }

    if (pan_type !== undefined) { currentPanTypeFilter[vod_id] = pan_type; }
    if (keyword !== undefined) { currentKeywordFilter[vod_id] = keyword; }

    let filteredResources = [...fullResourceCache[vod_id]];
    if (currentPanTypeFilter[vod_id] !== 'all') { filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter[vod_id]); }
    if (currentKeywordFilter[vod_id] !== 'all') { const lowerKeyword = currentKeywordFilter[vod_id].toLowerCase(); if (lowerKeyword === '其他') { filteredResources = filteredResources.filter(r => { const lowerTitle = r.title.toLowerCase(); return KEYWORD_FILTERS.slice(0, -1).every(kw => !lowerTitle.includes(kw.toLowerCase())); }); } else { filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword)); } }
    
    const resultLists = [];
    const panTypeCounts = fullResourceCache[vod_id].reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
    
    const panTypeButtons = [{ name: `全部 (${fullResourceCache[vod_id].length})`, pan: `custom:action=filter&pan_type=all&url=${encodeURIComponent(vod_id)}` }];
    Object.keys(panTypeCounts).forEach(typeCode => { panTypeButtons.push({ name: `${PAN_TYPE_MAP[typeCode] || `类型${typeCode}`} (${panTypeCounts[typeCode]})`, pan: `custom:action=filter&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🗂️ 网盘分类', tracks: panTypeButtons });
    
    const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all&url=${encodeURIComponent(vod_id)}` }];
    KEYWORD_FILTERS.forEach(kw => { keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🔍 关键字筛选', tracks: keywordButtons });
    
    if (filteredResources.length > 0) { const resourceTracks = filteredResources.map(r => { const panTypeName = PAN_TYPE_MAP[r.type] || '未知'; return { name: `[${panTypeName}] ${r.title}`, pan: r.link }; }); resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks }); } else { resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] }); }
    
    return jsonify({ list: resultLists });
}

// 【核心】getPlayinfo: 无需修改
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    if (!panUrl.startsWith('custom:')) {
        return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
    }

    const paramsStr = panUrl.replace('custom:', '');
    const params = new URLSearchParams(paramsStr);
    const filterExt = Object.fromEntries(params.entries());
    
    return jsonify({
        "urls": [],
        "action": { "type": "call", "ext": { "fn": "getTracks", "args": [filterExt] } }
    });
}

// ==================== 标准接口转发 (无变化) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.1.2 (数据对齐最终版)');
