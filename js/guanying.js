/**
 * Gying 前端插件 - v2.0 架构重构版
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v2.0
 * 更新日志:
 * v2.0: 最终版。严格遵循前后端分离原则。
 * 1. 前端完全负责UI逻辑，包括二级钻取、筛选、缓存管理。
 * 2. 后端只作为纯粹的数据抓取服务。
 * 3. 采用了已验证成功的参数传递方案 (在getCards/search中构建ext)。
 * 4. 完整、正确地实现了您最初设计的、带“点击加载”按钮的二级钻取功能。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
function log(msg) {
    try {
        if (typeof $log === 'function') {
            $log(`[Gying] ${msg}`);
        } else {
            console.log(`[Gying] ${msg}`);
        }
    } catch (e) {
        console.log(`[Gying-ERROR] log function failed: ${e}`);
    }
}

async function request(url) {
    try {
        log(`发起请求: ${url}`);
        if (typeof $fetch === 'object' && typeof $fetch.get === 'function') {
            const { data, status } = await $fetch.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            if (status !== 200) {
                log(`请求失败: HTTP ${status}`);
                return { error: `HTTP ${status}` };
            }
            const result = typeof data === 'object' ? data : JSON.parse(data);
            log(`请求成功`);
            return result;
        } else {
            const response = await fetch(url, {
                headers: { 'User-Agent': UA }
            });
            if (!response.ok) {
                log(`请求失败: HTTP ${response.status}`);
                return { error: `HTTP ${response.status}` };
            }
            const result = await response.json();
            log(`请求成功`);
            return result;
        }
    } catch (error) {
        log(`请求异常: ${error.message}`);
        return { error: error.message };
    }
}

function jsonify(obj) {
    return JSON.stringify(obj);
}

function argsify(str) {
    if (typeof str === 'object') return str;
    try {
        return JSON.parse(str);
    } catch {
        return {};
    }
}

function detectPanType(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('百度')) return '0';
    if (lowerTitle.includes('迅雷')) return '1';
    if (lowerTitle.includes('夸克')) return '2';
    if (lowerTitle.includes('阿里')) return '3';
    if (lowerTitle.includes('天翼')) return '4';
    if (lowerTitle.includes('115')) return '5';
    if (lowerTitle.includes('uc')) return '6';
    return 'unknown';
}

const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
let fullResourceCache = [];
let currentPanTypeFilter = 'all';
let currentKeywordFilter = 'all';
let currentVodId = '';

// ==================== XPTV App 标准接口 ====================
async function getConfig() {
    log(`插件初始化，后端地址: ${API_BASE_URL}`);
    return jsonify({
        ver: 1,
        title: 'Gying观影 (钻取筛选版)',
        site: 'gying.org',
        tabs: [
            { name: '剧集', ext: { id: 'tv' } },
            { name: '电影', ext: { id: 'mv' } },
            { name: '动漫', ext: { id: 'ac' } }
        ]
    });
}

// --- 【第1步: 稳定可靠的列表获取】 ---
async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) {
        log('缺少分类ID参数');
        return jsonify({ list: [] });
    }
    log(`获取分类: ${id}, 页码: ${page}`);
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) {
        log(`分类获取失败: ${data.error}`);
        return jsonify({ list: [], total: 0 });
    }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { vod_id: item.vod_id } // 【关键】我们只传递最纯粹的ID
    }));
    return jsonify({ list: cards, total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) {
        log('搜索关键词为空');
        return jsonify({ list: [] });
    }
    log(`搜索: ${text}`);
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) {
        log(`搜索失败: ${data.error}`);
        return jsonify({ list: [] });
    }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { vod_id: item.vod_id } // 【关键】我们只传递最纯粹的ID
    }));
    return jsonify({ list: cards });
}

// --- 【第2步: 遵循您最初的设计，detail只返回一个加载按钮】 ---
async function detail(ext) {
    ext = argsify(ext);
    const vod_id = ext.vod_id; // 从我们自己构建的ext中获取纯净ID
    log(`进入详情页，准备加载按钮，ID: ${vod_id}`);
    
    // 构建一个特殊的 "pan" 链接，用于在 play 函数中识别并触发 getTracks
    // 这个指令现在非常简单，只包含 action 和 vod_id
    const triggerUrl = `custom:action=init&vod_id=${encodeURIComponent(vod_id)}`;

    return jsonify({
        list: [{
            title: '在线播放', // 播放列表的标题
            tracks: [{
                name: '➡️ 点击加载资源列表 (支持筛选)',
                pan: triggerUrl,
            }]
        }]
    });
}

// --- 【第3步: getTracks 和 play 协同完成二级钻取】 ---
// getTracks 现在只负责从缓存中筛选和构建UI，不再直接被detail调用
async function getTracks(ext) {
    ext = argsify(ext);
    const { vod_id, pan_type, keyword, action } = ext;

    log(`getTracks刷新UI: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);

    if (pan_type !== undefined) currentPanTypeFilter = pan_type;
    if (keyword !== undefined) currentKeywordFilter = keyword;
    
    let filteredResources = [...fullResourceCache];
    if (currentPanTypeFilter !== 'all') {
        filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter);
    }
    if (currentKeywordFilter !== 'all') {
        const lowerKeyword = currentKeywordFilter.toLowerCase();
        if (lowerKeyword === '其他') {
            filteredResources = filteredResources.filter(r => {
                const lowerTitle = r.title.toLowerCase();
                return KEYWORD_FILTERS.slice(0, -1).every(kw => !lowerTitle.includes(kw.toLowerCase()));
            });
        } else {
            filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword));
        }
    }
    
    const resultLists = [];
    const panTypeCounts = {};
    fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
    
    // 构建筛选按钮，指令中只包含必要的筛选参数和 vod_id
    const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all&vod_id=${encodeURIComponent(vod_id)}` }];
    Object.keys(panTypeCounts).forEach(typeCode => {
        panTypeButtons.push({ name: `${PAN_TYPE_MAP[typeCode] || `类型${typeCode}`} (${panTypeCounts[typeCode]})`, pan: `custom:action=filter&pan_type=${typeCode}&vod_id=${encodeURIComponent(vod_id)}` });
    });
    resultLists.push({ title: '🗂️ 网盘分类', tracks: panTypeButtons });
    
    const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all&vod_id=${encodeURIComponent(vod_id)}` }];
    KEYWORD_FILTERS.forEach(kw => {
        keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}&vod_id=${encodeURIComponent(vod_id)}` });
    });
    resultLists.push({ title: '🔍 关键字筛选', tracks: keywordButtons });
    
    if (filteredResources.length > 0) {
        const resourceTracks = filteredResources.map(r => ({ name: `[${PAN_TYPE_MAP[r.type]}] ${r.title}`, pan: r.link }));
        resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks });
    } else {
        resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] });
    }
    
    return jsonify({ list: resultLists });
}

// play 函数现在是整个二级钻取流程的“总指挥”
async function play(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    if (panUrl.startsWith('custom:')) {
        log(`处理指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const filterExt = Object.fromEntries(params.entries());
        const { action, vod_id } = filterExt;

        if (action === 'init') {
            // 首次加载，需要请求后端
            log(`首次加载详情, ID: ${vod_id}`);
            currentVodId = vod_id; // 更新当前影片ID
            const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
            const data = await request(detailUrl);

            if (data.error || !data.list || data.list.length === 0) {
                return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
            }
            
            const playUrlString = data.list[0].vod_play_url;
            if (!playUrlString || playUrlString === '暂无任何网盘资源') {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
            }
            
            // 将后端返回的原始数据解析并存入前端缓存
            fullResourceCache = playUrlString.split('#').map(item => {
                const parts = item.split('$');
                if (!parts[0] || !parts[1]) return null;
                return { type: detectPanType(parts[0]), title: (parts[0] || '').trim(), link: (parts[1] || '').trim() };
            }).filter(item => item !== null);
            log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);
            
            // 缓存好数据后，调用 getTracks 来构建完整的UI
            return getTracks(filterExt);

        } else if (action === 'filter') {
            // 筛选操作，直接调用 getTracks 用缓存刷新UI
            return getTracks(filterExt);
        }
    }
    
    // 如果不是 custom 指令，就是真实的播放链接
    log(`准备播放: ${panUrl}`);
    return jsonify({ url: panUrl });
}

// --- 标准接口转发 ---
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
