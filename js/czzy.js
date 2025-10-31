/**
 * 4k热播影视 前端插件 - V4.5 (最终版 - 完全复制成功案例架构)
 *
 * 核心原则:
 * 1. 架构完全统一：home() -> category() -> getCards() 的调用流程与“找盘资源”案例完全一致。
 * 2. getCards() 函数内部完整实现了“缓存+切片”逻辑，不再依赖外部函数进行分页。
 * 3. home() 和 category() 与用户可工作的V3.0版本完全一致，确保调用链正确。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://127.0.0.1:3000/search";
const SITE_URL = "https://reboys.cn";

// --- 全局变量 ---
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;
const PAGE_SIZE = 12; 
let cardsCache = {}; 

// --- 辅助函数 (与V3.0完全相同) ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http'  )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- App 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V4.5 (完全复制成功案例架构) ====");
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: 4.5,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分页 - 100%复制“找盘”案例架构】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = ext.page || 1; 

    log(`[getCards] 请求分类ID: ${categoryId}, 页码: ${page} (找盘案例架构)`);

    try {
        const cacheKey = `category_${categoryId}`;
        let allCards = cardsCache[cacheKey];

        if (!allCards) {
            log(`[getCards] 缓存未命中 for ${cacheKey}，正在抓取并解析全量数据...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            
            allCards = [];
            const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
            
            if (contentBlock.length > 0) {
                contentBlock.find('div.list a.item').each((_, element) => {
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
                cardsCache[cacheKey] = []; // 即使找不到也缓存空数组，防止重复请求
            }
        } else {
            log(`[getCards] ✓ 缓存命中 for ${cacheKey}, 总数: ${allCards.length}`);
        }

        // --- 内部进行分页切片 ---
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);

        log(`[getCards] 返回第 ${page} 页的 ${pageCards.length} 个卡片`);
        return jsonify({ list: pageCards });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索功能 - 保留修复】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    if (page > 1) {
        return jsonify({ list: [] });
    }
    if (!searchText) return jsonify({ list: [] });

    const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}`;
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
        return jsonify({ list: cards });
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页 - 与V3.0完全相同】★★★★★
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

// --- 兼容接口 (与V3.0完全相同) ---
async function init() { 
    // 【新增】每次启动时清空缓存，确保数据最新
    cardsCache = {};
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
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}

async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}
