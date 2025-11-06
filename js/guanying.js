/**
 * 观影网脚本 - v18.3 (最终修复版)
 *
 * --- v18.3 更新日志 ---
 * - 【采纳 v18.0 配置】恢复了 appConfig.tabs 中 id 的格式 (如 'mv?page=')，以修复分类功能。
 * - 【采纳 v18.2 逻辑】保留了 search 函数中的前端缓存和分页逻辑，以解决搜索结果无限重复的问题。
 * - 【优化】search 函数不再向后端发送 page 参数，因为后端会返回全部结果。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.1.7:5000'; 

const appConfig = {
    ver: 18.3,
    title: '观影网 (后端版  )',
    site: 'https://www.gying.org/',
    tabs: [
        // ▼▼▼【修复】使用 v18.0 的配置 ，以保证分类功能正常 ▼▼▼
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

const gySearchCache = {
    keyword: '',
    results: [],
    pageSize: 20,
};

// ================== 核心函数 ==================
function log(msg) { try { $log(`[观影网 V18.3] ${msg}`); } catch (_) { console.log(`[观影网 V18.3] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// --- getCards (使用 v18.0 的版本) ---
async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${BACKEND_URL}/getCards?id=${id}&page=${page}`;
    log(`请求后端获取卡片列表: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") throw new Error(result.message || '后端返回错误');
        log(`✅ 成功从后端获取到 ${result.list.length} 个项目。`);
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 请求后端卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// --- search (使用 v18.2 的版本，并优化) ---
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    if (!text) return jsonify({ list: [] });

    if (gySearchCache.keyword !== text) {
        log(`新关键词搜索: "${text}"，清空旧缓存。`);
        gySearchCache.keyword = text;
        gySearchCache.results = [];
    } else {
        log(`翻页/重复搜索: "${text}"，页码: ${page}`);
    }

    if (gySearchCache.results.length > 0) {
        log("✅ 命中前端缓存，执行纯前端分页。");
        const start = (page - 1) * gySearchCache.pageSize;
        const end = start + gySearchCache.pageSize;
        const pageResults = gySearchCache.results.slice(start, end);
        log(`从缓存中提取 ${pageResults.length} 条数据 (第 ${page} 页)。`);
        return jsonify({ list: pageResults });
    }

    log("缓存未命中，开始向后端请求全部数据...");
    // ▼▼▼【优化】不再发送 page 参数 ▼▼▼
    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
    log(`请求后端执行搜索: ${url}`);

    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") throw new Error(result.message || '后端返回错误');

        gySearchCache.results = result.list || [];
        log(`✅ 成功从后端获取到 ${gySearchCache.results.length} 条完整结果，并已存入缓存。`);

        const start = (page - 1) * gySearchCache.pageSize;
        const end = start + gySearchCache.pageSize;
        const pageResults = gySearchCache.results.slice(start, end);
        log(`返回第 ${page} 页的 ${pageResults.length} 条数据。`);
        
        return jsonify({ list: pageResults });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        gySearchCache.keyword = ''; 
        return jsonify({ list: [] });
    }
}

// --- getTracks 和 getPlayinfo (保持不变) ---
async function getTracks(ext) {
    ext = argsify(ext);
    const detailUrl = ext.url; 
    const url = `${BACKEND_URL}/getTracks?url=${encodeURIComponent(detailUrl)}`;
    log(`请求后端获取详情数据: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") throw new Error(result.message || '后端返回错误');
        if (result.message) $utils.toastError(result.message, 4000);
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
