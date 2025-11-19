/**
 * 找盘资源前端插件 - V-Final-V2.7 (空结果修复终极版)
 * 核心功能：
 *  1. 修复了当 STAGE 1 结果为空或过少时，无法触发 STAGE 2 加载的致命逻辑错误。
 *  2. 修复了获取到 stage2 数据后，需要再次翻页才能显示的逻辑问题。
 *  3. 实现分阶段渐进式加载，前端驱动，按需请求后续资源。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.102:3004/api/get_real_url"; // <-- 请务必修改为您的后端服务器地址
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64   ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12; // 首页分页大小
const SEARCH_PAGE_SIZE = 30; // 搜索结果分页大小

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
    log("==== 插件初始化 V-Final-V2.7 (空结果修复终极版) ====");
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

// 【搜索 - 渐进式加载总控制器 - 最终完美版】
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    if (page === 1 || !searchSession.keyword || searchSession.keyword !== keyword) {
        log(`[Search] 新的搜索开始，关键词: "${keyword}"`);
        searchSession = { keyword: keyword, stage1Results: [], stage2Results: [], stage1Loaded: false, stage2Loaded: false };
    }

    log(`[Search] 当前会话: page=${page}`);
    const baseUrl = API_ENDPOINT.substring(0, API_ENDPOINT.indexOf('/api/'));

    if (!searchSession.stage1Loaded) {
        log(`[Search] 请求阶段1 (高优) 数据...`);
        const searchApiUrl = `${baseUrl}/api/search?keyword=${encodeURIComponent(keyword)}&stage=1`;
        try {
            const { data } = await $fetch.get(searchApiUrl);
            const result = JSON.parse(data);
            if (result.success && Array.isArray(result.list)) {
                searchSession.stage1Results = result.list;
                log(`[Search] 阶段1成功获取 ${result.list.length} 条数据`);
            }
        } catch (e) { log(`[Search] ❌ 阶段1请求失败: ${e.message}`); }
        searchSession.stage1Loaded = true;
    }

    // ★★★★★【核心逻辑修复】★★★★★
    const stage1PageCount = Math.ceil(searchSession.stage1Results.length / SEARCH_PAGE_SIZE) || 1;
    const shouldLoadStage2 = (page > stage1PageCount) || (searchSession.stage1Results.length === 0 && page === 1);

    if (shouldLoadStage2 && !searchSession.stage2Loaded) {
        log(`[Search] 条件满足，请求阶段2 (夸克) 数据... (原因: ${page > stage1PageCount ? '翻页触发' : '阶段1无结果'})`);
        const searchApiUrl = `${baseUrl}/api/search?keyword=${encodeURIComponent(keyword)}&stage=2`;
        try {
            const { data } = await $fetch.get(searchApiUrl);
            const result = JSON.parse(data);
            if (result.success && Array.isArray(result.list)) {
                searchSession.stage2Results = result.list;
                log(`[Search] 阶段2成功获取 ${result.list.length} 条数据`);
            }
        } catch (e) { log(`[Search] ❌ 阶段2请求失败: ${e.message}`); }
        searchSession.stage2Loaded = true;
    }
    
    const combinedList = [...searchSession.stage1Results, ...searchSession.stage2Results];
    const totalCount = combinedList.length;
    const totalPageCount = Math.ceil(totalCount / SEARCH_PAGE_SIZE) || 1;
    const startIndex = (page - 1) * SEARCH_PAGE_SIZE;
    const endIndex = startIndex + SEARCH_PAGE_SIZE;
    const pageList = combinedList.slice(startIndex, endIndex);
    const hasMore = page < totalPageCount;

    log(`[Search] 返回 ${pageList.length} 条结果给第 ${page} 页, 总页数: ${totalPageCount}, 是否有更多: ${hasMore}`);
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

log('==== 插件加载完成 V-Final-V2.7 (空结果修复终极版) ====');
