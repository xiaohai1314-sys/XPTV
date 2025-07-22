/**
 * Gying 前端插件 - v7.0 终极觉醒版
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v7.0
 * 更新日志:
 * v7.0: 最终版。在经历了所有失败后，终于领悟到最底层、最核心的错误。
 * 1. 【致命错误修正】彻底删除所有函数末尾的 JSON.stringify()，直接返回纯粹的JavaScript对象。
 * 2. 【结构保留】保留 v6.0 中被验证为最接近正确的、100%复刻“完美代码”的函数结构和UI渲染机制。
 * 3. 这次，我们用最原始、最纯粹的数据格式，和这个特殊的播放器环境对话。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
// 【核心】完全依赖播放器环境提供的 $log, $fetch 等函数
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
let fullResourceCache = [];

// ==================== XPTV App 标准接口 (100%复刻规范) ====================
async function init() {
    $log(`[Gying] 插件初始化`);
    const config = {
        "ver": 1,
        "title": "Gying观影 (觉醒版)",
        "site": "gying.org",
        "class": [
            { "type_name": "剧集", "type_id": "tv" },
            { "type_name": "电影", "type_id": "mv" },
            { "type_name": "动漫", "type_id": "ac" }
        ],
        "filters": {}
    };
    return config; // 【终极修正】直接返回对象
}

async function home() {
    const config = await init();
    return { "class": config.class, "filters": config.filters }; // 【终极修正】直接返回对象
}

async function category(tid, pg, filter, ext) {
    $log(`[Gying] 获取分类: tid=${tid}, pg=${pg}`);
    const url = `${API_BASE_URL}/vod?id=${tid}&page=${pg}`;
    const res = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
    const data = JSON.parse(res.data);
    return { list: data.list || [] }; // 【终极修正】直接返回对象
}

async function search(wd, quick) {
    $log(`[Gying] 搜索: ${wd}`);
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(wd)}`;
    const res = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
    const data = JSON.parse(res.data);
    return { list: data.list || [] }; // 【终极修正】直接返回对象
}

async function detail(id) {
    $log(`[Gying] detail函数加载详情, ID: ${id}`);

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(id)}`;
    const res = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA }, timeout: 15000 });
    const data = JSON.parse(res.data);

    if (data.error || !data.list || data.list.length === 0) {
        return { list: [{ vod_name: '获取资源失败', vod_play_from: '错误', vod_play_url: 'pan$#', vod_id: id }] };
    }
    const detailItem = data.list[0];
    const playUrlString = detailItem.vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return { list: [{ vod_name: '暂无任何网盘资源', vod_play_from: '提示', vod_play_url: 'pan$#', vod_id: id }] };
    }

    fullResourceCache = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (!parts[0] || !parts[1]) return null;
        return { type: detectPanType(parts[0]), title: (parts[0] || '').trim(), link: (parts[1] || '').trim() };
    }).filter(item => item !== null);
    $log(`[Gying] 资源解析完成，共 ${fullResourceCache.length} 条有效资源`);

    const froms = [];
    const urls = [];
    froms.push('🗂️ 网盘分类');
    const panTypeCounts = {};
    fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
    const panTypeUrls = [`全部 (${fullResourceCache.length})$pan$all`];
    Object.keys(panTypeCounts).forEach(typeCode => { panTypeUrls.push(`${PAN_TYPE_MAP[typeCode] || `类型${typeCode}`} (${panTypeCounts[typeCode]})$pan$${typeCode}`); });
    urls.push(panTypeUrls.join('#'));

    froms.push('🔍 关键字筛选');
    const keywordUrls = [`全部$pan$all`];
    KEYWORD_FILTERS.forEach(kw => { keywordUrls.push(`${kw}$pan$${kw}`); });
    urls.push(keywordUrls.join('#'));

    froms.push(`📁 资源列表 (${fullResourceCache.length}条)`);
    const allResourceUrls = fullResourceCache.map(r => `[${PAN_TYPE_MAP[r.type]}] ${r.title}$${r.link}`).join('#');
    urls.push(allResourceUrls);

    detailItem.vod_play_from = froms.join('$$$');
    detailItem.vod_play_url = urls.join('$$$');
    
    return { list: [detailItem] }; // 【终极修正】直接返回对象
}

async function play(flag, id, flags) {
    $log(`[Gying] play函数被调用: flag=${flag}, id=${id}`);
    
    if (id.startsWith('pan$')) {
        const filterValue = id.split('$')[1];
        let currentPanTypeFilter = 'all';
        let currentKeywordFilter = 'all';

        flags.forEach(f => {
            if (f.name === '🗂️ 网盘分类') currentPanTypeFilter = f.url.split('$')[1];
            else if (f.name === '🔍 关键字筛选') currentKeywordFilter = f.url.split('$')[1];
        });

        if (flag === '🗂️ 网盘分类') currentPanTypeFilter = filterValue;
        else if (flag === '🔍 关键字筛选') currentKeywordFilter = filterValue;
        
        $log(`[Gying] 筛选: 网盘=${currentPanTypeFilter}, 关键字=${currentKeywordFilter}`);

        let filteredResources = [...fullResourceCache];
        if (currentPanTypeFilter !== 'all') { filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter); }
        if (currentKeywordFilter !== 'all') {
            const lowerKeyword = currentKeywordFilter.toLowerCase();
            if (lowerKeyword === '其他') { filteredResources = filteredResources.filter(r => !KEYWORD_FILTERS.slice(0, -1).some(kw => r.title.toLowerCase().includes(kw.toLowerCase()))); } 
            else { filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword)); }
        }
        
        const newUrls = filteredResources.map(r => `[${PAN_TYPE_MAP[r.type]}] ${r.title}$${r.link}`).join('#');
        
        return { "flag": "📁 资源列表", "url": newUrls, "title": `📁 资源列表 (${filteredResources.length}条)` }; // 【终极修正】直接返回对象
    }

    $log(`[Gying] 准备播放: ${id}`);
    return { parse: 0, url: id }; // 【终极修正】直接返回对象
}
