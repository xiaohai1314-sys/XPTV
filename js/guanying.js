/**
 * 观影网脚本 - v18.2 (搜索最终优化版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 * 前端不再需要关心目标网站的任何变化，维护工作集中在后端。
 *
 * v18.1 更新:
 * - 新增前端搜索缓存，参考海绵脚本实现。
 * - 解决搜索翻页时因后端无分页信息而导致的循环重复问题。
 * 
 * v18.2 更新:
 * - 根据后端行为进行最终优化。
 * - 搜索时仅请求一次，获取全部结果并缓存。
 * - 后续翻页请求直接返回空，彻底解决重复问题并提升效率。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ★ 指向你的后端服务器地址
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.2, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V18.2] ${msg}`); } catch (_) { console.log(`[观影网 V18.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- init ---
async function init(ext) {
    return jsonify({});
}

// --- getConfig ---
async function getConfig() {
    return jsonify(appConfig);
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// --- getCards ---
async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    // 直接请求后端 /getCards 接口
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

// --- getTracks ---
async function getTracks(ext) {
    ext = argsify(ext);
    const detailUrl = ext.url; 
    // 直接请求后端 /getTracks 接口
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

// --- 【新增】搜索缓存对象 ---
const searchCache = {};

// --- 【最终改造】search ---
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    // 1. 如果没有搜索词，直接返回空
    if (!text) {
        return jsonify({ list: [] });
    }

    // 2. 如果是新的关键词，重置缓存
    if (searchCache.keyword !== text) {
        log(`新关键词 "${text}"，重置搜索缓存。`);
        searchCache.keyword = text;
        searchCache.results = null; // 用于存储完整的搜索结果
    }

    // 3. 如果是请求第一页 (首次加载)
    if (page === 1) {
        // 如果缓存中已有结果，直接返回
        if (searchCache.results) {
            log(`命中缓存：关键词 "${text}" 的全部结果。`);
            return jsonify({ list: searchCache.results });
        }

        // 缓存未命中，向后端请求数据
        const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
        log(`请求后端执行搜索 (一次性获取全部): ${url}`);
        try {
            const { data } = await $fetch.get(url);
            const result = JSON.parse(data);

            if (result.status !== "success") {
                throw new Error(result.message || '后端返回错误');
            }

            const searchResultList = result.list || [];
            
            // 将全部结果存入缓存
            log(`✅ 成功从后端获取到 ${searchResultList.length} 个全部搜索结果，并存入缓存。`);
            searchCache.results = searchResultList;

            return jsonify({ list: searchResultList });

        } catch (e) {
            log(`❌ 搜索异常: ${e.message}`);
            $utils.toastError(`加载失败: ${e.message}`, 4000);
            return jsonify({ list: [] });
        }
    } 
    // 4. 如果是请求后续页面 (page > 1)
    else {
        // 因为后端一次性返回了所有数据，所以后续页面永远是空的
        log(`关键词 "${text}" 已加载全部结果，第 ${page} 页直接返回空列表。`);
        return jsonify({ list: [] });
    }
}

// --- getPlayinfo ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
