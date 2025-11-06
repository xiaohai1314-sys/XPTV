/**
 * 观影网脚本 - v18.1 (搜索缓存优化版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 * 前端不再需要关心目标网站的任何变化，维护工作集中在后端。
 *
 * --- v18.1 更新 ---
 * 1. 新增前端搜索缓存机制，解决后端搜索接口无分页导致重复加载和无限循环的问题。
 * 2. 对于同一关键词，只进行一次网络请求，后续翻页操作由前端在本地完成，极大提升性能和用户体验。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ★ 指向你的后端服务器地址
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.1, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★ 新增：前端搜索缓存对象
const searchCache = {
    keyword: '',
    fullList: [], // 存储完整搜索结果
    // 假设App或框架每页显示20条 ，如果不是，可以调整这个值
    pageSize: 20 
};


// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V18.1] ${msg}`); } catch (_) { console.log(`[观影网 V18.1] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心逻辑 - 全面简化】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// --- getCards (无改动) ---
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

// --- getTracks (无改动) ---
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

// --- 【改造】search (实现前端缓存与分页) ---
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    // 如果没有搜索词，直接返回空
    if (!text) {
        return jsonify({ list: [] });
    }

    // 1. 检查是否是新的搜索关键词
    if (searchCache.keyword !== text) {
        log(`新关键词搜索: "${text}"，将从后端获取数据。`);
        // 是新关键词，清空缓存并发起网络请求
        searchCache.keyword = text;
        searchCache.fullList = []; // 清空旧数据

        const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
        log(`请求后端执行搜索: ${url}`);
        
        try {
            const { data } = await $fetch.get(url);
            const result = JSON.parse(data);

            if (result.status !== "success") {
                throw new Error(result.message || '后端返回错误');
            }
            
            // 将后端返回的完整列表存入缓存
            searchCache.fullList = result.list || [];
            log(`✅ 成功从后端获取到 ${searchCache.fullList.length} 个搜索结果并已缓存。`);

        } catch (e) {
            log(`❌ 搜索异常: ${e.message}`);
            $utils.toastError(`加载失败: ${e.message}`, 4000);
            // 请求失败时，清空关键词，以便下次可以重试
            searchCache.keyword = ''; 
            return jsonify({ list: [] });
        }
    } else {
        log(`命中缓存关键词: "${text}"，直接从本地缓存分页。`);
    }

    // 2. 从缓存中进行前端分页
    const { fullList, pageSize } = searchCache;
    const pagecount = Math.ceil(fullList.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    // 使用 slice 截取当前页的数据
    const paginatedList = fullList.slice(start, end);
    
    log(`前端分页: 第 ${page} 页, 共 ${pagecount} 页。返回 ${paginatedList.length} 条数据。`);

    // 3. 返回分页后的数据
    return jsonify({ 
        list: paginatedList,
        // 虽然App可能不使用这些值，但返回它们是良好实践
        page: page,
        pagecount: pagecount,
        total: fullList.length
    });
}


// --- getPlayinfo (无改动) ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
