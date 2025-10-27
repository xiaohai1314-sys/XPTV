/**
 * 找盘资源前端插件 - V1.0 (基于夸父插件V5.4修改)
 *
 * 版本说明:
 * - 【V1.0 核心重构】根据用户需求，将插件从 'suenen.com' 适配到 'v2pan.com'。
 * - 【功能适配】重写了首页内容获取、搜索、详情页解析三大核心功能，以匹配新网站的HTML结构。
 * - 【保留框架】保留了原插件的函数结构和接口 (getConfig, getCards, search, getTracks等)，确保与App的兼容性。
 */

// --- 配置区 ---
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";

// --- 辅助函数 (保留 ) ---
function log(msg) { try { $log(`[找盘资源] ${msg}`); } catch (_) { console.log(`[找盘资源] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http' )) return path;
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (V1.0 for v2pan.com)");
    // v2pan.com 首页即为分类，我们可以在此定义不同的分类入口
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({
        ver: 1,
        title: '找盘',
        site: SITE_URL,
        cookie: '', // v2pan.com目前看起来不需要Cookie
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【V1.0 重构：首页内容获取】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName } = ext; // id 现在代表分类名，如 '电影'
    const url = SITE_URL; // 首页URL
    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        // 找到对应分类的标题，然后获取其后的资源列表
        $(`span.fs-5.fw-bold:contains('${categoryName}')`).closest('div.d-flex').next('div.row').find('a.col-4').each((_, item) => {
            const linkElement = $(item);
            const imgElement = linkElement.find('img.lozad');
            cards.push({
                vod_id: linkElement.attr('href') || "",
                vod_name: linkElement.find('h2').text().trim() || "",
                vod_pic: getCorrectPicUrl(imgElement.attr('data-src')),
                vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "",
                ext: { url: linkElement.attr('href') || "" }
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`获取首页分类[${categoryName}]异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V1.0 重构：详情页网盘链接提取】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = getCorrectPicUrl(url); // 确保是完整URL
    log(`开始处理详情页: ${detailUrl}`);

    try {
        // 注意：详情页是搜索结果页，需要解析出真正的资源页链接
        const { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const tracks = [];

        $('a.resource-item').each((_, item) => {
            const resourceLink = $(item).attr('href');
            const title = $(item).find('h2').text().trim();
            const panType = $(item).find('span.text-success').text().trim() || '未知网盘';
            
            tracks.push({
                name: `[${panType}] ${title}`,
                // pan 字段现在存放的是中间页链接，点击后需要进一步处理
                // 在 play 函数中，我们将直接返回这个链接让APP的WebView加载
                pan: getCorrectPicUrl(resourceLink), 
                ext: {},
            });
        });

        if (tracks.length === 0) {
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }

        return jsonify({ list: [{ title: '资源列表', tracks }] });
    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查网络", pan: '', ext: {} }] }] });
    }
}

// ★★★★★【V1.0 重构：搜索功能】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1; // v2pan.com 的分页似乎是通过JS加载或有不同URL，此处简化为只处理第一页

    if (!text) return jsonify({ list: [] });

    log(`正在搜索: "${text}", 请求第 ${page} 页...`);
    
    // 构建 v2pan.com 的搜索URL
    const url = `${SITE_URL}/s?q=${encodeURIComponent(text)}`;
    log(`构建的请求URL: ${url}`);

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        $("a.resource-item").each((_, item) => {
            const linkElement = $(item);
            const panType = linkElement.find('span.text-success').text().trim();
            cards.push({
                // vod_id 指向的是详情页，但v2pan的详情页就是搜索结果的列表
                // 为了能在详情页展示所有结果，我们将搜索词作为ID
                vod_id: `/s?q=${encodeURIComponent(text)}`,
                vod_name: linkElement.find('h2').text().trim() || "",
                // 搜索结果页没有海报图，使用默认图标
                vod_pic: FALLBACK_PIC, 
                vod_remarks: `[${panType}] ` + linkElement.find('.fs-7.text-secondary').text().trim() || "",
                ext: { url: `/s?q=${encodeURIComponent(text)}` }
            });
        });
        
        // 由于搜索结果页直接展示了所有网盘条目，为了避免重复，我们只返回一个聚合的卡片
        if (cards.length > 0) {
            return jsonify({ list: [{
                vod_id: `/s?q=${encodeURIComponent(text)}`,
                vod_name: `关于“${text}”的搜索结果`,
                vod_pic: FALLBACK_PIC,
                vod_remarks: `共找到 ${cards.length} 条相关资源`,
                ext: { url: `/s?q=${encodeURIComponent(text)}` }
            }] });
        }

        return jsonify({ list: [] });

    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}
async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    // 首页内容不分页，所以忽略 pg
    return getCards({ id: id, page: 1 });
}
async function detail(id) { return getTracks({ url: id }); }
// play函数现在直接返回详情页链接，让APP的WebView加载它
async function play(flag, id) { return jsonify({ url: id }); }

log('找盘资源插件加载完成 (V1.0)');

