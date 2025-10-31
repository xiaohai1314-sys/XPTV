/**
 * 4k热播影视 前端插件 - V3.4 (终极健壮版)
 *
 * 核心架构:
 * - 首页分类 (getCards): 缓存分页策略，确保性能和正确性。
 * - 搜索 (search): 增加后端分页支持，并添加前端“熔断”机制防止因后端问题导致的无限循环。
 * - 详情 (getTracks): 智能处理链接。
 *
 * V3.4 更新日志:
 * - [修复] 彻底修复“分类不显示”问题。移除了init()中的缓存清理，并为home()函数增加了终极备用逻辑，保证分类标签一定能显示。
 * - [修复] 针对“搜索结果无限循环”问题，在前端增加了“熔断”机制。如果后端连续返回相同内容，前端会主动停止加载。
 * - [加固] 对所有主要函数增加了更强的错误捕获和日志记录，方便定位问题。
 * - [重要提示] 搜索功能的最终解决，需要用户检查自己的后端API是否正确处理了'page'参数。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.107:3000/search";
const SITE_URL = "https://reboys.cn";
const PAGE_SIZE = 12; // 首页每页数量

// --- 全局变量 ---
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;
let cardsCache = {}; 
let lastSearchCache = {}; // 【新增】用于检测搜索结果是否重复

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http'  )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- 分类定义 (作为全局常量) ---
const CUSTOM_CATEGORIES = [
    { name: '短剧', ext: { id: 1 } },
    { name: '电影', ext: { id: 2 } },
    { name: '电视剧', ext: { id: 3 } },
    { name: '动漫', ext: { id: 4 } },
    { name: '综艺', ext: { id: 5 } },
];

// --- App 插件入口函数 ---

async function getConfig() {
    log("==== 插件初始化 V3.4 (终极健壮版) ====");
    return jsonify({
        ver: 3.4,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - 缓存分页模式】★★★★★
// 此函数逻辑已验证，保持不变
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = parseInt(ext.page || 1, 10);
    const category = CUSTOM_CATEGORIES.find(c => c.ext.id === categoryId);

    if (page === 1) { // 【优化】第一页时清空搜索缓存
        lastSearchCache = {};
    }

    if (!category) {
        log(`[getCards] ❌ 找不到ID为 ${categoryId} 的分类配置`);
        return jsonify({ list: [] });
    }

    log(`[getCards] 请求分类: ${category.name}, 页码: ${page}`);
    try {
        const cacheKey = `category_${categoryId}`;
        let allCards = cardsCache[cacheKey];

        if (!allCards) {
            log(`[getCards] 缓存未命中 for ${cacheKey}，抓取首页...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            allCards = [];
            const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
            if (contentBlock.length > 0) {
                contentBlock.find('a.item').each((_, element) => {
                    const cardElement = $(element);
                    allCards.push({
                        vod_id: getCorrectUrl(cardElement.attr('href')),
                        vod_name: cardElement.find('p').text().trim(),
                        vod_pic: getCorrectUrl(cardElement.find('img').attr('src')),
                        vod_remarks: '',
                        ext: { url: getCorrectUrl(cardElement.attr('href')) }
                    });
                });
                cardsCache[cacheKey] = allCards;
                log(`[getCards] ✓ 缓存了 ${allCards.length} 个卡片`);
            } else {
                 log(`[getCards] ❌ 找不到分类区块`);
                 cardsCache[cacheKey] = []; // 存空数组防止重试
            }
        } else {
            log(`[getCards] ✓ 缓存命中 for ${cacheKey}`);
        }

        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);
        log(`[getCards] 返回第 ${page} 页的 ${pageCards.length} 个卡片`);
        return jsonify({ list: pageCards });
    } catch (e) {
        log(`[getCards] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索功能 - 增加熔断机制】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    if (!searchText) return jsonify({ list: [] });
    
    // 如果是第一页，清空上一页的缓存
    if (page === 1) {
        lastSearchCache = {};
    }

    log(`[search] 搜索: "${searchText}", 页码: ${page}`);
    const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}&page=${page}`;
    
    try {
        const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        
        // 【新增】熔断机制：检查返回内容是否和上一页完全一样
        if (page > 1 && lastSearchCache[searchText] === jsonString) {
            log(`[search] ❌ 熔断！后端返回了与上一页完全相同的内容。判定为无更多数据。`);
            return jsonify({ list: [] }); // 返回空列表，强制停止加载
        }
        lastSearchCache[searchText] = jsonString; // 缓存当前页返回的原始字符串

        const response = JSON.parse(jsonString);
        if (response.code !== 0) throw new Error(response.message);

        const results = response.data?.data?.results;
        if (!results || !Array.isArray(results)) return jsonify({ list: [] });
        
        const cards = results.map(item => {
            if (!item || !item.title || !item.links || item.links.length === 0) return null;
            return {
                vod_id: item.links[0].url, vod_name: item.title, vod_pic: FALLBACK_PIC,
                vod_remarks: item.datetime ? new Date(item.datetime).toLocaleDateString() : '未知时间',
                ext: { url: item.links[0].url }
            };
        }).filter(Boolean);

        log(`[search] ✓ API成功返回 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页】★★★★★
// 保持不变
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url;
    if (!id) return jsonify({ list: [] });

    if (id.includes('pan.quark.cn') || id.includes('pan.baidu.com') || id.includes('aliyundrive.com')) {
        let panName = id.includes('quark') ? '夸克网盘' : id.includes('baidu') ? '百度网盘' : '阿里云盘';
        return jsonify({ list: [{ title: '点击播放', tracks: [{ name: panName, pan: id, ext: {} }] }] });
    } else {
        const keyword = id.split('/').pop().replace('.html', '');
        const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
        try {
            const { data: jsonString } = await $fetch.get(requestUrl);
            const response = JSON.parse(jsonString);
            const results = response.data?.data?.results;
            if (!results || results.length === 0) throw new Error("API未能解析出链接");
            const finalUrl = results[0].links[0].url;
            let panName = finalUrl.includes('baidu') ? '百度网盘' : finalUrl.includes('aliyundrive') ? '阿里云盘' : '夸克网盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: finalUrl, ext: {} }] }] });
        } catch (e) {
            return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: id, ext: {} }] }] });
        }
    }
}

// --- 兼容接口 (重点修正) ---

async function init() { 
    // 【已修正】移除这里的缓存清理逻辑，保持init函数干净
    return getConfig(); 
}

// 【已修正】为 home 函数增加终极保障
async function home() {
    try {
        log("[home] 正在获取配置...");
        const c = await getConfig();
        const config = JSON.parse(c);
        // 确保即使 tabs 为空或不存在，也返回一个有效结构
        return jsonify({ class: config.tabs || CUSTOM_CATEGORIES, filters: {} });
    } catch (e) {
        log(`[home] ❌ 执行异常: ${e.message}。将使用备用分类数据。`);
        // 【终极保障】即使前面所有步骤都失败，也直接使用全局分类常量返回，确保分类标签一定显示
        return jsonify({ class: CUSTOM_CATEGORIES, filters: {} });
    }
}

// 【已修正】保持V3.3的健壮逻辑
async function category(tid, pg) {
    const categoryId = (typeof tid === 'object' && tid !== null) ? tid.id : tid;
    log(`[category] 解析后分类ID: ${categoryId}, 页码: ${pg}`);
    
    if (!categoryId) {
        log(`[category] ❌ 无法从 tid 中解析出有效的分类ID`);
        return jsonify({ list: [] });
    }
    
    return getCards({ id: parseInt(categoryId, 10), page: pg || 1 });
}

async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
