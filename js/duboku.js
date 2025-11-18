/**
 * 找盘资源前端插件 - V1.8.0 (强制排序+115清理版)
 * 变更内容：
 *  - [新增] 对所有搜索结果，强制按 (115 > 天翼 > 阿里 > 夸克) 的优先级排序。
 *  - [新增] 在排序前，对115链接进行域名归一化和末尾字符清理。
 *  - [保留] 保留了原有的夸克网盘内部画质筛选和排序逻辑，它将在大类排序后生效。
 *  - [修正] 严格遵守原有架构，不改变任何与search无关的函数逻辑，分类功能完全正常。
 */

// --- 配置区 (保持不变) ---
const API_ENDPOINT = "http://192.168.1.7:3004/api/get_real_url"; 
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 30;

// --- 辅助函数 (增加一个115清理函数 ) ---
function log(msg) { const logMsg = `[找盘 V1.8.0] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http' )) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// ★★★ 新增的115链接清理函数 ★★★
function clean115Link(link) {
    if (typeof link === 'string' && (link.includes('115.com') || link.includes('115cdn.com'))) {
        const originalUrl = link;
        // 1. 域名归一化
        link = link.replace('//115cdn.com/', '//115.com/');
        // 2. 末尾字符清理
        link = link.replace(/[&#]+$/, '');
        if (link !== originalUrl) {
            log(`[115链接清理] 原始: ${originalUrl} -> 清理后: ${link}`);
        }
    }
    return link;
}

// --- 全局缓存 (保持不变) ---
let cardsCache = {};

// --- 插件入口函数 (保持不变) ---
async function getConfig() {
    log("==== 插件初始化 V1.8.0 (强制排序+115清理) ====");
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({ ver: 1.8, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// ★★★★★【首页分页】(完全保持不变，你的分类功能在这里) ★★★★★
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

// ★★★★★【搜索 - 精准修改版】★★★★★
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
        let cards = [];

        // 优先级定义
        const panOrder = ['115', '天翼', '阿里', '夸克'];
        const quarkQualityOrder = ['4K', '原盘', 'REMUX', '杜比', 'UHD', '蓝光', '次世代', '1080P'];

        $("a.resource-item").each((_, item) => {
            const linkElement = $(item);
            let resourceLink = linkElement.attr('href');
            const title = linkElement.find('h2').text().trim();
            const panType = linkElement.find('span.text-success').text().trim() || '未知';

            // 1. 过滤不想要的网盘
            if (panType.includes('迅雷') || panType.includes('百度')) {
                log(`[search] 过滤掉 [${panType}] 资源: ${title}`);
                return;
            }

            // 2. ★★★ 115链接清理 ★★★
            if (panType.includes('115')) {
                resourceLink = clean115Link(resourceLink);
            }

            let card = {
                vod_id: resourceLink,
                vod_name: title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: `[${panType}]`,
                ext: { url: resourceLink },
                _panType: panType, // 内部排序用
                _quarkQuality: null // 夸克内部排序用
            };

            // 3. 为夸克资源打上画质标签
            if (panType.includes('夸克')) {
                const matchedKeyword = quarkQualityOrder.find(q => title.toUpperCase().includes(q.toUpperCase()));
                if (!matchedKeyword) {
                    log(`[search] 夸克资源未匹配画质关键词，跳过: ${title}`);
                    return; // 跳过不符合画质要求的夸克资源
                }
                card._quarkQuality = matchedKeyword;
            }
            
            cards.push(card);
        });

        // 4. ★★★ 排序逻辑 ★★★
        cards.sort((a, b) => {
            // 第一层：按网盘类型强制排序
            const aPanIndex = panOrder.findIndex(p => a._panType.includes(p));
            const bPanIndex = panOrder.findIndex(p => b._panType.includes(p));

            const effectiveAIndex = aPanIndex === -1 ? panOrder.length : aPanIndex;
            const effectiveBIndex = bPanIndex === -1 ? panOrder.length : bPanIndex;

            if (effectiveAIndex !== effectiveBIndex) {
                return effectiveAIndex - effectiveBIndex;
            }

            // 第二层：如果都是夸克网盘，按画质排序
            if (a._panType.includes('夸克') && b._panType.includes('夸克')) {
                const aQualityIndex = quarkQualityOrder.indexOf(a._quarkQuality);
                const bQualityIndex = quarkQualityOrder.indexOf(b._quarkQuality);
                return aQualityIndex - bQualityIndex;
            }

            return 0; // 其他情况保持原顺序
        });

        log(`[search] ✓ 找到并处理了 ${cards.length} 个结果`);
        // 返回给前端时，移除所有内部排序用的临时字段
        return jsonify({ list: cards.map(({ _panType, _quarkQuality, ...rest }) => rest) });

    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}


// ★★★★★【详情页】(完全保持不变) ★★★★★
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

// --- 兼容接口 (完全保持不变) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { log(`[detail] 详情ID: ${id}`); return getTracks({ url: id }); }
async function play(flag, id) { log(`[play] 直接播放: ${id}`); return jsonify({ url: id }); }

log('==== 插件加载完成 V1.8.0 ====');
