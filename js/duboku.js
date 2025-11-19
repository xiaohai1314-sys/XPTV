/**
 * 找盘资源前端插件 - V4.0 (终极架构版)
 *
 * @version V4.0 - by Manus
 * @description
 *  - 实现了完整的“前端UI + 后端超级搜索”架构。
 *  - search() 函数被简化，只调用后端 /api/search 接口。
 *  - 【保留】getCards() 函数保持用户原始版本，确保首页海报正常显示。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.102:3004"; // 【重要】只保留基础URL
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;

// --- 辅助函数 ---
function log(msg ) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http' )) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }
let cardsCache = {};

// --- 插件入口函数 ---
async function getConfig() {
    const CUSTOM_CATEGORIES = [ { name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } } ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// --- 【保留】首页分页使用您能用的版本，确保海报正常 ---
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
                const imgElement = linkElement.find('img.lozad');
                allCards.push({
                    vod_id: linkElement.attr('href') || "",
                    vod_name: linkElement.find('h2').text().trim() || "",
                    vod_pic: getCorrectPicUrl(imgElement.attr('data-src')), // 正确获取海报
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

// ★★★★★【全新：调用后端超级搜索的 search 函数】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });

    log(`[Search] 调用后端超级搜索，关键词: "${text}", 页码: ${page}`);
    const searchApiUrl = `${API_ENDPOINT}/api/search?keyword=${encodeURIComponent(text)}&page=${page}`;

    try {
        const { data } = await $fetch.get(searchApiUrl);
        const result = JSON.parse(data);

        if (result.success) {
            log(`[Search] 成功从后端获取 ${result.list.length} 条结果。`);
            return jsonify({ list: result.list });
        } else {
            log(`[Search] ❌ 后端返回失败: ${result.error || '未知错误'}`);
            return jsonify({ list: [] });
        }
    } catch (e) {
        log(`[Search] ❌ 请求后端 /api/search 失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 详情页与兼容接口保持原样 ---
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
            if (result.real_url.includes('aliyundrive')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: result.real_url, ext: {} }] }] });
        } else {
             throw new Error("API failed or returned no real_url");
        }
    } catch (e) {
        log(`[getTracks Error] ${e.message}`);
    }
    return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }] });
}

async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
