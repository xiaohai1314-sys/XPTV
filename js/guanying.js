/**
 * 观影网脚本 - v18.4 (最终精准缓存移植版)
 *
 * --- 更新说明 ---
 * - 严格基于可工作的 v18.0 版本进行修改。
 * - 仅在 search 函数内部植入缓存逻辑，其他所有代码与 v18.0 保持完全一致。
 * - 修复了因错误修改兼容入口函数而导致的分类加载失败 (undefined1) 的问题。
 */

// ================== 配置区 (v18.0 原样) ==================
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

// ================== 核心函数 (v18.0 原样 ) ==================

function log(msg) { try { $log(`[观影网 V18.4] ${msg}`); } catch (_) { console.log(`[观影网 V18.4] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) {
    return jsonify({});
}

async function getConfig() {
    return jsonify(appConfig);
}

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${BACKEND_URL}/getCards?id=${id}&page=${page}`;
    log(`请求后端获取卡片列表: ${url}`);

    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
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
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        if (result.message) {
            $utils.toastError(result.message, 4000);
        }
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【✨ 本次唯一修改处 ✨】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

const searchCache = {}; // 初始化一个用于搜索的缓存对象

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    // 1. 检查是否是新的搜索关键词，如果是，则清空缓存
    if (searchCache.keyword !== text) {
        log(`新关键词搜索: "${text}"，重置缓存。`);
        searchCache.keyword = text;
        searchCache.data = []; // 按页存储结果的数组
    }

    // 2. 检查请求的页码是否已经有缓存
    if (searchCache.data && searchCache.data[page - 1]) {
        log(`命中缓存: "${text}" 第 ${page} 页。`);
        return jsonify({ list: searchCache.data[page - 1] });
    }

    // 3. 如果没有缓存，则执行 v18.0 的原始请求逻辑
    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}&page=${page}`;
    log(`请求后端执行搜索: "${text}" 第 ${page} 页... URL: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        
        const cards = result.list;
        log(`✅ 成功从后端获取到 ${cards.length} 个搜索结果。`);

        // 4. 将新获取的数据写入缓存
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

// =======================================================================
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲【✨ 本次唯一修改处 ✨】▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
// =======================================================================

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}

// --- 兼容入口 (严格保持 v18.0 原样) ---
// 这里的代码与你提供的、能正常工作的 v18.0 脚本完全一致
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg, filter, ext) {
    return getCards({ id: tid, page: pg });
}

async function detail(id) {
    return getTracks({ url: id });
}

async function play(vod_id, vod_name, ext) {
    return jsonify({ url: ext.url, name: vod_name, play: ext.url });
}

async function test(ext) {
    return getConfig();
}
