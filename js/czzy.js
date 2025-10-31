/**
 * 4k热播影视 前端插件 - V3.2 (混合模式 - 前端分页强化版)
 *
 * 核心架构:
 * - 首页分类 (getCards): 仅抓取首页静态数据，并强制禁用分页。
 * - 搜索 (search): 首次请求后端API获取全部数据，后续翻页由前端缓存和切割实现。
 * - 详情 (getTracks): 智能处理中间页链接或最终网盘链接。
 */

// --- 配置区 ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 后端API地址 (仅供搜索使用)
const API_ENDPOINT = "http://127.0.0.1:3000/search"; // 【重要】请替换成您的后端服务地址

// 目标网站域名 (供首页抓取使用 )
const SITE_URL = "https://reboys.cn";
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// --- 💡 前端分页和缓存机制 ---
let SEARCH_CACHE = {}; // 格式: {keyword: '...', results: [...], total: N, pagecount: N}
const PAGE_SIZE = 20;  // 每页显示的条目数

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
    log("==== 插件初始化 V3.2 (前端分页强化版) ====");
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: 3.2,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - HTML抓取模式 - 禁用分页】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id; 
    log(`[getCards] 请求分类ID: ${categoryId} (HTML抓取模式) - 仅抓取第1页`);

    try {
        const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        if (contentBlock.length === 0) {
            log(`[getCards] ❌ 找不到ID为 ${categoryId} 的内容块`);
            return jsonify({ list: [], page: 1, pagecount: 1, total: 0 }); 
        }

        contentBlock.find('a.item').each((_, element) => {
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

        log(`[getCards] ✓ 成功提取 ${cards.length} 个卡片，已禁用翻页。`);
        
        // 关键：设置 pagecount=1 和 total=cards.length，确保前端无法翻页
        return jsonify({ 
            list: cards,
            page: 1,
            pagecount: 1,      
            total: cards.length, 
        });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [], page: 1, pagecount: 1, total: 0 });
    }
}

// ★★★★★【搜索功能 - 后端API模式 & 前端分页】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page) || 1; 
    
    log(`[search] 搜索关键词: "${searchText}", 请求页码: ${page}`);

    if (!searchText) {
        return jsonify({ list: [] });
    }

    // --- 1. 检查是否需要请求后端 (仅在 Page 1 或关键词变化时请求) ---
    const cacheKey = searchText;
    let rawResults = [];
    let totalCount = 0;

    if (page === 1 || SEARCH_CACHE.keyword !== cacheKey) {
        log(`[search] Page 1 或新关键词，请求后端 API...`);
        
        const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}`;
        
        try {
            const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
            const response = JSON.parse(jsonString);

            if (response.code !== 0 || !response.data?.data?.results) {
                log(`[search] ❌ 后端服务返回错误或数据为空: ${response.message || '无结果'}`);
                SEARCH_CACHE = {}; 
                return jsonify({ list: [], page: 1, pagecount: 1, total: 0 });
            }

            rawResults = response.data.data.results;
            totalCount = rawResults.length;
            
            // 缓存完整结果
            SEARCH_CACHE = {
                keyword: cacheKey,
                results: rawResults,
                total: totalCount,
                pagecount: Math.ceil(totalCount / PAGE_SIZE) // 计算总页数
            };
            
        } catch (e) {
            log(`[search] ❌ 请求或解析JSON时发生异常: ${e.message}`);
            SEARCH_CACHE = {};
            return jsonify({ list: [], page: 1, pagecount: 1, total: 0 });
        }
    } else {
        // 后续分页请求，直接从缓存中取
        log(`[search] Page ${page}，从缓存中读取数据...`);
        rawResults = SEARCH_CACHE.results || [];
        totalCount = SEARCH_CACHE.total || 0;
    }

    // --- 2. 前端实现分页切割 ---
    const startIndex = (page - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    
    // 从完整结果中切割出当前页的数据
    const paginatedResults = rawResults.slice(startIndex, endIndex);

    // --- 3. 格式化当前页数据 ---
    const cards = paginatedResults.map(item => {
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
    
    const pageCount = SEARCH_CACHE.pagecount || 1;

    log(`[search] ✓ 前端分页成功，返回 ${cards.length} 个卡片. Page: ${page}/${pageCount}`);
    
    // 返回包含分页信息的 JSON
    return jsonify({ 
        list: cards,
        page: page,
        pagecount: pageCount,
        total: totalCount,
    });
}

// ★★★★★【详情页 - 智能处理模式】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url;
    
    if (!id) {
        log(`[getTracks] ❌ URL为空`);
        return jsonify({ list: [] });
    }

    // 判断链接类型：如果已经是最终网盘链接
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
        // 如果是中间页链接，请求后端API进行解析
        log(`[getTracks] 检测到中间页链接，需要请求后端API进行解析: ${id}`);
        const keyword = id.split('/').pop().replace('.html', '');
        const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
        
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
            // 提供一个手动打开的备用方案
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
