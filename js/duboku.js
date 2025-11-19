/**
 * 找盘资源前端插件 - V-Final-V2.6 (渐进式加载最终版)
 * 核心功能：
 *  1. 实现分阶段渐进式加载，首次搜索极速响应。
 *  2. 前端驱动，按需请求夸克等后续资源。
 *  3. 后端API优先，Puppeteer仅做兜底，性能与稳定性兼顾。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.102:3004/api/get_real_url"; // <-- 请务必修改为您的后端服务器地址
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12; // 首页分页大小
const SEARCH_PAGE_SIZE = 30; // 搜索结果分页大小

// --- 全局状态 ---
let searchSession = {}; // 用于存储当前搜索会话的状态
let cardsCache = {}; // 首页缓存

// --- 辅助函数 ---
function log(msg ) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http' )) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// --- 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V-Final-V2.5 (渐进式加载最终版) ====");
    const CUSTOM_CATEGORIES = [ { name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } } ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// ★★★★★【首页分页】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    if (page === 1 || !searchSession.keyword || searchSession.keyword !== keyword) {
        log(`[Search] 新的搜索开始，关键词: "${keyword}"`);
        searchSession = {
            keyword: keyword,
            stage: 1,
            stage1Results: [],
            stage2Results: [],
            stage1Loaded: false,
            stage2Loaded: false,
        };
    }

    const baseUrl = API_ENDPOINT.substring(0, API_ENDPOINT.indexOf('/api/'));

    if (!searchSession.stage1Loaded) {
        log(`[Search] 请求阶段1 (高优) 数据...`);
        const searchApiUrl = `${baseUrl}/api/search?keyword=${encodeURIComponent(keyword)}&stage=1`;
        try {
            const { data } = await $fetch.get(searchApiUrl);
            const result = JSON.parse(data);
            if (result.success && Array.isArray(result.list)) {
                searchSession.stage1Results = result.list;
                log(`[Search] 阶段1成功获取 ${result.list.length} 条数据`);
            }
        } catch (e) {
            log(`[Search] ❌ 阶段1请求失败: ${e.message}`);
        }
        searchSession.stage1Loaded = true;
    }

    // ★★★★★【核心修改开始】★★★★★
    // 将合并与分页的逻辑提前，并进行整合
    let combinedList = [...searchSession.stage1Results];
    let stage1PageCount = Math.ceil(combinedList.length / SEARCH_PAGE_SIZE) || 1;

    // 当需要加载更多页，并且 stage2 尚未加载时，触发加载
    if (page > stage1PageCount && !searchSession.stage2Loaded) {
        log(`[Search] 翻页触发，请求阶段2 (夸克) 数据...`);
        const searchApiUrl = `${baseUrl}/api/search?keyword=${encodeURIComponent(keyword)}&stage=2`;
        try {
            const { data } = await $fetch.get(searchApiUrl);
            const result = JSON.parse(data);
            if (result.success && Array.isArray(result.list)) {
                searchSession.stage2Results = result.list;
                log(`[Search] 阶段2成功获取 ${result.list.length} 条数据`);
            }
        } catch (e) {
            log(`[Search] ❌ 阶段2请求失败: ${e.message}`);
        }
        searchSession.stage2Loaded = true;
    }
    
    // 无论何时，都使用当前所有已加载的数据进行合并
    combinedList = [...searchSession.stage1Results, ...searchSession.stage2Results];
    
    const totalCount = combinedList.length;
    const totalPageCount = Math.ceil(totalCount / SEARCH_PAGE_SIZE) || 1;

    const startIndex = (page - 1) * SEARCH_PAGE_SIZE;
    const endIndex = startIndex + SEARCH_PAGE_SIZE;
    const pageList = combinedList.slice(startIndex, endIndex);
    
    const hasMore = page < totalPageCount;

    log(`[Search] 返回 ${pageList.length} 条结果, 总页数: ${totalPageCount}, 是否有更多: ${hasMore}`);
    return jsonify({
        list: pageList,
        page: page,
        pagecount: totalPageCount,
        hasmore: hasMore
    });
}

// ★★★★★【详情页】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });
    const middleUrl = getCorrectPicUrl(url);
    try {
        const apiUrl = `${API_ENDPOINT}?url=${encodeURIComponent(middleUrl)}`;
        const response = await $fetch.get(apiUrl);
        const result = JSON.parse(response.data);
        if (result.success && result.real_url) {
            let panName = '网盘链接';
            if (result.real_url.includes('quark')) panName = '夸克网盘';
            else if (result.real_url.includes('baidu')) panName = '百度网盘';
            else if (result.real_url.includes('aliyundrive')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: result.real_url, ext: {} }] }] });
        } else {
            throw new Error(result.error || 'API error');
        }
    } catch (e) {
        return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }] });
    }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 插件加载完成 V-Final-V2.5 (渐进式加载最终版) ====');
