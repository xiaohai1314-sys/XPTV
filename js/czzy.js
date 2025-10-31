/**
 * 4k热播影视 前端插件 - V3.1 (混合模式 + 缓存优化)
 *
 * 核心架构:
 * - 增加前端缓存机制，避免对同一分类或关键词的重复网络请求，解决“无限加载”问题。
 * - 首页分类 (getCards): 抓取并解析HTML，结果会被缓存。
 * - 搜索 (search): 调用后端API，结果会被缓存。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.107:3000/search"; 
const SITE_URL = "https://reboys.cn";

// ... 其他配置保持不变 ...
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// --- 【缓存】新增全局缓存对象 ---
let globalCache = {};

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http' )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- App 插件入口函数 ---

async function getConfig() {
    log("==== 插件初始化 V3.1 (缓存优化版) ====");
    // 【缓存】插件重载时清空缓存，确保数据最新
    globalCache = {}; 
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: "3.1",
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - HTML抓取模式 + 缓存】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const cacheKey = `category_${categoryId}`; // 为每个分类创建唯一的缓存键

    // 【缓存】检查缓存
    if (globalCache[cacheKey]) {
        log(`[getCards] ✓ 从缓存中命中分类ID: ${categoryId}`);
        return jsonify({ list: globalCache[cacheKey] });
    }

    log(`[getCards] 缓存未命中，请求分类ID: ${categoryId} (HTML抓取模式)`);

    try {
        const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        if (contentBlock.length === 0) { throw new Error(`找不到ID为 ${categoryId} 的内容块`); }

        contentBlock.find('a.item').each((_, element) => {
            const cardElement = $(element);
            cards.push({
                vod_id: getCorrectUrl(cardElement.attr('href')),
                vod_name: cardElement.find('p').text().trim(),
                vod_pic: getCorrectUrl(cardElement.find('img').attr('src')),
                vod_remarks: '',
                ext: { url: getCorrectUrl(cardElement.attr('href')) }
            });
        });

        // 【缓存】将结果存入缓存
        if (cards.length > 0) {
            globalCache[cacheKey] = cards;
            log(`[getCards] ✓ 成功提取 ${cards.length} 个卡片，并已存入缓存`);
        }
        
        return jsonify({ list: cards });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索功能 - 后端API模式 + 缓存】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const cacheKey = `search_${searchText}`; // 为每个搜索词创建唯一的缓存键

    // 【缓存】检查缓存
    if (globalCache[cacheKey]) {
        log(`[search] ✓ 从缓存中命中关键词: "${searchText}"`);
        return jsonify({ list: globalCache[cacheKey] });
    }

    log(`[search] 缓存未命中，搜索关键词: "${searchText}" (后端API模式)`);

    if (!searchText) return jsonify({ list: [] });

    const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}`;
    
    try {
        const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        const response = JSON.parse(jsonString);

        if (response.code !== 0) throw new Error(`后端服务返回错误: ${response.message}`);

        const results = response.data?.data?.results;
        if (!results || !Array.isArray(results)) throw new Error("在返回的JSON中找不到 results 数组");
        
        const cards = results.map(item => {
            if (!item || !item.title || !item.links || item.links.length === 0) return null;
            return {
                vod_id: item.links[0].url,
                vod_name: item.title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: item.datetime ? new Date(item.datetime).toLocaleDateString() : '未知时间',
                ext: { url: item.links[0].url }
            };
        }).filter(card => card !== null);

        // 【缓存】将结果存入缓存
        if (cards.length > 0) {
            globalCache[cacheKey] = cards;
            log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片，并已存入缓存`);
        }

        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 请求或解析时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ... getTracks, init, home, category, detail, play 等函数保持不变 ...
// (getTracks 函数不需要缓存，因为它要么是直接处理链接，要么是调用search的逻辑，而search本身已经有缓存了)
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url; 
    if (!id) {
        log(`[getTracks] ❌ URL为空`);
        return jsonify({ list: [] });
    }
    if (id.includes('pan.quark.cn') || id.includes('pan.baidu.com') || id.includes('aliyundrive.com')) {
        log(`[getTracks] ✓ 检测到最终网盘链接，直接使用: ${id}`);
        let panName = '网盘资源';
        if (id.includes('quark')) panName = '夸克网盘';
        else if (id.includes('baidu')) panName = '百度网盘';
        else if (id.includes('aliyundrive')) panName = '阿里云盘';
        return jsonify({
            list: [{ title: '点击播放', tracks: [{ name: panName, pan: id, ext: {} }] }]
        });
    } else {
        log(`[getTracks] 检测到中间页链接，需要请求后端API进行解析: ${id}`);
        const keyword = id.split('/').pop().replace('.html', '');
        // 复用 search 函数，这样能自动利用上搜索的缓存
        return search({ text: keyword });
    }
}
async function init() { return getConfig(); }
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
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}
async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}
