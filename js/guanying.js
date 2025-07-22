/**
 * Gying 前端插件 - v3.0 单入口最终版
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v3.0
 * 更新日志:
 * v3.0: 最终版。根据播放器直接调用 play 函数的行为模式进行重构。
 * 1. 确认播放器在详情页直接调用 play 函数，废弃 detail 函数的逻辑。
 * 2. play 函数现在是获取资源和处理筛选的唯一入口。
 * 3. 完整保留了二级钻取筛选功能，并确保在正确的函数中执行。
 * 4. 这次，它将完全匹配播放器的运行逻辑。
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

// 【关键修正】detail 函数现在是空的，因为播放器不调用它
async function detail(ext) {
    log("detail函数被调用（理论上不会发生）。");
    return jsonify({ list: [] });
}

// 【关键修正】play 函数现在是所有详情页逻辑的唯一入口
async function play(ext) {
    ext = argsify(ext);
    
    // 检查 ext 中是否包含 pan 属性，如果有，说明是筛选或播放操作
    if (ext.pan) {
        const panUrl = ext.pan;
        if (panUrl.startsWith('custom:')) {
            // 这是筛选指令
            log(`处理筛选指令: ${panUrl}`);
            const paramsStr = panUrl.replace('custom:', '');
            const params = new URLSearchParams(paramsStr);
            const filterExt = Object.fromEntries(params.entries());
            const { vod_id, pan_type, keyword } = filterExt;

            if (pan_type !== undefined) currentPanTypeFilter = pan_type;
            if (keyword !== undefined) currentKeywordFilter = keyword;

            // 直接构建并返回新的UI，因为数据已在缓存中
            return buildTracksUI(vod_id);
        } else {
            // 这是真实的播放链接
            log(`准备播放: ${panUrl}`);
            return jsonify({ url: panUrl });
        }
    }

    // 如果 ext 中没有 pan 属性，说明是第一次进入详情页
    const vod_id = ext.vod_id;
    if (!vod_id) {
        log("play函数首次调用失败：缺少vod_id。");
        return jsonify({ list: [] });
    }

    log(`play函数首次加载详情, ID: ${vod_id}`);
    currentVodId = vod_id;
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);

    if (data.error || !data.list || data.list.length === 0) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }

    fullResourceCache = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (!parts[0] || !parts[1]) return null;
        return { type: detectPanType(parts[0]), title: (parts[0] || '').trim(), link: (parts[1] || '').trim() };
    }).filter(item => item !== null);
    log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);

    // 获取并缓存数据后，构建二级钻取UI并返回
    return buildTracksUI(vod_id);
}

// 辅助函数：构建二级钻取UI
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
    
    return jsonify({ list: resultLists });
}

// --- 标准接口转发 ---
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
