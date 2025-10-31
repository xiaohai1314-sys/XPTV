/**
 * 4k热播影视 前端插件 - V3.0.2 (首页缓存模式修正版)
 *
 * 核心变更:
 * - 修正 getCards 函数的缓存逻辑，完全对标 V35 脚本。
 * - 引入单一的 homeCache 变量，只请求一次首页HTML，后续所有分类解析均从该缓存中读取。
 * - 彻底解决分类页UI不显示或加载缓慢的问题。
 * - search 函数的分页逻辑保持不变。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.107:3000/search"; 
const SITE_URL = "https://reboys.cn";
const PAGE_SIZE = 24;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// --- 【修正】全局缓存区 ---
let homeCache = null; // 用于缓存首页完整HTML
let searchCache = {}; // 用于缓存搜索结果

// --- 辅助函数 (保持不变) ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http' )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- App 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V3.0.2 (缓存模式修正版) ====");
    // 插件重载时清空所有缓存
    homeCache = null; 
    searchCache = {};
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: "3.0.2",
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - V35缓存模式正确实现】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = ext.page || 1;

    try {
        // 1. 检查首页HTML缓存是否存在
        if (!homeCache) {
            log(`[getCards] 首次加载，正在请求首页HTML...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data; // 将完整的HTML原文存入缓存
            log(`[getCards] ✓ 首页HTML已缓存`);
        } else {
            log(`[getCards] ✓ 从缓存中加载首页HTML`);
        }

        // 2. 使用 cheerio 加载缓存中的HTML
        const $ = cheerio.load(homeCache);
        const cards = [];

        // 3. 从HTML中解析出对应分类的全部数据
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

        // 4. 对从HTML中提取出的完整列表进行前端分页
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = cards.slice(start, end);
        
        log(`[getCards] 分类ID ${categoryId}，请求第 ${page} 页，返回 ${pageData.length} / ${cards.length} 条数据`);
        return jsonify({ list: pageData });
        
    } catch (e) {
        homeCache = null; // 如果发生错误，清空缓存以便下次重试
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索功能 - 分页逻辑保持不变】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = ext.page || 1;
    const cacheKey = `search_${searchText}`;

    if (searchCache[cacheKey]) {
        log(`[search] ✓ 从缓存中命中关键词: "${searchText}"`);
        const fullData = searchCache[cacheKey];
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
                vod_id: item.links[0].url, vod_name: item.title, vod_pic: FALLBACK_PIC,
                vod_remarks: item.datetime ? new Date(item.datetime).toLocaleDateString() : '未知时间',
                ext: { url: item.links[0].url }
            };
        }).filter(card => card !== null);

        if (cards.length > 0) {
            searchCache[cacheKey] = cards;
            log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片，并已存入缓存`);
        }

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

// ... 其他函数 getTracks, init, home, category, detail, play 保持不变 ...
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
