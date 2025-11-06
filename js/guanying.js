/**
 * 观影网脚本 - v18.3 (最终完整版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 * 前端不再需要关心目标网站的任何变化，维护工作集中在后端。
 *
 * v18.2 更新:
 * - 根据后端行为进行最终优化。
 * - 搜索时仅请求一次，获取全部结果并缓存。
 * - 后续翻页请求直接返回空，彻底解决重复问题并提升效率。
 * 
 * v18.3 更新:
 * - 添加了必要的兼容入口函数 (home, category, detail, play)。
 * - 修复了因缺少入口函数导致点击分类时 ID 为 undefined 的问题。
 * - 优化了 category 函数的逻辑，使其更健壮。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ★ 指向你的后端服务器地址
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.3, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V18.3] ${msg}`); } catch (_) { console.log(`[观影网 V18.3] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心API调用逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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

// ================== 兼容入口 (必须添加) ==================

/**
 * 首页，提供分类信息
 */
async function home() { 
    const config = appConfig;
    log("调用 home，返回分类列表。");
    return jsonify({ class: config.tabs, filters: {} }); 
}

/**
 * 分类页加载，由APP框架调用
 * @param {string} tid - 分类ID或名称
 * @param {string} pg - 页码
 * @param {boolean} filter - 是否筛选
 * @param {object} ext - 扩展参数
 */
async function category(tid, pg, filter, ext) { 
    log(`调用 category: tid=${tid}, pg=${pg}`);
    // tid 在某些框架下可能是分类的 name，如 "电影"
    // 我们需要根据 name 找到配置中的 ext.id
    const tabConfig = appConfig.tabs.find(tab => tab.name === tid);
    
    // 如果通过名字找到了配置，就用配置里的id；否则直接用tid（兼容id直接传入的情况）
    const id = tabConfig ? tabConfig.ext.id : tid;
    
    if (!id) {
        log(`❌ category 错误: 无法为 tid "${tid}" 找到对应的 ID。`);
        return jsonify({ list: [] });
    }

    return getCards({ id: id, page: pg }); 
}

/**
 * 详情页加载，由APP框架调用
 * @param {string} id - 影片的 vod_id，在我们的逻辑里它就是详情API URL
 */
async function detail(id) { 
    log(`调用 detail: id=${id}`);
    // 这里的 id 是 vod_id，也就是我们之前在 getCards 中设置的 ext.url
    return getTracks({ url: id }); 
}

/**
 * 播放页处理，由APP框架调用
 * @param {string} flag - 播放源标识
 * @param {string} id - 播放链接，在我们的逻辑里它就是网盘链接
 * @param {object} flags - 所有播放源
 */
async function play(flag, id, flags) {
    log(`调用 play: id=${id}`);
    // 对于网盘资源，我们不需要解析，直接将链接返回给APP处理
    return jsonify({
        parse: 0, // 0表示不使用webview解析
        url: id,  // 直接返回网盘链接
        header: { "User-Agent": UA } // 可以附加一个UA
    });
}
