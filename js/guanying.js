/**
 * 观影网脚本 - v18.2 (分类修复版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 * 前端不再需要关心目标网站的任何变化，维护工作集中在后端。
 *
 * --- v18.2 更新日志 ---
 * - 【修复】修正了 appConfig.tabs 中的 id 格式，解决了分类页面因 URL 拼接错误导致 404 的问题。
 *
 * --- v18.1 更新日志 ---
 * - 【新增】前端搜索缓存机制 (gySearchCache)，避免对同一关键词的重复后端请求。
 * - 【优化】实现纯前端分页。首次搜索获取全部数据，后续翻页操作从本地缓存中直接读取，实现“秒翻页”，极大提升用户体验并降低后端负载。
 * - 【调整】search函数被重构，以支持缓存检查、数据存储和前端分页逻辑。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.2, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        // ▼▼▼【修复】id只保留纯粹的路径部分 ，不再包含 "?page=" ▼▼▼
        { name: '电影', ext: { id: 'mv' } },
        { name: '剧集', ext: { id: 'tv' } },
        { name: '动漫', ext: { id: 'ac' } },
        // ▲▲▲ 修复结束 ▲▲▲
    ],
};

// ▼▼▼ 新增：前端搜索缓存对象 ▼▼▼
const gySearchCache = {
    keyword: '',    // 存储当前搜索的关键词
    results: [],    // 存储从后端获取到的完整结果列表
    pageSize: 20,   // 定义前端每页显示多少条数据（可按需调整）
};
// ▲▲▲ 新增：前端搜索缓存对象 ▲▲▲


// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V18.2] ${msg}`); } catch (_) { console.log(`[观影网 V18.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- init (无变动) ---
async function init(ext) {
    return jsonify({});
}

// --- getConfig (无变动) ---
async function getConfig() {
    return jsonify(appConfig);
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// --- getCards (无变动) ---
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

// --- getTracks (无变动) ---
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

// --- search (v18.1版，实现前端缓存和分页) ---
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    if (!text) {
        return jsonify({ list: [] });
    }

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

    log("缓存未命中，开始向后端请求数据...");
    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
    log(`请求后端执行搜索: ${url}`);

    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);

        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }

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


// --- getPlayinfo (无变动) ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
