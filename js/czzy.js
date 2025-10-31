/**
 * 4k热播影视 前端插件 - V4.1 (终极正确版)
 *
 * 核心原则:
 * 1. 兼容接口(home, category等)与用户可工作的V3.0版本完全一致。
 * 2. 采用“缓存+切片”策略完美解决首页分类的加载和分页问题，不再使用有问题的 if (page > 1) 判断。
 * 3. 使用最精确的Cheerio选择器，确保卡片能被正确解析。
 * 4. 保留已验证正常的搜索功能修复。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.107:3000/search";
const SITE_URL = "https://reboys.cn";

// --- 全局变量 ---
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;
let cardsCache = {}; // 【新增】用于缓存首页分类卡片
const PAGE_SIZE = 12; // 定义每页显示的数量

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
    log("==== 插件初始化 V4.1 (终极正确版) ====");
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: 4.1,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - 缓存切片策略】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    // 修正页码处理，确保任何情况下都有默认值
    const page = Math.max(parseInt(ext.page || 1, 10), 1); 

    log(`[getCards] 请求分类ID: ${categoryId}, 页码: ${page} (缓存策略)`);

    try {
        const cacheKey = `category_${categoryId}`;
        let allCards = cardsCache[cacheKey];

        // 如果缓存未命中，则执行网络请求并填充缓存
        if (!allCards) {
            log(`[getCards] 缓存未命中 for ${cacheKey}，正在抓取HTML...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            
            allCards = [];
            const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
            
            if (contentBlock.length > 0) {
                // 使用最精确的选择器
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
                cardsCache[cacheKey] = []; // 存空数组防止重试
            }
        } else {
            log(`[getCards] ✓ 缓存命中 for ${cacheKey}`);
        }

        // --- 从缓存中进行分页切片 ---
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
        log(`[search] 请求页码 > 1，返回空列表以停止无限加载。`);
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
            if (!item || !item.title || !item.links || !item.links.length === 0) return null;
            return {
                vod_id: item.links[0].url, vod_name: item.title, vod_pic: FALLBACK_PIC,
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
            if (!results || results.length === 0) throw new Error("API未能解析出有效链接");
            const finalUrl = results[0].links[0].url;
            let panName = finalUrl.includes('baidu') ? '百度网盘' : finalUrl.includes('aliyundrive') ? '阿里云盘' : '夸克网盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: finalUrl, ext: {} }] }] });
        } catch (e) {
            return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: id, ext: {} }] }] });
        }
    }
}

// --- 兼容接口 (与V3.0完全相同) ---
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
