/**
 * 找盘资源前端插件 - V1.7.0 (夸克筛选+优先级排序版)
 * 变更内容：
 *  - 对夸克网盘资源增加画质筛选（1080P、4K、原盘、REMUX、次世代、杜比、UHD、蓝光）
 *  - 对夸克网盘资源进行优先级排序（4K > 原盘 > REMUX > 杜比 > UHD > 蓝光 > 次世代 > 1080P）
 *  - 其他网盘（115、天翼、阿里、UC等）不过滤
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.105:3000/api/get_real_url"; 
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

// --- 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V1.7.0 (夸克筛选+优先级排序) ====");
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// ★★★★★【首页分页】(保持不变) ★★★★★
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
            log(`[getCards] ✓ 找到分类，提取卡片`);
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

// ★★★★★【搜索 - 夸克筛选+排序】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    if (!text) {
        log(`[search] 搜索词为空`);
        return jsonify({ list: [] });
    }

    log(`[search] 关键词="${text}", 页=${page}`);
    const filter = 0;
    const url = `${SITE_URL}/s/${encodeURIComponent(text)}/${filter}/${page}`;
    log(`[search] URL: ${url}`);

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];
        let originalCount = 0;

        // 优先级定义（越靠前优先级越高）
        const qualityOrder = ['4K', '原盘', 'REMUX', '杜比', 'UHD', '蓝光', '次世代', '1080P'];

        $("a.resource-item").each((idx, item) => {
            originalCount++;
            const linkElement = $(item);
            const resourceLink = linkElement.attr('href');
            const title = linkElement.find('h2').text().trim();
            const panType = linkElement.find('span.text-success').text().trim() || '未知';

            // 排除迅雷和百度网盘
            if (panType.includes('迅雷') || panType.includes('百度')) {
                log(`[search] 过滤掉 [${panType}] 资源: ${title}`);
                return;
            }

            // --- 夸克网盘画质筛选 ---
            if (panType.includes('夸克')) {
                const qualityKeywords = ['1080P', '4K', '原盘', 'REMUX', '次世代', '杜比', 'UHD', '蓝光'];
                const matchedKeyword = qualityKeywords.find(q => title.toUpperCase().includes(q.toUpperCase()));
                if (!matchedKeyword) {
                    log(`[search] 夸克资源未匹配画质关键词，跳过: ${title}`);
                    return;
                }
                // 添加匹配关键字用于排序
                cards.push({
                    vod_id: resourceLink,
                    vod_name: title,
                    vod_pic: FALLBACK_PIC,
                    vod_remarks: `[${panType}]`,
                    ext: { url: resourceLink },
                    _quality: matchedKeyword
                });
            } else {
                // 其他网盘保留
                if (resourceLink && title) {
                    cards.push({
                        vod_id: resourceLink,
                        vod_name: title,
                        vod_pic: FALLBACK_PIC,
                        vod_remarks: `[${panType}]`,
                        ext: { url: resourceLink },
                        _quality: '其他'
                    });
                }
            }
        });

        // --- 排序逻辑（仅夸克资源） ---
        cards.sort((a, b) => {
            const aQ = qualityOrder.indexOf(a._quality);
            const bQ = qualityOrder.indexOf(b._quality);
            if (aQ === -1 && bQ === -1) return 0;
            if (aQ === -1) return 1;
            if (bQ === -1) return -1;
            return aQ - bQ;
        });

        log(`[search] ✓ 第${page}页找到${originalCount}个原始结果, 过滤后保留${cards.length}个`);
        return jsonify({ list: cards.map(({ _quality, ...rest }) => rest) }); // 移除临时字段

    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页】(保持不变) ★★★★★
async function getTracks(ext) {
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
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { log(`[detail] 详情ID: ${id}`); return getTracks({ url: id }); }
async function play(flag, id) { log(`[play] 直接播放: ${id}`); return jsonify({ url: id }); }

log('==== 插件加载完成 V1.7.0 ====');
