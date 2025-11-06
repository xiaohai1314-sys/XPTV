/**
 * 观影网脚本 - v18.0 (架构升级版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 * 前端不再需要关心目标网站的任何变化，维护工作集中在后端。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ★ 指向你的后端服务器地址。请确保这个IP和端口是正确的。
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.0,
    title: '观影网 (后端版 )', // 标题变更以区分
    site: 'https://www.gying.org/',
    tabs: [
        // 这里的 id 结构是正确的，它会被传递给后端作为分类路径的一部分。
        { name: '电影', ext: { id: 'mv?page=' } }, 
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★ 新增搜索缓存对象（来自海绵脚本） ★★★
const searchCache = {
    keyword: '',
    data: [], // 存储搜索结果列表
    pagecount: 0,
    total: 0
};
// ★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V18.0] ${msg}`); } catch (_) { console.log(`[观影网 V18.0] ${msg}`);
} }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {};
} } return ext || {}; }
function jsonify(data) { return JSON.stringify(data);
}

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

// --- 【修正】getCards ---
async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    
    // **注意：由于您后端对 id 做了处理，这里不需要再检查 id 是否为 undefined，直接传递即可。**
    const url = `${BACKEND_URL}/getCards?id=${id}&page=${page}`;
    log(`请求后端获取卡片列表: ${url}`);

    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") {
            // 如果后端返回错误消息，使用它
            throw new Error(result.message || '后端返回错误'); 
        }
        
        // **修正点 1：后端返回字段是 result.cards**
        const list = result.cards || []; 
        log(`✅ 成功从后端获取到 ${list.length} 个项目。`);
        
        // 仅返回 list 即可
        return jsonify({ list });
    } catch (e) {
        log(`❌ 请求后端卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// --- 【修正】getTracks ---
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url.match(/id\/(\d+)\.html/)?.[1] || ext.url;
    
    // **修正点 2：后端 /getTracks 接口现在是根据 id 而不是 url 工作的。**
    // 假设您后端希望收到的是 ID (如 3687)，而不是完整的 URL。
    // 如果后端仍需要完整 URL，则使用 const url = `${BACKEND_URL}/getTracks?url=${encodeURIComponent(ext.url)}`;
    const url = `${BACKEND_URL}/getTracks?id=${id}`;
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
        
        // **修正点 3：后端返回的音轨列表是 result.tracks.tracks**
        const list = result.tracks?.tracks || [];
        const title = result.title || '未知标题';

        return jsonify({ list, title });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// --- 【修正】search (处理分页字段映射) ---
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || ''; // 确保 text 可用
    const page = ext.page || 1;

    if (!text) return jsonify({ list: [] });

    // 1. 检查关键词是否改变：如果关键词变了，清空旧缓存
    if (searchCache.keyword !== text) {
        log(`新的搜索关键词: ${text}，清空缓存`);
        searchCache.keyword = text;
        searchCache.data = [];
        searchCache.pagecount = 0;
        searchCache.total = 0;
    }

    // 2. 命中页缓存 (防止重复请求)：如果数据已在本地，直接返回
    if (searchCache.data && searchCache.data[page - 1]) {
        log(`✅ 缓存命中！返回第 ${page} 页缓存结果。`);
        // 必须返回完整的结构
        return jsonify({ 
            list: searchCache.data[page - 1], 
            pagecount: searchCache.pagecount, 
            total: searchCache.total 
        });
    }

    // 3. 页越界保护 (防止无限循环)：请求页码大于总页数，直接返回空
    if (searchCache.pagecount > 0 && page > searchCache.pagecount) {
         log(`❌ 请求页码 ${page} 超过总页数 ${searchCache.pagecount}，返回空列表。`);
         return jsonify({ list: [], pagecount: searchCache.pagecount, total: searchCache.total });
    }

    // 4. 缓存未命中，请求后端
    // **注意：后端 /search 接口的关键词参数是 keyword，不是 text**
    const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(text)}&page=${page}`;
    log(`请求后端执行搜索: ${url}`);
    
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);

        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        
        // **修正点 4：后端返回的是 result.cards 和 result.pagination**
        const list = result.cards || []; 
        
        // **修正点 5：分页字段映射**
        const pagecount = result.pagination?.lastPage || 0; 
        const total = 0; // 后端未提供总条目数，设为0或根据需要估算

        // 5. 写入缓存
        if (!searchCache.data) searchCache.data = [];
        searchCache.data[page - 1] = list;
        searchCache.pagecount = pagecount;
        searchCache.total = total;

        log(`✅ 成功从后端获取并缓存第 ${page} 页结果，总页数: ${pagecount}。`);
        
        // 6. 返回结果，包含 pagecount 和 total
        return jsonify({ list, pagecount, total });

    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [], pagecount: 0, total: 0 });
    }
}

// --- getPlayinfo (保持不变) ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}

