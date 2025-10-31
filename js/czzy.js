/**
 * 4k热播影视 前端插件 - V3.3 (健壮性修复版)
 *
 * 核心架构:
 * - 首页分类 (getCards): 采用“一次性抓取+前端缓存分页”策略。
 * - 搜索 (search): 调用 Puppeteer 后端API，并正确传递分页参数。
 * - 详情 (getTracks): 智能处理中间页和最终页链接。
 *
 * V3.3 更新日志:
 * - [修复] 首页分类标签不显示的问题。通过为 home() 函数增加错误捕获，确保其总能返回有效数据。
 * - [修复] 点击分类后无法加载卡片的问题。修正了 category() 函数对分类ID(tid)的处理逻辑，使其能正确解析来自App的对象参数。
 * - [优化] 代码健壮性全面提升。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.107:3000/search";
const SITE_URL = "https://reboys.cn";
const PAGE_SIZE = 12;

// --- 全局变量 ---
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;
let cardsCache = {}; // 用于缓存首页分类卡片数据

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http'  )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- 分类定义 ---
const CUSTOM_CATEGORIES = [
    { name: '短剧', ext: { id: 1 } },
    { name: '电影', ext: { id: 2 } },
    { name: '电视剧', ext: { id: 3 } },
    { name: '动漫', ext: { id: 4 } },
    { name: '综艺', ext: { id: 5 } },
];

// --- App 插件入口函数 ---

async function getConfig() {
    log("==== 插件初始化 V3.3 (健壮性修复版) ====");
    return jsonify({
        ver: 3.3,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - 缓存分页模式】★★★★★
// getCards 函数逻辑正确，无需修改
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = parseInt(ext.page || 1, 10);
    const category = CUSTOM_CATEGORIES.find(c => c.ext.id === categoryId);

    if (!category) {
        log(`[getCards] ❌ 找不到ID为 ${categoryId} 的分类配置`);
        return jsonify({ list: [] });
    }

    log(`[getCards] 请求分类: ${category.name}, 页码: ${page} (缓存分页模式)`);

    try {
        const cacheKey = `category_${categoryId}`;
        let allCards = cardsCache[cacheKey];

        if (!allCards) {
            log(`[getCards] 缓存未命中 for ${cacheKey}，正在从 ${SITE_URL} 获取首页HTML...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            
            allCards = [];

            const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
            if (contentBlock.length === 0) {
                log(`[getCards] ❌ 在首页找不到ID为 ${categoryId} 的内容块`);
                cardsCache[cacheKey] = []; // 存入空数组防止重复请求
                return jsonify({ list: [] });
            }

            contentBlock.find('a.item').each((_, element) => {
                const cardElement = $(element);
                const detailUrl = cardElement.attr('href');
                allCards.push({
                    vod_id: getCorrectUrl(detailUrl),
                    vod_name: cardElement.find('p').text().trim(),
                    vod_pic: getCorrectUrl(cardElement.find('img').attr('src')),
                    vod_remarks: '',
                    ext: { url: getCorrectUrl(detailUrl) }
                });
            });

            cardsCache[cacheKey] = allCards;
            log(`[getCards] ✓ 缓存了 ${allCards.length} 个 "${category.name}" 卡片`);
        } else {
            log(`[getCards] ✓ 缓存命中 for ${cacheKey}，共 ${allCards.length} 个卡片`);
        }

        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);

        log(`[getCards] 返回第 ${page} 页的 ${pageCards.length} 个卡片 (总数 ${allCards.length})`);
        return jsonify({ list: pageCards });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}


// ★★★★★【搜索功能 - 后端API模式】★★★★★
// 搜索功能逻辑正确，无需修改
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    if (!searchText) return jsonify({ list: [] });

    log(`[search] 搜索关键词: "${searchText}", 页码: ${page}`);
    const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}&page=${page}`;
    
    try {
        const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        const response = JSON.parse(jsonString);
        if (response.code !== 0) throw new Error(response.message);

        const results = response.data?.data?.results;
        if (!results || !Array.isArray(results)) return jsonify({ list: [] });
        
        const cards = results.map(item => {
            if (!item || !item.title || !item.links || item.links.length === 0) return null;
            return {
                vod_id: item.links[0].url,
                vod_name: item.title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: item.datetime ? new Date(item.datetime).toLocaleDateString() : '未知时间',
                ext: { url: item.links[0].url }
            };
        }).filter(Boolean);

        log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页 - 智能处理模式】★★★★★
// 详情页逻辑正确，无需修改
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url;
    if (!id) return jsonify({ list: [] });

    if (id.includes('pan.quark.cn') || id.includes('pan.baidu.com') || id.includes('aliyundrive.com')) {
        log(`[getTracks] ✓ 检测到最终网盘链接: ${id}`);
        let panName = id.includes('quark') ? '夸克网盘' : id.includes('baidu') ? '百度网盘' : '阿里云盘';
        return jsonify({ list: [{ title: '点击播放', tracks: [{ name: panName, pan: id, ext: {} }] }] });
    } else {
        log(`[getTracks] 检测到中间页，请求后端解析: ${id}`);
        const keyword = id.split('/').pop().replace('.html', '');
        const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
        
        try {
            const { data: jsonString } = await $fetch.get(requestUrl);
            const response = JSON.parse(jsonString);
            const results = response.data?.data?.results;
            if (!results || results.length === 0) throw new Error("API未能解析出有效链接");

            const finalUrl = results[0].links[0].url;
            log(`[getTracks] ✓ API成功解析出链接: ${finalUrl}`);
            let panName = finalUrl.includes('baidu') ? '百度网盘' : finalUrl.includes('aliyundrive') ? '阿里云盘' : '夸克网盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: finalUrl, ext: {} }] }] });
        } catch (e) {
            log(`[getTracks] ❌ 解析中间页时异常: ${e.message}`);
            return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: id, ext: {} }] }] });
        }
    }
}


// --- 兼容接口 (重点修正区域) ---

async function init() { 
    // 新增：插件启动时清空缓存，确保每次都能加载最新的首页数据
    cardsCache = {};
    log("缓存已清空");
    return getConfig(); 
}

// 【已修正】为 home 函数增加 try-catch，确保总能返回正确的结构
async function home() {
    try {
        const c = await getConfig();
        const config = JSON.parse(c);
        return jsonify({ class: config.tabs || [], filters: {} });
    } catch (e) {
        log(`[home] ❌ 执行异常: ${e.message}`);
        // 即使出错，也返回一个空的有效结构，避免App崩溃
        return jsonify({ class: [], filters: {} });
    }
}

// 【已修正】修正 category 函数对 tid 的处理
async function category(tid, pg) {
    // tid 可能是简单值 (如 "1") 或对象 (如 {id: 1})
    // 这个新逻辑能兼容两种情况
    const categoryId = (typeof tid === 'object' && tid !== null) ? tid.id : tid;
    log(`[category] 解析后分类ID: ${categoryId}, 页码: ${pg}`);
    
    if (!categoryId) {
        log(`[category] ❌ 无法从 tid 中解析出有效的分类ID`);
        return jsonify({ list: [] });
    }
    
    return getCards({ id: parseInt(categoryId, 10), page: pg || 1 });
}

async function detail(id) { 
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}
async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}
