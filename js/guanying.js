/**
 * 观影网脚本 - v18.1 (集成搜索缓存)
 *
 * --- 更新说明 ---
 * - 移植了海绵小站插件中的客户端搜索缓存逻辑。
 * - 对于同一个关键词，搜索结果的每一页只会被请求一次，来回翻页将从内存加载，速度极快。
 * - 解决了在某些应用中（如点播壳）可能出现的翻页内容重复问题。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.1,
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V18.1] ${msg}`); } catch (_) { console.log(`[观影网 V18.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// --- 【改造】getCards (与v18.0一致) ---
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

// --- 【改造】getTracks (与v18.0一致) ---
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

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【✨ 本次核心修改 ✨】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// --- 【改造】search (集成缓存逻辑) ---
const searchCache = {}; // 初始化一个用于搜索的缓存对象

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });

    // 1. 检查是否是新的搜索关键词，如果是，则清空缓存
    if (searchCache.keyword !== text) {
        log(`新关键词搜索: "${text}"，重置缓存。`);
        searchCache.keyword = text;
        searchCache.data = []; // 按页存储结果的数组
        // 因为观影网后端不返回总页数，所以 pagecount 和 total 暂时不处理
    }

    // 2. 检查请求的页码是否已经有缓存
    if (searchCache.data && searchCache.data[page - 1]) {
        log(`命中缓存: "${text}" 第 ${page} 页。`);
        return jsonify({ list: searchCache.data[page - 1] });
    }

    // 3. 如果没有缓存，则向后端发起请求
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

// --- 【原封不动】getPlayinfo ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
