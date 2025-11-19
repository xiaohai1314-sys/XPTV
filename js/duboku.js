/**
 * 找盘资源前端插件 - V-Final-V2 (集成精确分页控制)
 * 核心功能：
 *  1. 调用后端 /api/search 实现高性能、智能分页搜索。
 *  2. 实现精确分页控制 (hasmore, pagecount) 和分页锁 (SEARCH_END)。
 *  3. 调用后端 /api/get_real_url 实现高效链接解析。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.102:3004/api/get_real_url"; // <-- 请务必修改为您的后端服务器地址
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12; // 首页分页大小
const SEARCH_PAGE_SIZE = 30; // 【重要】必须与后端定义的 SEARCH_PAGE_SIZE 保持一致

// --- 全局缓存 ---
let cardsCache = {};
let SEARCH_END = {}; // 分页锁，记录已加载完毕的关键词

// --- 辅助函数 ---
function log(msg) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http')) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// --- 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V-Final-V2 (精确分页版) ====");
    const CUSTOM_CATEGORIES = [ { name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } } ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// ★★★★★【首页分页】(保留用户原有逻辑) ★★★★★
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
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);
        return jsonify({ list: pageCards });
    } catch (e) {
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索 - 调用后端超级搜索 (支持真实分页和分页锁)】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!text) return jsonify({ list: [] });

    // 检查分页锁：如果该关键词已被标记为“已结束”，则直接返回空列表，并告知App没有更多页了
    if (page > 1 && SEARCH_END[text]) {
        log(`[search] 关键词 "${text}" 已锁定，第 ${page} 页不再请求。`);
        // 返回精确的分页信息，告知App已无更多
        return jsonify({ list: [], page: page, pagecount: page, hasmore: false });
    }
    // 如果是第一页搜索，清空之前的锁
    if (page === 1) {
        delete SEARCH_END[text];
    }

    log(`[search] 调用后端，关键词="${text}", 页码=${page}`);
    // 从 API_ENDPOINT 中提取 base url
    const baseUrl = API_ENDPOINT.substring(0, API_ENDPOINT.indexOf('/api/'));
    // 关键：将 page 参数传给后端
    const searchApiUrl = `${baseUrl}/api/search?keyword=${encodeURIComponent(text)}&page=${page}`;

    try {
        const { data } = await $fetch.get(searchApiUrl);
        const result = JSON.parse(data);

        if (!result.success || !Array.isArray(result.list)) {
            return jsonify({ list: [] });
        }

        const cards = result.list;
        let hasMore = true;

        // 分页锁判定：如果返回的结果数量，少于我们期望的每页数量，说明这是最后一页了。
        if (cards.length < SEARCH_PAGE_SIZE) {
            hasMore = false;
            SEARCH_END[text] = true; // 锁住这个关键词，后续不再为它翻页
            log(`[search] 关键词 "${text}" 已到达最后一页，锁定翻页。`);
        }

        log(`[search] 返回 ${cards.length} 条结果, hasMore=${hasMore}`);

        // 返回包含精确分页信息的完整对象
        return jsonify({
            list: cards,
            page: page,
            pagecount: hasMore ? page + 1 : page, // 如果有更多，页数至少是当前页+1
            hasmore: hasMore
        });

    } catch (e) {
        log(`[search] ❌ 请求后端时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页】(保留用户原有逻辑) ★★★★★
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

// --- 兼容接口 (保持不变) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 插件加载完成 V-Final-V2 (精确分页版) ====');
