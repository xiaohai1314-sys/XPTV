/**
 * 4k热播影视 前端插件 - V3.1 (分页修正版)
 *
 * 核心架构:
 * - 首页分类 (getCards): 严格模仿"找盘脚本"，通过抓取和解析 reboys.cn 首页及分页HTML来获取数据。
 * - 搜索 (search): 调用您提供的 Puppeteer 后端API来获取数据，并正确传递分页参数。
 * - 详情 (getTracks): 针对两种来源的链接（HTML解析出的中间页链接 / API返回的真实网盘链接）做不同处理。
 *
 * V3.1 更新日志:
 * - [修复] 首页分类: 修正了向下滑动时无限重复第一页内容的问题。现在会根据页码请求正确的分页URL。
 * - [修复] 搜索列表: 修正了搜索结果无限重复的问题。现在会向后端API传递正确的页码参数。
 * - [优化] 分类配置: 在分类中增加了 `path` 属性，用于构建分页URL。
 */

// --- 配置区 ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 后端API地址 (仅供搜索使用)
const API_ENDPOINT = "http://127.0.0.1:3000/search"; // 【重要】请替换成您的后端服务地址

// 目标网站域名 (供首页抓取使用  )
const SITE_URL = "https://reboys.cn";
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http'  )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- App 插件入口函数 ---

// 【已修正】分类配置中增加了 path 属性，用于拼接分页链接
const CUSTOM_CATEGORIES = [
    { name: '短剧', ext: { id: 1, path: 'duanju' } },
    { name: '电影', ext: { id: 2, path: 'movie' } },
    { name: '电视剧', ext: { id: 3, path: 'tv' } },
    { name: '动漫', ext: { id: 4, path: 'comic' } },
    { name: '综艺', ext: { id: 5, path: 'variety' } },
];

async function getConfig() {
    log("==== 插件初始化 V3.1 (分页修正版) ====");
    return jsonify({
        ver: 3.1,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - HTML抓取模式】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = parseInt(ext.page || 1, 10); // 【新增】获取并解析页码
    const category = CUSTOM_CATEGORIES.find(c => c.ext.id === categoryId);

    if (!category) {
        log(`[getCards] ❌ 找不到ID为 ${categoryId} 的分类配置`);
        return jsonify({ list: [] });
    }

    log(`[getCards] 请求分类: ${category.name}, 页码: ${page} (HTML抓取模式)`);

    let requestUrl = SITE_URL;
    // 【新增】如果请求的不是第一页，则构建分页URL
    if (page > 1) {
        requestUrl = `${SITE_URL}/${category.ext.path}/page/${page}.html`;
    }
    
    try {
        log(`[getCards] 正在从 ${requestUrl} 获取HTML...`);
        const { data } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        let items;
        // 【新增】根据请求的页面类型，选择不同的解析方式
        if (page > 1) {
            // 分页的HTML结构更简单，直接找 .item
            items = $('div.list-item a.item');
        } else {
            // 首页需要先定位到特定分类的区块
            const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
            if (contentBlock.length === 0) {
                log(`[getCards] ❌ 在首页找不到ID为 ${categoryId} 的内容块`);
                return jsonify({ list: [] });
            }
            items = contentBlock.find('a.item');
        }

        items.each((_, element) => {
            const cardElement = $(element);
            const detailUrl = cardElement.attr('href');
            
            cards.push({
                vod_id: getCorrectUrl(detailUrl),
                vod_name: cardElement.find('p').text().trim(),
                vod_pic: getCorrectUrl(cardElement.find('img').attr('src')),
                vod_remarks: '',
                ext: { url: getCorrectUrl(detailUrl) }
            });
        });

        log(`[getCards] ✓ 成功提取 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        // 【优化】如果分页请求失败（例如页码超出范围），返回空列表，应用会知道没有更多内容了
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索功能 - 后端API模式】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10); // 【新增】获取并解析页码

    log(`[search] 搜索关键词: "${searchText}", 页码: ${page} (后端API模式)`);

    if (!searchText) {
        return jsonify({ list: [] });
    }

    // 【已修正】在请求URL中加入 page 参数
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
        return jsonify({ list: [] }); //【修正】确保任何错误都返回一个有效的空列表JSON字符串
    }
}

// ★★★★★【详情页 - 智能处理模式】★★★★★
// getTracks 函数的逻辑是正确的，无需修改。
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

// 【重要】category 函数现在会正确地将页码(pg)传递给 getCards
async function category(tid, pg) {
    // tid 可能是对象 {id: 1, path: '...'} 或纯数字 1
    const categoryInfo = typeof tid === 'object' ? tid : CUSTOM_CATEGORIES.find(c => c.ext.id == tid)?.ext;
    if (!categoryInfo) {
        return jsonify({ list: [] });
    }
    return getCards({ ...categoryInfo, page: pg || 1 });
}

async function detail(id) { 
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}
async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}
