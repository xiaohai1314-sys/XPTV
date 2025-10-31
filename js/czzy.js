/**
 * 4k热播影视 前端插件 - V3.0.1 (分页修复版)
 *
 * 核心变更:
 * - 基于 V3.0 版本，只修复“无限循环”问题。
 * - 引入前端缓存和前端模拟分页逻辑。
 * - 当App请求的页码超出数据总量时，返回空列表，从而告知App停止加载。
 * - 其他所有逻辑与 V3.0 保持一致。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.107:3000/search"; // 【重要】请替换成您的后端服务地址
const SITE_URL = "https://reboys.cn";

// --- 分页配置 ---
const PAGE_SIZE = 24; // 每页显示24个项目 ，您可以根据喜好调整

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// --- 【新增】全局缓存对象 ---
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
    log("==== 插件初始化 V3.0.1 (分页修复版) ====");
    // 插件重载时清空缓存
    globalCache = {}; 
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: "3.0.1",
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - 已集成前端分页】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = ext.page || 1; // 获取App请求的页码
    const cacheKey = `category_${categoryId}`;

    // 检查缓存中是否已有完整数据
    if (globalCache[cacheKey]) {
        log(`[getCards] ✓ 从缓存中命中分类ID: ${categoryId}`);
        const fullData = globalCache[cacheKey];
        
        // --- 分页逻辑 ---
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = fullData.slice(start, end);
        
        log(`[getCards] 请求第 ${page} 页，返回 ${pageData.length} 条数据`);
        return jsonify({ list: pageData });
    }

    log(`[getCards] 缓存未命中，首次请求分类ID: ${categoryId}`);

    try {
        const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        if (contentBlock.length === 0) throw new Error(`找不到ID为 ${categoryId} 的内容块`);

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

        // 将首次获取的完整数据存入缓存
        if (cards.length > 0) {
            globalCache[cacheKey] = cards;
            log(`[getCards] ✓ 成功提取 ${cards.length} 个卡片，并已存入缓存`);
        }
        
        // --- 分页逻辑 (首次加载) ---
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = cards.slice(start, end);
        
        log(`[getCards] 首次请求第 ${page} 页，返回 ${pageData.length} 条数据`);
        return jsonify({ list: pageData });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索功能 - 已集成前端分页】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = ext.page || 1; // 获取App请求的页码
    const cacheKey = `search_${searchText}`;

    // 检查缓存中是否已有完整数据
    if (globalCache[cacheKey]) {
        log(`[search] ✓ 从缓存中命中关键词: "${searchText}"`);
        const fullData = globalCache[cacheKey];

        // --- 分页逻辑 ---
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = fullData.slice(start, end);

        log(`[search] 请求第 ${page} 页，返回 ${pageData.length} 条数据`);
        return jsonify({ list: pageData });
    }

    log(`[search] 缓存未命中，首次搜索关键词: "${searchText}"`);

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

        // 将首次获取的完整数据存入缓存
        if (cards.length > 0) {
            globalCache[cacheKey] = cards;
            log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片，并已存入缓存`);
        }

        // --- 分页逻辑 (首次加载) ---
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = cards.slice(start, end);

        log(`[search] 首次请求第 ${page} 页，返回 ${pageData.length} 条数据`);
        return jsonify({ list: pageData });

    } catch (e) {
        log(`[search] ❌ 请求或解析时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页 - 逻辑与V3.0保持一致】★★★★★
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
        const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
        
        try {
            const { data: jsonString } = await $fetch.get(requestUrl);
            const response = JSON.parse(jsonString);
            const results = response.data?.data?.results;

            if (!results || results.length === 0) throw new Error("API未能解析出有效链接");

            const finalUrl = results[0].links[0].url;
            log(`[getTracks] ✓ API成功解析出链接: ${finalUrl}`);
            
            let panName = '夸克网盘';
            if (finalUrl.includes('baidu')) panName = '百度网盘';
            else if (finalUrl.includes('aliyundrive')) panName = '阿里云盘';

            return jsonify({
                list: [{ title: '解析成功', tracks: [{ name: panName, pan: finalUrl, ext: {} }] }]
            });

        } catch (e) {
            log(`[getTracks] ❌ 解析中间页时发生异常: ${e.message}`);
            return jsonify({
                list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: id, ext: {} }] }]
            });
        }
    }
}


// --- 兼容接口 (与V3.0保持一致) ---
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
