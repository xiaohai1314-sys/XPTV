/**
 * Gying 前端插件 - 最终融合版 v1.2
 * 
 * 功能特性:
 * - 完美适配 XPTV App 环境，借鉴"网盘资源社"脚本的成功经验
 * - 与 Gying 后端服务完美配合，支持钻取式两级筛选功能
 * - [v1.1] 修复了详情页ID传递时可能为[object Object]的致命错误
 * - [v1.1] 优化了日志输出，更易于调试
 * - [v1.2] 优化了getTracks函数中vod_id的提取逻辑，使其更健壮
 * - 强大的错误处理和用户体验优化
 * - 支持分类浏览、搜索、详情查看等完整功能
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.2 (2025年最终修复版)
 */

// ==================== 配置区 ====================
// 【重要】请修改为您的后端服务实际地址，例如 http://192.168.1.10:3001/api
const API_BASE_URL = 'http://192.168.1.6:3001/api'; 
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// 网盘类型映射
const PAN_TYPE_MAP = {
    '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里',
    '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知'
};

// 关键字筛选选项
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];

// ==================== 工具函数区 ====================

function log(msg) {
    if (typeof $log === 'function') {
        $log(`[Gying] ${msg}`);
    } else {
        console.log(`[Gying] ${msg}`);
    }
}

async function request(url) {
    try {
        log(`发起请求: ${url}`);
        if (typeof $fetch === 'object' && typeof $fetch.get === 'function') {
            const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 });
            if (status !== 200) throw new Error(`HTTP ${status}`);
            return typeof data === 'object' ? data : JSON.parse(data);
        } else {
            const response = await fetch(url, { headers: { 'User-Agent': UA } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        }
    } catch (error) {
        log(`请求异常: ${error.message}`);
        return { error: error.message };
    }
}

function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) {
    if (typeof str === 'object') return str;
    try { return JSON.parse(str); } catch { return {}; }
}

function detectPanType(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('百度') || lowerTitle.includes('baidu')) return '0';
    if (lowerTitle.includes('迅雷') || lowerTitle.includes('thunder')) return '1';
    if (lowerTitle.includes('夸克') || lowerTitle.includes('quark')) return '2';
    if (lowerTitle.includes('阿里') || lowerTitle.includes('aliyun')) return '3';
    if (lowerTitle.includes('天翼') || lowerTitle.includes('cloud.189')) return '4';
    if (lowerTitle.includes('115')) return '5';
    if (lowerTitle.includes('uc')) return '6';
    return 'unknown';
}

// ==================== 缓存区 ====================
let fullResourceCache = [];
let currentPanTypeFilter = 'all';
let currentKeywordFilter = 'all';
let currentVodId = '';

// ==================== XPTV App 标准接口 ====================

async function getConfig() {
    log(`插件初始化，后端地址: ${API_BASE_URL}`);
    return jsonify({
        ver: 1, title: 'Gying观影 (钻取筛选版)', site: 'gying.org',
        tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }]
    });
}

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) return jsonify({ list: [] });
    log(`获取分类: ${id}, 页码: ${page}`);
    const data = await request(`${API_BASE_URL}/vod?id=${id}&page=${page}`);
    return jsonify({ list: data.list || [], total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) return jsonify({ list: [] });
    log(`搜索: ${text}`);
    const data = await request(`${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`);
    return jsonify({ list: data.list || [] });
}

async function getTracks(ext) {
    ext = argsify(ext);
    
    // 【v1.2 优化】更健壮的影片ID提取逻辑
    let vod_id;
    if (typeof ext === 'string') {
        vod_id = ext;
    } else if (typeof ext === 'object' && ext !== null) {
        // 尝试从 ext.url 或 ext.id 获取，并确保是字符串
        if (typeof ext.url === 'string' && ext.url) {
            vod_id = ext.url;
        } else if (typeof ext.id === 'string' && ext.id) {
            vod_id = ext.id;
        } else if (typeof ext.id === 'object' && ext.id !== null && typeof ext.id.id === 'string' && ext.id.id) {
            // 兼容 ext.id 也是对象的情况，例如 {id: 'mv/12345'}
            vod_id = ext.id.id;
        } else {
            // 最终尝试将整个 ext 对象转换为字符串，作为备用方案
            vod_id = String(ext);
        }
    }
    
    // 最终检查，确保 vod_id 是一个非空字符串，且不是 '[object Object]'
    if (typeof vod_id !== 'string' || !vod_id || vod_id === '[object Object]') {
        log(`错误：无法从参数中提取有效的影片ID。收到的参数: ${JSON.stringify(ext)}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无效的影片ID', pan: '' }] }] });
    }

    const { pan_type, keyword, action = 'init' } = ext;
    log(`getTracks调用: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);
    
    if (action === 'init' || fullResourceCache.length === 0 || currentVodId !== vod_id) {
        fullResourceCache = [];
        currentPanTypeFilter = 'all';
        currentKeywordFilter = 'all';
        currentVodId = vod_id;
        
        log(`首次加载详情: ${vod_id}`);
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        
        if (data.error || !data.list || data.list.length === 0) {
            log(`详情获取失败或数据为空: ${data.error || 'No data'}`);
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '获取资源失败或无资源', pan: '' }] }] });
        }
        
        const playUrlString = data.list[0].vod_play_url;
        if (!playUrlString || playUrlString === '暂无任何网盘资源') {
            log('无有效资源链接');
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
        }
        
        fullResourceCache = playUrlString.split('#').map(item => {
            const parts = item.split('$');
            if (parts.length < 2 || !parts[0] || !parts[1]) return null;
            return { type: detectPanType(parts[0]), title: parts[0].trim(), link: parts[1].trim() };
        }).filter(Boolean);
        log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);
    }
    
    if (pan_type !== undefined) currentPanTypeFilter = pan_type;
    if (keyword !== undefined) currentKeywordFilter = keyword;
    
    let filteredResources = [...fullResourceCache];
    if (currentPanTypeFilter !== 'all') {
        filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter);
    }
    if (currentKeywordFilter !== 'all') {
        const lowerKeyword = currentKeywordFilter.toLowerCase();
        if (lowerKeyword === '其他') {
            filteredResources = filteredResources.filter(r => KEYWORD_FILTERS.slice(0, -1).every(kw => !r.title.toLowerCase().includes(kw.toLowerCase())));
        } else {
            filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword));
        }
    }
    
    const buildFilterButtons = (title, items, type, currentFilter) => {
        const buttons = items.map(item => ({
            name: item.name,
            pan: `custom:action=filter&${type}=${item.value}&url=${encodeURIComponent(vod_id)}`
        }));
        return { title: `🗂️ ${title}`, tracks: buttons };
    };

    const panTypeCounts = fullResourceCache.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
    }, {});
    const panTypeItems = [{ name: `全部 (${fullResourceCache.length})`, value: 'all' }, ...Object.keys(panTypeCounts).map(code => ({ name: `${PAN_TYPE_MAP[code]} (${panTypeCounts[code]})`, value: code }))];
    const keywordItems = [{ name: '全部', value: 'all' }, ...KEYWORD_FILTERS.map(kw => ({ name: kw, value: kw }))];

    const resourceTracks = filteredResources.length > 0
        ? filteredResources.map(r => ({ name: `[${PAN_TYPE_MAP[r.type]}] ${r.title}`, pan: r.link }))
        : [{ name: '当前筛选条件下无结果', pan: '' }];

    const resultLists = [
        buildFilterButtons('网盘分类', panTypeItems, 'pan_type', currentPanTypeFilter),
        buildFilterButtons('关键字筛选', keywordItems, 'keyword', currentKeywordFilter),
        { title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks }
    ];
    
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
        setTimeout(() => getTracks(filterExt), 50);
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

