/**
 * 4k热播影视 前端插件 - V4.2 (终极解决方案：逻辑分离)
 *
 * 核心原则:
 * 1. 严格遵从用户最终分析：数据获取(getCards)与分页控制(category)相分离。
 * 2. getCards() 函数完全回滚至用户可工作的V3.0版本，只负责获取全量数据。
 * 3. 在 category() 兼容接口内部，对获取到的全量数据进行手动切片分页，从而完美解决无限重复问题，且不影响初次加载。
 * 4. 保留已修复的搜索功能。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://127.0.0.1:3000/search";
const SITE_URL = "https://reboys.cn";

// --- 全局变量 ---
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;
const PAGE_SIZE = 12; // 在这里定义每页显示的海报数量

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
    log("==== 插件初始化 V4.2 (逻辑分离版) ====");
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: 4.2,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - 数据获取】★★★★★
// 【已回滚】此函数与你的V3.0版本逻辑相同，只负责获取全量数据，不做任何分页。
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    log(`[getCards] (V3.0模式) 请求分类ID: ${categoryId}，获取全量数据...`);

    try {
        const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        if (contentBlock.length === 0) {
            log(`[getCards] ❌ 找不到ID为 ${categoryId} 的内容块`);
            return jsonify({ list: [] });
        }

        // 使用精确选择器
        contentBlock.find('div.list a.item').each((_, element) => {
            const cardElement = $(element);
            cards.push({
                vod_id: getCorrectUrl(cardElement.attr('href')),
                vod_name: cardElement.find('p').text().trim(),
                vod_pic: getCorrectUrl(cardElement.find('img').attr('src')),
                vod_remarks: '',
                ext: { url: getCorrectUrl(cardElement.attr('href')) }
            });
        });

        log(`[getCards] ✓ 成功提取 ${cards.length} 个全量卡片`);
        return jsonify({ list: cards });
        
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

    // 搜索功能只有一页，后续页返回空
    if (page > 1) {
        log(`[search] 请求页码 > 1，返回空列表以停止无限加载。`);
        return jsonify({ list: [] });
    }
    if (!searchText) return jsonify({ list: [] });

    log(`[search] 搜索关键词: "${searchText}"`);
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
        log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页 - 完整代码】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url;
    
    if (!id) {
        log(`[getTracks] ❌ URL为空`);
        return jsonify({ list: [] });
    }

    // 判断链接类型
    if (id.includes('pan.quark.cn') || id.includes('pan.baidu.com') || id.includes('aliyundrive.com')) {
        // --- 情况A: ID已经是最终网盘链接 (来自搜索) ---
        log(`[getTracks] ✓ 检测到最终网盘链接，直接使用: ${id}`);
        
        let panName = '网盘资源';
        if (id.includes('quark')) panName = '夸克网盘';
        else if (id.includes('baidu')) panName = '百度网盘';
        else if (id.includes('aliyundrive')) panName = '阿里云盘';

        return jsonify({
            list: [{ title: '点击播放', tracks: [{ name: panName, pan: id, ext: {} }] }]
        });
    } else {
        // --- 情况B: ID是中间页链接 (来自首页) ---
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
            
            let panName = '夸克网盘'; // 默认
            if (finalUrl.includes('baidu')) panName = '百度网盘';
            else if (finalUrl.includes('aliyundrive')) panName = '阿里云盘';

            return jsonify({
                list: [{ title: '解析成功', tracks: [{ name: panName, pan: finalUrl, ext: {} }] }]
            });

        } catch (e) {
            log(`[getTracks] ❌ 解析中间页时发生异常: ${e.message}`);
            // 提供一个手动打开的备用方案
            return jsonify({
                list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: id, ext: {} }] }]
            });
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

// 【核心修正】在这里进行手动分页控制
async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    const page = Math.max(parseInt(pg || 1, 10), 1); // 确保页码是有效数字

    log(`[category] 正在为分类ID ${id} 获取全量数据...`);
    // 1. 调用原始的 getCards 获取所有数据
    const allDataJson = await getCards({ id: id });
    const allData = JSON.parse(allDataJson);
    const allCards = allData.list || [];

    if (allCards.length === 0) {
        log(`[category] 未获取到任何数据，返回空列表。`);
        return jsonify({ list: [] });
    }

    // 2. 在这里对获取到的全量数据进行手动切片
    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    const pageCards = allCards.slice(startIdx, endIdx);

    log(`[category] 手动分页：从 ${allCards.length} 个总数中，返回第 ${page} 页的 ${pageCards.length} 个卡片。`);

    // 3. 返回切片后的当页数据
    return jsonify({ list: pageCards });
}

async function detail(id) { 
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}

async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}
