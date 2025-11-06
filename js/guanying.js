/**
 * 观影网脚本 - v18.4 (分类加载最终修正版)
 *
 * v18.3 更新:
 * - 添加了必要的兼容入口函数 (home, category, detail, play)。
 * - 修复了因缺少入口函数导致点击分类时 ID 为 undefined 的问题。
 * 
 * v18.4 更新:
 * - 修正了 category 函数的逻辑，以正确处理 tid 参数为对象的情况。
 * - 增加了更详细的日志，用于调试分类加载问题。
 * - 这应该是解决 "id: undefined" 问题的最终方案。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.4, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 ==================
function log(msg ) { try { $log(`[观影网 V18.4] ${msg}`); } catch (_) { console.log(`[观影网 V18.4] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心API调用逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

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

const searchCache = {};
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });
    if (searchCache.keyword !== text) {
        log(`新关键词 "${text}"，重置搜索缓存。`);
        searchCache.keyword = text;
        searchCache.results = null;
    }
    if (page === 1) {
        if (searchCache.results) {
            log(`命中缓存：关键词 "${text}" 的全部结果。`);
            return jsonify({ list: searchCache.results });
        }
        const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
        log(`请求后端执行搜索 (一次性获取全部): ${url}`);
        try {
            const { data } = await $fetch.get(url);
            const result = JSON.parse(data);
            if (result.status !== "success") throw new Error(result.message || '后端返回错误');
            const searchResultList = result.list || [];
            log(`✅ 成功从后端获取到 ${searchResultList.length} 个全部搜索结果，并存入缓存。`);
            searchCache.results = searchResultList;
            return jsonify({ list: searchResultList });
        } catch (e) {
            log(`❌ 搜索异常: ${e.message}`);
            $utils.toastError(`加载失败: ${e.message}`, 4000);
            return jsonify({ list: [] });
        }
    } else {
        log(`关键词 "${text}" 已加载全部结果，第 ${page} 页直接返回空列表。`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}

// ================== 兼容入口 (必须添加) ==================

async function home() { 
    log("调用 home，返回分类列表。");
    return jsonify({ class: appConfig.tabs, filters: {} }); 
}

async function category(tid, pg, filter, ext) { 
    log(`调用 category: tid=${JSON.stringify(tid)}, pg=${pg}`);
    let id;
    if (typeof tid === 'object' && tid !== null && tid.ext && tid.ext.id) {
        log('tid 是一个对象，直接从中提取 id。');
        id = tid.ext.id;
    } else if (typeof tid === 'string') {
        log('tid 是一个字符串，尝试在配置中查找。');
        const tabConfig = appConfig.tabs.find(tab => tab.name === tid || (tab.ext && tab.ext.id === tid));
        id = tabConfig ? tabConfig.ext.id : tid;
    } else {
        log(`❌ category 错误: 无法处理未知类型的 tid: ${JSON.stringify(tid)}`);
        return jsonify({ list: [] });
    }
    if (!id) {
        log(`❌ category 错误: 最终未能为 tid "${JSON.stringify(tid)}" 找到有效的 ID。`);
        return jsonify({ list: [] });
    }
    return getCards({ id: id, page: pg }); 
}

async function detail(id) { 
    log(`调用 detail: id=${id}`);
    return getTracks({ url: id }); 
}

async function play(flag, id, flags) {
    log(`调用 play: id=${id}`);
    return jsonify({ parse: 0, url: id, header: { "User-Agent": UA } });
}
