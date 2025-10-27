/**
 * 找盘资源前端插件 - V1.1 (修复版)
 *
 * 版本说明:
 * - 【V1.1 修正】根据用户反馈，修复了首页无内容和搜索无列表的问题。
 * - 【首页修复】优化了 `getCards` 函数的选择器逻辑，使其能准确抓取到分类下的海报列表。
 * - 【搜索修复】重构了 `search` 函数，使其直接返回一个包含所有搜索结果的详细列表，而不是聚合卡片。
 * - 【详情页优化】调整了 `getTracks` 函数，使其能够处理最终资源页并提取直接的网盘链接。
 */

// --- 配置区 ---
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";

// --- 辅助函数 (保留 ) ---
function log(msg) { try { $log(`[找盘资源 V1.1] ${msg}`); } catch (_) { console.log(`[找盘资源 V1.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http' )) return path;
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化");
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({
        ver: "1.1",
        title: '找盘',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【V1.1 修正：首页内容获取】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName } = ext;
    const url = SITE_URL;
    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];
        const categoryHeaders = $('div.d-flex.justify-content-between');
        let targetRow = null;
        categoryHeaders.each((_, header) => {
            const currentCategory = $(header).find('span.fs-5.fw-bold').text().trim();
            if (currentCategory === categoryName) {
                targetRow = $(header).next('div.row');
                return false;
            }
        });
        if (targetRow) {
            targetRow.find('a.col-4').each((_, item) => {
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
        }
        log(`分类[${categoryName}]获取到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`获取首页分类[${categoryName}]异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V1.1 修正：搜索功能】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });
    log(`正在搜索: "${text}", 请求第 ${page} 页...`);
    const url = `${SITE_URL}/s/${encodeURIComponent(text)}`;
    log(`构建的请求URL: ${url}`);
    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];
        $("a.resource-item").each((_, item) => {
            const linkElement = $(item);
            const title = linkElement.find('h2').text().trim();
            const panType = linkElement.find('span.text-success').text().trim();
            const updateDate = linkElement.find('div.d-flex.align-items-center:last-child span').text().trim();
            cards.push({
                vod_id: linkElement.attr('href') || "",
                vod_name: title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: `[${panType}] 更新于: ${updateDate}`,
                ext: { url: linkElement.attr('href') || "" }
            });
        });
        log(`搜索“${text}”找到 ${cards.length} 条结果。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V1.1 修正：详情页网盘链接提取】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    // 首页和搜索列表的 vod_id/ext.url 格式不同，需要统一处理
    let requestUrl;
    if (url.startsWith('/s/')) { // 来自首页点击
        requestUrl = getCorrectPicUrl(url);
    } else { // 来自搜索结果点击
        requestUrl = getCorrectPicUrl(url);
    }
    
    log(`开始处理详情页: ${requestUrl}`);

    try {
        const { data } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        let tracks = [];

        // 首页点击进入的是搜索页，逻辑和搜索一样
        if (url.startsWith('/s/')) {
             $("a.resource-item").each((_, item) => {
                const linkElement = $(item);
                tracks.push({
                    name: linkElement.find('h2').text().trim(),
                    pan: getCorrectPicUrl(linkElement.attr('href')),
                    ext: {},
                });
            });
            return jsonify({ list: [{ title: '资源列表', tracks }] });
        }
        
        // 搜索结果点击进入的是最终页
        $('a.fs-4[href*="pan."]').each((_, item) => {
            const link = $(item).attr('href');
            let panName = '网盘链接';
            if (link.includes('quark.cn')) panName = '夸克网盘';
            else if (link.includes('aliyundrive.com')) panName = '阿里云盘';
            else if (link.includes('baidu.com')) panName = '百度网盘';
            else if (link.includes('189.cn')) panName = '天翼云盘';
            
            tracks.push({
                name: panName,
                pan: link,
                ext: {},
            });
        });

        if (tracks.length === 0) {
            tracks.push({ name: "未找到最终网盘链接，可能需要验证", pan: '', ext: {} });
        }

        return jsonify({ list: [{ title: '云盘直链', tracks }] });
    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败", pan: '', ext: {} }] }] });
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
    return getCards({ id: id, page: pg });
}
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('找盘资源插件加载完成');
