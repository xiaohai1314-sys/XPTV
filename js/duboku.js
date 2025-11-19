/**
 * 找盘资源前端插件 - V-Final-V2.8 (硬编码强制加载版 - 测试专用)
 * 核心功能：
 *  1. 【测试核心】在首次搜索时，无视任何逻辑，强制请求 STAGE 1 和 STAGE 2。
 *  2. 旨在验证前端脚本是否被正确更新，以及 STAGE 2 是否能被成功触发。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.102:3004/api/get_real_url";
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64   ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 30;

// --- 全局状态 ---
let searchSession = {};
let cardsCache = {};

// --- 辅助函数 ---
function log(msg  ) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http'  )) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// --- 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V-Final-V2.8 (硬编码强制加载版) ====");
    const CUSTOM_CATEGORIES = [ { name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } } ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// 【首页分页】
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    const url = SITE_URL;
    try {
        const cacheKey = `category_${categoryName}`;
        let allCards = cardsCache[cacheKey];
        if (!allCards) {
            const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            allCards = [];
            const categorySpan = $(`span.fs-5.fw-bold:contains('${categoryName}')`);
            if (categorySpan.length === 0) return jsonify({ list: [] });
            let rowDiv = categorySpan.closest('div.d-flex').parent().next('div.row');
            if (rowDiv.length === 0) rowDiv = categorySpan.closest('div.d-flex').next('div.row');
            if (rowDiv.length === 0) return jsonify({ list: [] });
            rowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                allCards.push({ vod_id: linkElement.attr('href') || "", vod_name: linkElement.find('h2').text().trim() || "", vod_pic: getCorrectPicUrl(linkElement.find('img.lozad').attr('data-src')), vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "", ext: { url: linkElement.attr('href') || "" } });
            });
            cardsCache[cacheKey] = allCards;
        }
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);
        return jsonify({ list: pageCards });
    } catch (e) { return jsonify({ list: [] }); }
}

// 【搜索 - 测试专用版】
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    if (page === 1) {
        log(`[Search] 新的强制搜索开始，关键词: "${keyword}"`);
        searchSession = { keyword: keyword, allResults: [], loaded: false };
    }

    const baseUrl = API_ENDPOINT.substring(0, API_ENDPOINT.indexOf('/api/'));

    if (!searchSession.loaded) {
        log(`[Search] 硬编码触发：强制请求 STAGE 1...`);
        const searchApiUrl1 = `${baseUrl}/api/search?keyword=${encodeURIComponent(keyword)}&stage=1`;
        let stage1List = [];
        try {
            const { data } = await $fetch.get(searchApiUrl1);
            const result = JSON.parse(data);
            if (result.success && Array.isArray(result.list)) {
                stage1List = result.list;
                log(`[Search] STAGE 1 成功获取 ${stage1List.length} 条数据`);
            }
        } catch (e) { log(`[Search] ❌ STAGE 1 请求失败: ${e.message}`); }

        log(`[Search] 硬编码触发：强制请求 STAGE 2...`);
        const searchApiUrl2 = `${baseUrl}/api/search?keyword=${encodeURIComponent(keyword)}&stage=2`;
        let stage2List = [];
        try {
            const { data } = await $fetch.get(searchApiUrl2);
            const result = JSON.parse(data);
            if (result.success && Array.isArray(result.list)) {
                stage2List = result.list;
                log(`[Search] STAGE 2 成功获取 ${stage2List.length} 条数据`);
            }
        } catch (e) { log(`[Search] ❌ STAGE 2 请求失败: ${e.message}`); }

        searchSession.allResults = [...stage1List, ...stage2List];
        searchSession.loaded = true;
        log(`[Search] 所有阶段加载完毕，总共 ${searchSession.allResults.length} 条数据`);
    }
    
    const combinedList = searchSession.allResults;
    const totalCount = combinedList.length;
    const totalPageCount = Math.ceil(totalCount / SEARCH_PAGE_SIZE) || 1;
    const startIndex = (page - 1) * SEARCH_PAGE_SIZE;
    const endIndex = startIndex + SEARCH_PAGE_SIZE;
    const pageList = combinedList.slice(startIndex, endIndex);
    const hasMore = page < totalPageCount;

    log(`[Search] 返回 ${pageList.length} 条结果给第 ${page} 页`);
    return jsonify({ list: pageList, page: page, pagecount: totalPageCount, hasmore: hasMore });
}

// 【详情页】
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });
    const middleUrl = getCorrectPicUrl(url);
    try {
        const apiUrl = `${API_ENDPOINT}?url=${encodeURIComponent(middleUrl)}`;
        const response = await $fetch.get(apiUrl);
        const result = JSON.parse(response.data);
        if (result.success && result.real_url) {
            let panName = '网盘链接';
            if (result.real_url.includes('quark')) panName = '夸克网盘'; else if (result.real_url.includes('baidu')) panName = '百度网盘'; else if (result.real_url.includes('aliyundrive')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: result.real_url, ext: {} }] }] });
        } else { throw new Error(result.error || 'API error'); }
    } catch (e) { return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }] }); }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 插件加载完成 V-Final-V2.8 (硬编码强制加载版) ====');
