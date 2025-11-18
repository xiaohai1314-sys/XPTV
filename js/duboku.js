/**
 * 找盘资源前端插件 - V1.7.1 (仅保留 115 + 天翼)
 * 变更内容：
 *  - 删除夸克筛选与排序
 *  - 删除夸克、百度、迅雷、阿里、UC等所有网盘
 *  - 搜索结果仅保留 115 网盘 + 天翼网盘
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.1.3:3004/api/get_real_url"; 
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 30;

// --- 辅助函数 ---
function log(msg) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http')) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// --- 全局缓存 ---
let cardsCache = {};


// ★★★★★【初始化】★★★★★
async function getConfig() {
    log("==== 插件初始化 V1.7.1 (仅115+天翼) ====");
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}



// ★★★★★【首页分页 - 原样保留】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    const url = SITE_URL;
    log(`[getCards] 分类="${categoryName}", 页=${page}`);
    try {
        const cacheKey = `category_${categoryName}`;
        let allCards = cardsCache[cacheKey];
        if (!allCards) {
            log(`[getCards] 缓存未命中，获取首页`);
            const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            allCards = [];
            const categorySpan = $(`span.fs-5.fw-bold:contains('${categoryName}')`);
            if (categorySpan.length === 0) { log(`[getCards] ❌ 找不到分类:"${categoryName}"`); return jsonify({ list: [] }); }

            let rowDiv = categorySpan.closest('div.d-flex').parent().next('div.row');
            if (rowDiv.length === 0) { rowDiv = categorySpan.closest('div.d-flex').next('div.row'); }
            if (rowDiv.length === 0) { log(`[getCards] ❌ 找不到row容器`); return jsonify({ list: [] }); }

            rowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                const imgElement = linkElement.find('img.lozad');
                allCards.push({
                    vod_id: linkElement.attr('href') || "",
                    vod_name: linkElement.find('h2').text().trim() || "",
                    vod_pic: getCorrectPicUrl(imgElement.attr('data-src')),
                    vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "",
                    ext: { url: linkElement.attr('href') || "" }
                });
            });

            cardsCache[cacheKey] = allCards;
        }
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        return jsonify({ list: allCards.slice(startIdx, endIdx) });

    } catch (e) {
        log(`[getCards] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}



// ★★★★★【搜索：只保留 115 + 天翼】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });

    log(`[search] 关键词="${text}", 页=${page}`);

    const url = `${SITE_URL}/s/${encodeURIComponent(text)}/0/${page}`;
    log(`[search] URL: ${url}`);

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];
        let originalCount = 0;

        $("a.resource-item").each((idx, item) => {
            originalCount++;

            const link = $(item);
            const resourceLink = link.attr('href');
            const title = link.find('h2').text().trim();
            const panType = link.find('span.text-success').text().trim() || '未知';

            // ★★★ 只保留 115 和 天翼 ★★★
            if (!panType.includes("115") && !panType.includes("天翼")) {
                log(`[search] ❌ 过滤非115/天翼: ${panType} - ${title}`);
                return;
            }

            cards.push({
                vod_id: resourceLink,
                vod_name: title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: `[${panType}]`,
                ext: { url: resourceLink }
            });
        });

        log(`[search] ✓ 原始=${originalCount}, 保留=${cards.length} (仅115/天翼)`);

        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}



// ★★★★★【详情页】(保持不变)★★★★★
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
            if (result.real_url.includes('115')) panName = '115 网盘';
            if (result.real_url.includes('cloud.189.cn')) panName = '天翼云盘';

            return jsonify({
                list: [
                    {
                        title: '解析成功',
                        tracks: [
                            { name: panName, pan: result.real_url, ext: {} }
                        ]
                    }
                ]
            });
        }

    } catch (e) {
        return jsonify({
            list: [
                { title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }
            ]
        });
    }
}



// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 插件加载完成 V1.7.1 (仅115+天翼) ====');
