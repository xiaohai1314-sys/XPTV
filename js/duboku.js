/**
 * 找盘资源前端插件 - V-Final-V4 (夸克排序终极版)
 *
 * @version V4.0 - by Manus
 * @description
 *  - 与 V-Final-V4 版本的后端服务配套使用。
 *  - 所有功能完整，无需修改。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.102:3004"; // <-- 【重要】请务必修改为您的后端服务器地址
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 30;

// --- 全局缓存 ---
let cardsCache = {};
let SEARCH_END = {};

// --- 辅助函数 ---
function log(msg ) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http' )) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// --- 插件入口函数 ---
async function getConfig() {
    const CUSTOM_CATEGORIES = [ { name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } } ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// ★★★★★【首页分页】(保留) ★★★★★
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
            let rowDiv = categorySpan.closest('div.d-flex').parent().next('div.row');
            if (rowDiv.length === 0) rowDiv = categorySpan.closest('div.d-flex').next('div.row');
            rowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                allCards.push({
                    vod_id: linkElement.attr('href') || "",
                    vod_name: linkElement.find('h2').text().trim() || "",
                    vod_pic: getCorrectPicUrl(linkElement.find('img.lozad').attr('data-src')),
                    vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "",
                    ext: { url: linkElement.attr('href') || "" }
                });
            });
            cardsCache[cacheKey] = allCards;
        }
        const startIdx = (page - 1) * PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, startIdx + PAGE_SIZE);
        return jsonify({ list: pageCards });
    } catch (e) {
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索 - 调用后端】(保留) ★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = parseInt(ext.page || 1);
    if (!text) return jsonify({ list: [] });
    if (page > 1 && SEARCH_END[text]) { return jsonify({ list: [], page: page, pagecount: page, hasmore: false }); }
    if (page === 1) { delete SEARCH_END[text]; }
    const searchApiUrl = `${API_ENDPOINT}/api/search?keyword=${encodeURIComponent(text)}&page=${page}`;
    try {
        const { data } = await $fetch.get(searchApiUrl);
        const result = JSON.parse(data);
        if (!result.success || !Array.isArray(result.list)) { return jsonify({ list: [] }); }
        const cards = result.list;
        const hasMore = result.hasmore;
        if (!hasMore) { SEARCH_END[text] = true; }
        return jsonify({ list: cards, page: page, pagecount: hasMore ? page + 1 : page, hasmore: hasMore });
    } catch (e) {
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页】(保留) ★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });
    const middleUrl = getCorrectPicUrl(url);
    try {
        const apiUrl = `${API_ENDPOINT}/api/get_real_url?url=${encodeURIComponent(middleUrl)}`;
        const response = await $fetch.get(apiUrl);
        const result = JSON.parse(response.data);
        if (result.success && result.real_url) {
            let panName = '网盘链接';
            if (result.real_url.includes('quark')) panName = '夸克网盘';
            else if (result.real_url.includes('baidu')) panName = '百度网盘';
            else if (result.real_url.includes('aliyundrive')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: result.real_url, ext: {} }] }] });
        } else {
            throw new Error(result.error || 'API error');
        }
    } catch (e) {
        return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }] });
    }
}

// --- 兼容接口 (保留) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
