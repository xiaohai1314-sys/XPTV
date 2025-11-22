/**
 * 找盘资源前端插件 - V5.0 (纯净分页版)
 * 核心功能：
 *  1. 配合 V5.0 后端，一次性获取所有高质量数据。
 *  2. 只负责对获取到的完整列表进行纯前端分页。
 *  3. 逻辑最简单，性能最稳定，无任何复杂的异步或状态管理。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.1.3:3004/api/get_real_url"; // <-- 请务必修改为您的后端服务器地址
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64   ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12; // 首页分页大小
const SEARCH_PAGE_SIZE = 30; // 搜索结果分页大小

// --- 全局状态 ---
let searchCache = {}; // 用于缓存一次完整的搜索结果
let cardsCache = {};

// --- 辅助函数 ---
function log(msg  ) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http'  )) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// --- 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V5.0 (纯净分页版) ====");
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

// 【搜索】
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    let allCards = searchCache[keyword];

    if (page === 1 || !allCards) {
        log(`[Search] 新搜索或无缓存，正在从后端全量获取数据...`);
        const baseUrl = API_ENDPOINT.substring(0, API_ENDPOINT.indexOf('/api/'));
        const searchApiUrl = `${baseUrl}/api/search?keyword=${encodeURIComponent(keyword)}`;
        try {
            const { data } = await $fetch.get(searchApiUrl);
            const result = JSON.parse(data);
            if (result.success && Array.isArray(result.list)) {
                allCards = result.list;
                searchCache[keyword] = allCards;
                log(`[Search] 成功获取 ${allCards.length} 条数据，耗时: ${result.duration}`);
            } else {
                allCards = [];
                log(`[Search] ❌ 后端返回失败或无数据。`);
            }
        } catch (e) {
            allCards = [];
            log(`[Search] ❌ 请求后端API失败: ${e.message}`);
        }
    } else {
        log(`[Search] 使用缓存数据进行分页，页码: ${page}`);
    }

    const totalCount = allCards.length;
    const totalPageCount = Math.ceil(totalCount / SEARCH_PAGE_SIZE) || 1;
    const startIndex = (page - 1) * SEARCH_PAGE_SIZE;
    const endIndex = startIndex + SEARCH_PAGE_SIZE;
    const pageList = allCards.slice(startIndex, endIndex);
    const hasMore = page < totalPageCount;

    log(`[Search] 返回 ${pageList.length} 条结果给第 ${page} 页, hasmore=${hasMore}`);
    return jsonify({
        list: pageList,
        page: page,
        pagecount: totalPageCount,
        hasmore: hasMore
    });
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

log('==== 插件加载完成 V5.0 (纯净分页版) ====');
