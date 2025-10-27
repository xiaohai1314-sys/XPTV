/**
 * 找盘资源前端插件 - V1.7.2 (最终修正版)
 * 核心变更:
 * - 彻底修复 search 函数，使其能同时兼容普通搜索和筛选搜索两种调用方式。
 * - 确保在任何情况下都能正确获取搜索关键词，恢复基本搜索功能。
 */

// --- 配置区 ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
const API_ENDPOINT = "http://192.168.10.106:3000/api/get_real_url"; 
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 30;

// --- 辅助函数 (保持不变 ) ---
function log(msg) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http' )) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// --- 全局缓存 (保持不变) ---
let cardsCache = {};

// --- 插件入口函数 (保持不变) ---
async function getConfig() {
    log("==== 插件初始化 V1.7.2 (最终修正版) ====");
    const CUSTOM_CATEGORIES = [{ name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } }];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// ★★★★★【首页分页】(保持不变) ★★★★★
async function getCards(ext) {
    // ... 此函数保持不变 ...
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
            log(`[getCards] ✓ 找到分类，提取卡片`);
            let rowDiv = categorySpan.closest('div.d-flex').parent().next('div.row');
            if (rowDiv.length === 0) { rowDiv = categorySpan.closest('div.d-flex').next('div.row'); }
            if (rowDiv.length === 0) { log(`[getCards] ❌ 找不到row容器`); return jsonify({ list: [] }); }
            rowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                const imgElement = linkElement.find('img.lozad');
                allCards.push({ vod_id: linkElement.attr('href') || "", vod_name: linkElement.find('h2').text().trim() || "", vod_pic: getCorrectPicUrl(imgElement.attr('data-src')), vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "", ext: { url: linkElement.attr('href') || "" } });
            });
            cardsCache[cacheKey] = allCards;
            log(`[getCards] ✓ 缓存${allCards.length}个卡片`);
        }
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);
        log(`[getCards] 总数=${allCards.length}, 返回=${pageCards.length}个 (页码${page})`);
        return jsonify({ list: pageCards });
    } catch (e) {
        log(`[getCards] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索 - 核心改造】★★★★★
async function search(ext) {
    // 【关键修正】兼容处理两种搜索场景的传参
    // 普通搜索: ext = { text: '关键词', page: 1 }
    // 筛选搜索: ext = { wd: '关键词', pg: 1, quark_quality: '4K' }
    const keyword = ext.text || ext.wd || '';
    const page = ext.page || ext.pg || 1;
    const quarkFilter = ext.quark_quality || 'all';

    if (!keyword) {
        log(`[search] 搜索词为空`);
        return jsonify({ list: [] });
    }

    log(`[search] 关键词="${keyword}", 页=${page}, 夸克筛选="${quarkFilter}"`);
    
    const filter = 0;
    const url = `${SITE_URL}/s/${encodeURIComponent(keyword)}/${filter}/${page}`;
    
    log(`[search] URL: ${url}`);

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];
        let originalCount = 0;

        $("a.resource-item").each((idx, item) => {
            originalCount++;
            const linkElement = $(item);
            const resourceLink = linkElement.attr('href');
            const title = linkElement.find('h2').text().trim();
            const panType = linkElement.find('span.text-success').text().trim() || '未知';
            
            if (panType.includes('迅雷') || panType.includes('百度')) {
                return;
            }

            if (panType.includes('夸克') && quarkFilter !== 'all') {
                const upperTitle = title.toUpperCase();
                const upperFilter = quarkFilter.toUpperCase();
                if (!upperTitle.includes(upperFilter)) {
                    return;
                }
            }

            if (resourceLink && title) {
                cards.push({
                    vod_id: resourceLink,
                    vod_name: title,
                    vod_pic: FALLBACK_PIC,
                    vod_remarks: `[${panType}]`,
                    ext: { url: resourceLink }
                });
            }
        });

        log(`[search] ✓ 第${page}页找到${originalCount}个原始结果, 过滤后保留${cards.length}个`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页】(保持不变) ★★★★★
async function getTracks(ext) {
    // ... 此函数保持不变 ...
    ext = argsify(ext);
    const { url } = ext;
    if (!url) { log(`[getTracks] ❌ URL为空`); return jsonify({ list: [] }); }
    const middleUrl = getCorrectPicUrl(url);
    log(`[getTracks] 将请求后端API解析: ${middleUrl}`);
    try {
        const apiUrl = `${API_ENDPOINT}?url=${encodeURIComponent(middleUrl)}`;
        const response = await $fetch.get(apiUrl);
        const result = JSON.parse(response.data);
        if (result.success && result.real_url) {
            log(`[getTracks] ✓ 后端API成功返回真实链接: ${result.real_url}`);
            let panName = '网盘链接';
            if (result.real_url.includes('quark')) panName = '夸克网盘';
            else if (result.real_url.includes('baidu')) panName = '百度网盘';
            else if (result.real_url.includes('aliyundrive')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: result.real_url, ext: {} }] }] });
        } else {
            log(`[getTracks] ❌ 后端API返回错误: ${result.error || '未知错误'}`);
            throw new Error(result.error || 'API did not return a real URL');
        }
    } catch (e) {
        log(`[getTracks] ❌ 请求后端API时发生异常: ${e.message}`);
        return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }] });
    }
}

// --- 兼容接口 (保持不变) ---
async function init() { 
    return getConfig(); 
}

const quarkQualityFilter = {
    "key": "quark_quality", "name": "夸克质量",
    "value": [
        { "n": "全部", "v": "all" }, { "n": "1080P", "v": "1080P" }, { "n": "4K", "v": "4K" },
        { "n": "蓝光", "v": "蓝光" }, { "n": "原盘", "v": "原盘" }, { "n": "REMUX", "v": "REMUX" },
        { "n": "UHD", "v": "UHD" }, { "n": "杜比", "v": "杜比" }, { "n": "次世代", "v": "次世代" }
    ]
};

async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: { "all": [quarkQualityFilter] } });
}

async function category(tid, pg, filter, ext) {
    // 筛选搜索时，App会调用此函数
    ext.pg = pg; // 将页码补充到ext中
    return search(ext);
}

async function detail(id) { 
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}

async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}

log('==== 插件加载完成 V1.7.2 ====');
