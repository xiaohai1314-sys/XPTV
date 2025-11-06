/**
 * 观影网脚本 - v18.2 (分类接口修复版)
 *
 * --- 更新说明 ---
 * - 修复了点击首页分类Tab时，因ID解析错误导致无法加载列表的问题 (undefined1 错误)。
 * - 保持 v18.1 的所有功能，包括搜索缓存。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.2, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gyg.la/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 (无变化 ) ==================

function log(msg) { try { $log(`[观影网 V18.2] ${msg}`); } catch (_) { console.log(`[观影网 V18.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    // 增加一个保护，防止 id 仍然是 undefined
    if (!id) {
        log('❌ getCards 调用失败，因为 id 是 undefined。');
        return jsonify({ list: [] });
    }
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
        log(`新关键词搜索: "${text}"，重置缓存。`);
        searchCache.keyword = text;
        searchCache.data = [];
    }

    if (searchCache.data && searchCache.data[page - 1]) {
        log(`命中缓存: "${text}" 第 ${page} 页。`);
        return jsonify({ list: searchCache.data[page - 1] });
    }

    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}&page=${page}`;
    log(`请求后端执行搜索: "${text}" 第 ${page} 页... URL: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") throw new Error(result.message || '后端返回错误');
        
        const cards = result.list;
        log(`✅ 成功从后端获取到 ${cards.length} 个搜索结果。`);

        if (!searchCache.data) searchCache.data = [];
        searchCache.data[page - 1] = cards;
        log(`已将 "${text}" 第 ${page} 页的结果写入缓存。`);

        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【✨ 本次核心修复 ✨】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// --- 兼容入口 ---
async function home() { 
    const c = await getConfig(); 
    const config = JSON.parse(c); 
    return jsonify({ class: config.tabs, filters: {} }); 
}

async function category(tid, pg, filter, ext) {
    // 修复：正确地从 tid 对象中解析出 id
    const id = tid.ext ? tid.ext.id : tid.id;
    return getCards({ id: id, page: pg });
}

async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
