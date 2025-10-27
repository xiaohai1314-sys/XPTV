/**
 * 找盘资源前端插件 - V1.3 (完整修复版)
 * 修复内容：
 * 1. 实现首页分页，解决无限循环问题
 * 2. 搜索结果直接返回网盘链接（跳过中间页面）
 * 
 * 关键发现：
 * - v2pan.com 的搜索结果链接 /m/resource/view?id=xxx 
 * - 会自动重定向到实际的网盘分享链接（如夸克网盘、百度网盘等）
 * - 所以我们不需要解析中间页面，直接返回这个URL即可
 */

// --- 配置区 ---
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;  // 每页12个卡片

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[找盘资源] ${msg}`;
    try { 
        $log(logMsg); 
    } catch (_) { 
        if (DEBUG) console.log(logMsg); 
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
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http')) return path;
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- 全局缓存 ---
let cardsCache = {};

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (V1.3 完整修复版)");
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({
        ver: 1,
        title: '找盘',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【V1.3 修复：首页分页】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    const url = SITE_URL;
    
    log(`[getCards] 获取分类: "${categoryName}", 页码: ${page}`);
    
    try {
        // 检查缓存
        const cacheKey = `category_${categoryName}`;
        let allCards = cardsCache[cacheKey];

        if (!allCards) {
            log(`[getCards] 缓存未命中，重新获取首页`);
            
            const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            allCards = [];

            const categorySpan = $(`span.fs-5.fw-bold:contains('${categoryName}')`);
            
            if (categorySpan.length === 0) {
                log(`[getCards] 找不到分类: "${categoryName}"`);
                return jsonify({ list: [] });
            }

            log(`[getCards] 找到分类，开始提取卡片`);

            const rowDiv = categorySpan
                .closest('div.d-flex')
                .parent()
                .next('div.row');

            if (rowDiv.length === 0) {
                log(`[getCards] 使用备选方案定位row`);
                const altRowDiv = categorySpan
                    .closest('div.d-flex')
                    .next('div.row');
                
                if (altRowDiv.length === 0) {
                    log(`[getCards] 错误: 仍找不到row容器`);
                    return jsonify({ list: [] });
                }

                altRowDiv.find('a.col-4').each((_, item) => {
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
            } else {
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
            }

            // 缓存结果
            cardsCache[cacheKey] = allCards;
            log(`[getCards] 缓存卡片: ${allCards.length} 个`);
        }

        // 【修复关键】实现分页逻辑
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);

        log(`[getCards] 总数: ${allCards.length}, 当前页: ${page}, 返回: ${pageCards.length} 个`);

        // 当返回空列表时，App会停止分页
        return jsonify({ list: pageCards });
        
    } catch (e) {
        log(`[getCards] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V1.3 修复：搜索功能】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;

    if (!text) {
        log(`[search] 搜索词为空`);
        return jsonify({ list: [] });
    }

    log(`[search] 搜索: "${text}", 页: ${page}`);
    
    const url = `${SITE_URL}/s?q=${encodeURIComponent(text)}`;

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        $("a.resource-item").each((idx, item) => {
            const linkElement = $(item);
            const resourceLink = linkElement.attr('href');
            const title = linkElement.find('h2').text().trim();
            const panType = linkElement.find('span.text-success').text().trim() || '未知';
            
            if (resourceLink && title) {
                cards.push({
                    vod_id: resourceLink,
                    vod_name: title,
                    vod_pic: FALLBACK_PIC,
                    vod_remarks: `[${panType}]`,
                    ext: { url: resourceLink, isDirectLink: false }
                });
            }
        });

        log(`[search] 找到 ${cards.length} 个结果`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V1.3 修复：网盘链接提取】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url, isDirectLink } = ext;
    
    if (!url) {
        log(`[getTracks] URL为空`);
        return jsonify({ list: [] });
    }

    log(`[getTracks] 处理URL: ${url}`);

    try {
        const fullUrl = getCorrectPicUrl(url);
        
        // 【关键修复】
        // v2pan.com 的 /m/resource/view?id=xxx 会自动重定向到实际的网盘链接
        // 所以我们只需要返回这个URL，让App的WebView打开它
        // App会自动跟随重定向到真实的网盘分享页面（如夸克网盘、百度网盘等）
        
        log(`[getTracks] 返回网盘重定向链接: ${fullUrl}`);
        
        return jsonify({ 
            list: [{ 
                title: '资源', 
                tracks: [{ 
                    name: '打开网盘',
                    pan: fullUrl,  // 直接返回这个URL，会自动跳转到网盘
                    ext: {} 
                }] 
            }] 
        });
        
    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "加载失败", pan: '', ext: {} }] }] });
    }
}

// --- 兼容接口 ---
async function init() { 
    return getConfig(); 
}

async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}

async function detail(id) { 
    log(`[detail] 获取详情: ${id}`);
    return getTracks({ url: id }); 
}

async function play(flag, id) { 
    log(`[play] 打开: ${id}`);
    return jsonify({ url: id }); 
}

log('找盘资源插件加载完成 (V1.3)');
