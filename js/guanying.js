/**
 * 观影网脚本 - v18.4 (标准API兼容版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 *
 * --- v18.4 更新日志 ---
 * - 【兼容性】移除了所有对特定APP环境函数 ($fetch, $utils) 的依赖，改用标准的 fetch 和 console API。
 * - 【兼容性】这解决了脚本在某些环境下因函数未定义而完全不执行（“与后端没联系”）的问题。
 *
 * --- v18.3 更新日志 ---
 * - 【修复】重构 search 函数，修复前端缓存逻辑。
 * - 【修复】增强 category 兼容入口函数的健壮性。
 */

// ================== 配置区 ==================
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.4, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv' } },
        { name: '剧集', ext: { id: 'tv' } },
        { name: '动漫', ext: { id: 'ac' } },
    ],
};

const gySearchCache = {
    keyword: '',
    data: [],
    pagecount: 0,
    total: 0,
    pageSize: 20,
};

// ================== 核心函数 ==================

// 使用标准 console.log 替代 $log
function log(msg ) { console.log(`[观影网 V18.4] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 使用标准 console.error 替代 $utils.toastError
function toastError(message) { console.error(`[观影网 V18.4 TOAST] ${message}`); }

// 封装一个标准的 fetch 函数
async function fetchAPI(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json(); // 直接解析为 JSON
}


async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;

    if (!id || id === 'undefined') {
        log('❌ getCards 检测到无效id，已阻止请求。');
        return jsonify({ list: [] });
    }

    const url = `${BACKEND_URL}/getCards?id=${id}&page=${page}`;
    log(`请求后端获取卡片列表: ${url}`);

    try {
        const result = await fetchAPI(url); // 使用标准 fetch
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        log(`✅ 成功从后端获取到 ${result.list.length} 个项目。`);
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 请求后端卡片列表异常: ${e.message}`);
        toastError(`加载失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const detailUrl = ext.url; 
    const url = `${BACKEND_URL}/getTracks?url=${encodeURIComponent(detailUrl)}`;
    log(`请求后端获取详情数据: ${url}`);
    try {
        const result = await fetchAPI(url); // 使用标准 fetch
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        if (result.message) {
            toastError(result.message);
        }
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        toastError(`加载失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    if (!text) return jsonify({ list: [] });

    if (gySearchCache.keyword !== text) {
        log(`新关键词搜索: "${text}"，清空缓存。`);
        gySearchCache.keyword = text;
        gySearchCache.data = [];
        gySearchCache.pagecount = 0;
        gySearchCache.total = 0;
    }

    if (gySearchCache.data.length > 0) {
        log(`✅ 命中前端缓存，执行纯前端分页 (第 ${page} 页)。`);
        const start = (page - 1) * gySearchCache.pageSize;
        const end = start + gySearchCache.pageSize;
        const pageResults = gySearchCache.data.slice(start, end);
        return jsonify({ list: pageResults, pagecount: gySearchCache.pagecount, total: gySearchCache.total });
    }

    log("缓存未命中，开始向后端请求数据...");
    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
    log(`请求后端执行搜索: ${url}`);

    try {
        const result = await fetchAPI(url); // 使用标准 fetch

        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }

        const allResults = result.list || [];
        gySearchCache.data = allResults;
        gySearchCache.total = allResults.length;
        gySearchCache.pagecount = Math.ceil(allResults.length / gySearchCache.pageSize);
        log(`✅ 成功获取 ${gySearchCache.total} 条结果并缓存。总页数: ${gySearchCache.pagecount}`);

        const start = (page - 1) * gySearchCache.pageSize;
        const end = start + gySearchCache.pageSize;
        const pageResults = gySearchCache.data.slice(start, end);
        
        return jsonify({ list: pageResults, pagecount: gySearchCache.pagecount, total: gySearchCache.total });

    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        toastError(`加载失败: ${e.message}`);
        gySearchCache.keyword = '';
        return jsonify({ list: [], pagecount: 0, total: 0 });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}

// ======= 兼容入口 =======
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }

async function category(tid, pg) {
    const id = tid && tid.id ? tid.id : tid;
    log(`[兼容入口] category 调用, 解析出 id: ${id}, page: ${pg}`);
    return getCards({ id: id, page: pg });
}

async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
