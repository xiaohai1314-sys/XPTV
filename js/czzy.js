/**
 * 4k热播影视 前端插件 - V3.2 (缓存分页版)
 *
 * 核心架构:
 * - 首页分类 (getCards): 采用“一次性抓取+前端缓存分页”策略，模仿“找盘脚本”，提升翻页性能。
 * - 搜索 (search): 调用 Puppeteer 后端API，并正确传递分页参数。
 * - 详情 (getTracks): 智能处理中间页和最终页链接。
 *
 * V3.2 更新日志:
 * - [优化] 首页分类: getCards函数重构，采用缓存切片策略，第一次加载后翻页无需网络请求，响应极速。
 * - [修复] 彻底解决首页分类无限重复加载的问题。
 * - [新增] 引入 PAGE_SIZE 常量，方便调整首页每页显示数量。
 */

// --- 配置区 ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
const API_ENDPOINT = "http://192.168.10.107:3000/search"; // 后端API地址
const SITE_URL = "https://reboys.cn";
const PAGE_SIZE = 12; // 【新增】首页每页显示的卡片数量
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// --- 全局缓存 ---
let cardsCache = {}; // 【新增】用于缓存首页分类卡片数据

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http'  )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- App 插件入口函数 ---
const CUSTOM_CATEGORIES = [
    { name: '短剧', ext: { id: 1 } },
    { name: '电影', ext: { id: 2 } },
    { name: '电视剧', ext: { id: 3 } },
    { name: '动漫', ext: { id: 4 } },
    { name: '综艺', ext: { id: 5 } },
];

async function getConfig() {
    log("==== 插件初始化 V3.2 (缓存分页版) ====");
    return jsonify({
        ver: 3.2,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - 缓存分页模式】★★★★★
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

        // 如果缓存未命中，则执行网络请求并填充缓存
        if (!allCards) {
            log(`[getCards] 缓存未命中 for ${cacheKey}，正在从 ${SITE_URL} 获取首页HTML...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            
            allCards = []; // 初始化为空数组

            const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
            if (contentBlock.length === 0) {
                log(`[getCards] ❌ 在首页找不到ID为 ${categoryId} 的内容块`);
                return jsonify({ list: [] });
            }

            // 提取该分类下的所有卡片
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

            cardsCache[cacheKey] = allCards; // 将提取到的所有卡片存入缓存
            log(`[getCards] ✓ 缓存了 ${allCards.length} 个 "${category.name}" 卡片`);
        } else {
            log(`[getCards] ✓ 缓存命中 for ${cacheKey}，共 ${allCards.length} 个卡片`);
        }

        // --- 从缓存中进行分页切片 ---
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);

        log(`[getCards] 返回第 ${page} 页的 ${pageCards.length} 个卡片 (总数 ${allCards.length})`);

        // 如果切片后没有数据了（即到了最后一页之后），返回空列表，App会知道没有更多内容
        return jsonify({ list: pageCards });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}


// ★★★★★【搜索功能 - 后端API模式】★★★★★
// 搜索功能保持不变，因为它本身就需要实时请求分页
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    log(`[search] 搜索关键词: "${searchText}", 页码: ${page} (后端API模式)`);

    if (!searchText) {
        return jsonify({ list: [] });
    }

    const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}&page=${page}`;
    log(`[search] 正在请求后端API: ${requestUrl}`);

    try {
        const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        const response = JSON.parse(jsonString);

        if (response.code !== 0) {
            log(`[search] ❌ 后端服务返回错误: ${response.message}`);
            return jsonify({ list: [] });
        }

        const results = response.data?.data?.results;
        if (!results || !Array.isArray(results)) {
            log(`[search] ❌ 在返回的JSON中找不到 results 数组`);
            return jsonify({ list: [] });
        }
        
        const cards = results.map(item => {
            if (!item || !item.title || !item.links || item.links.length === 0) return null;
            const finalUrl = item.links[0].url;
            return {
                vod_id: finalUrl,
                vod_name: item.title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: item.datetime ? new Date(item.datetime).toLocaleDateString() : '未知时间',
                ext: { url: finalUrl }
            };
        }).filter(card => card !== null);

        log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 请求或解析JSON时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页 - 智能处理模式】★★★★★
// 详情页逻辑保持不变
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
        
        log(`[getTracks] 正在请求后端API: ${requestUrl}`);
        try {
            const { data: jsonString } = await $fetch.get(requestUrl);
            const response = JSON.parse(jsonString);
            const results = response.data?.data?.results;

            if (!results || results.length === 0) {
                throw new Error("API未能解析出有效链接");
            }

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


// --- 兼容接口 (保持不变) ---
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
