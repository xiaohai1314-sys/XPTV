/**
 * 找盘资源前端插件 - V-Final-V3 (优化重构版)
 * 核心功能：
 *  1. 调用后端 /api/search 实现高性能、智能分页搜索。
 *  2. 实现精确分页控制 (hasmore, pagecount) 和分页锁 (SEARCH_END)。
 *  3. 调用后端 /api/get_real_url 实现高效链接解析。
 *
 * @version V3 - Refactored by Manus
 * @changes
 *  - 统一配置管理 (CONFIG object)
 *  - 增强错误日志记录
 *  - 优化 API URL 的构建方式，使其更健壮
 */

// --- 配置区 ---
const CONFIG = {
    // 【重要】请务必修改为您的后端服务器地址
    API_BASE_URL: "http://192.168.10.102:3004",
    SITE_URL: "https://v2pan.com",
    UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    FALLBACK_PIC: "https://v2pan.com/favicon.ico",
    DEBUG: true,
    // 首页每个分类展示的总数量（前端分页 ）
    HOME_CATEGORY_TOTAL: 36,
    // 首页每次加载更多时，每页显示的数量
    HOME_PAGE_SIZE: 12,
    // 【重要】搜索分页大小，必须与后端定义的 SEARCH_PAGE_SIZE 保持一致
    SEARCH_PAGE_SIZE: 30,
};

// --- 全局缓存与状态 ---
let cardsCache = {}; // 首页分类数据缓存
let SEARCH_END = {}; // 搜索分页锁，记录已加载完毕的关键词

// --- 辅助函数 ---
function log(msg) {
    const logMsg = `[找盘插件] ${msg}`;
    try {
        // 尝试调用宿主环境的日志函数
        $log(logMsg);
    } catch (_) {
        if (CONFIG.DEBUG) console.log(logMsg);
    }
}
function argsify(ext) {
    if (typeof ext === 'string') {
        try {
            return JSON.parse(ext);
        } catch (e) {
            return {};
        }
    }
    return ext || {};
}
function jsonify(data) {
    return JSON.stringify(data);
}
function getCorrectPicUrl(path) {
    if (!path) return CONFIG.FALLBACK_PIC;
    if (path.startsWith('http' )) return path;
    return `${CONFIG.SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V-Final-V3 (优化重构版) ====");
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({
        ver: 1,
        title: '找盘',
        site: CONFIG.SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES
    });
}

// ★★★★★【首页分页】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    const url = CONFIG.SITE_URL;

    try {
        const cacheKey = `category_${categoryName}`;
        let allCards = cardsCache[cacheKey];

        if (!allCards) {
            log(`[getCards] 缓存未命中，正在抓取分类: ${categoryName}`);
            const { data } = await $fetch.get(url, { headers: { 'User-Agent': CONFIG.UA } });
            const $ = cheerio.load(data);
            allCards = [];
            const categorySpan = $(`span.fs-5.fw-bold:contains('${categoryName}')`);

            if (categorySpan.length === 0) {
                log(`[getCards] 警告: 在页面上未找到分类标题 "${categoryName}"`);
                return jsonify({ list: [] });
            }

            let rowDiv = categorySpan.closest('div.d-flex').parent().next('div.row');
            if (rowDiv.length === 0) rowDiv = categorySpan.closest('div.d-flex').next('div.row');
            if (rowDiv.length === 0) {
                 log(`[getCards] 警告: 未找到分类 "${categoryName}" 对应的内容区域`);
                return jsonify({ list: [] });
            }

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
            // 限制首页每个分类的总数量，防止缓存过大
            cardsCache[cacheKey] = allCards.slice(0, CONFIG.HOME_CATEGORY_TOTAL);
        }

        const startIdx = (page - 1) * CONFIG.HOME_PAGE_SIZE;
        const endIdx = startIdx + CONFIG.HOME_PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);

        return jsonify({ list: pageCards });
    } catch (e) {
        log(`[getCards] ❌ 获取分类 "${categoryName}" 第 ${page} 页时发生错误: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索 - 调用后端超级搜索】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!text) return jsonify({ list: [] });

    if (page > 1 && SEARCH_END[text]) {
        log(`[search] 关键词 "${text}" 已锁定，第 ${page} 页不再请求。`);
        return jsonify({ list: [], page: page, pagecount: page, hasmore: false });
    }
    if (page === 1) {
        delete SEARCH_END[text];
    }

    log(`[search] 调用后端，关键词="${text}", 页码=${page}`);
    const searchApiUrl = `${CONFIG.API_BASE_URL}/api/search?keyword=${encodeURIComponent(text)}&page=${page}`;

    try {
        const { data } = await $fetch.get(searchApiUrl);
        const result = JSON.parse(data);

        if (!result.success || !Array.isArray(result.list)) {
            log(`[search] ❌ 后端返回数据格式错误或失败`);
            return jsonify({ list: [] });
        }

        const cards = result.list;
        let hasMore = true;

        if (cards.length < CONFIG.SEARCH_PAGE_SIZE) {
            hasMore = false;
            SEARCH_END[text] = true;
            log(`[search] 关键词 "${text}" 已到达最后一页，锁定翻页。`);
        }

        log(`[search] 返回 ${cards.length} 条结果, hasMore=${hasMore}`);

        return jsonify({
            list: cards,
            page: page,
            pagecount: hasMore ? page + 1 : page,
            hasmore: hasMore
        });

    } catch (e) {
        log(`[search] ❌ 请求后端搜索接口时发生异常: ${e.message}`);
        // 发生网络等异常时，也认为没有更多数据，防止App无限重试
        return jsonify({ list: [], page: page, pagecount: page, hasmore: false });
    }
}

// ★★★★★【详情页】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const middleUrl = getCorrectPicUrl(url);

    try {
        const apiUrl = `${CONFIG.API_BASE_URL}/api/get_real_url?url=${encodeURIComponent(middleUrl)}`;
        const response = await $fetch.get(apiUrl);
        const result = JSON.parse(response.data);

        if (result.success && result.real_url) {
            let panName = '网盘链接';
            if (result.real_url.includes('quark')) panName = '夸克网盘';
            else if (result.real_url.includes('baidu')) panName = '百度网盘';
            else if (result.real_url.includes('aliyundrive')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: result.real_url, ext: {} }] }] });
        } else {
            throw new Error(result.error || 'API returned success:false');
        }
    } catch (e) {
        log(`[getTracks] ❌ 自动解析详情页 "${middleUrl}" 失败: ${e.message}`);
        return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }] });
    }
}

// --- 兼容接口 (保持不变) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 插件加载完成 V-Final-V3 (优化重构版) ====');
