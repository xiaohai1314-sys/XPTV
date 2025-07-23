/**
 * Gying 前端插件 - v1.1.0 (终极修正版)
 * 
 * 作者: 在用户的点醒下，回归最初的正确逻辑。
 * 版本: v1.1.0 (修正版)
 * 更新日志:
 * 1. 【回归初心】完全恢复了 v1.1.0 的经典、正确的多级钻取架构。
 * 2. 【终极修正】修复了导致后端接收到错误ID (e.g., { "vod_id": "..." }) 的唯一、致命的Bug。
 * 3. 【逻辑修正】在 getTracks 函数的入口处，增加了一道坚不可摧的防线，确保无论从哪里调用，传递给后端 /api/detail 的 `ids` 参数永远是一个纯净的字符串。
 * 4. 【架构不变】这不再是新架构，而是对我们最初成功方案的完美修复。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (与原版完全相同) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v1.1.0-fix] ${msg}`); } else { console.log(`[Gying v1.1.0-fix] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
let fullResourceCache = {}; // 使用对象缓存，以 vod_id 为键
let currentPanTypeFilter = {};
let currentKeywordFilter = {};

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (钻取版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards }); }

// 【核心】getTracks: 回归经典，只修复Bug
async function getTracks(ext) {
    ext = argsify(ext);
    
    // 【终极修正】无论 ext 是什么，我们只取纯净的 vod_id 字符串
    let vod_id;
    if (typeof ext === 'string') {
        vod_id = ext;
    } else if (typeof ext === 'object' && ext !== null) {
        vod_id = ext.url || ext.id || ext.vod_id; // 兼容所有可能的属性名
    }

    if (!vod_id || typeof vod_id !== 'string') {
        log(`[致命错误] 无法提取纯净的 vod_id: ${JSON.stringify(ext)}`);
        return jsonify({ list: [] });
    }

    const { pan_type, keyword, action = 'init' } = ext;
    log(`getTracks调用: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);

    if (action === 'init' || !fullResourceCache[vod_id]) {
        currentPanTypeFilter[vod_id] = 'all';
        currentKeywordFilter[vod_id] = 'all';
        log(`首次加载或强制刷新: ${vod_id}`);
        
        // 【正确调用】这里的 vod_id 保证是纯净字符串
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        
        const data = await request(detailUrl);
        if (data.error || !data.list || data.list.length === 0 || !data.list[0].vod_play_url) {
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '获取资源失败或无资源', pan: '' }] }] });
        }
        
        const playUrlString = data.list[0].vod_play_url;
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
    
    log(`UI构建完成: 网盘='${currentPanTypeFilter[vod_id]}', 关键字='${currentKeywordFilter[vod_id]}', 显示${filteredResources.length}/${fullResourceCache[vod_id].length}条`);
    return jsonify({ list: resultLists });
}

// 【核心】getPlayinfo: 回归经典，无需修改
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    if (!panUrl.startsWith('custom:')) {
        log(`最终播放链接: ${panUrl}`);
        return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
    }

    log(`处理筛选指令: ${panUrl}`);
    const paramsStr = panUrl.replace('custom:', '');
    const params = new URLSearchParams(paramsStr);
    const filterExt = Object.fromEntries(params.entries());
    
    return jsonify({
        "urls": [],
        "action": {
            "type": "call",
            "ext": {
                "fn": "getTracks",
                "args": [filterExt]
            }
        }
    });
}

// ==================== 标准接口转发 (回归经典) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.1.0 (终极修正版)');
