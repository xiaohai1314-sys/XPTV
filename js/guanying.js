/**
 * 观影网脚本 - v18.3 (兼容性最终版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 *
 * --- v18.3 更新 ---
 * 1. 【兼容性修复】为 category 入口函数增加默认ID，解决部分App框架在加载首页时未传入分类ID导致的“缺少ID”错误。
 * 2. 【保留优化】保留 v18.2 的健壮性修复和搜索缓存机制。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.3, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv' } },
        { name: '剧集', ext: { id: 'tv' } },
        { name: '动漫', ext: { id: 'ac' } },
    ],
};

const searchCache = {
    keyword: '',
    fullList: [],
    pageSize: 20 
};


// ================== 核心函数 ==================

function log(msg  ) { try { $log(`[观影网 V18.3] ${msg}`); } catch (_) { console.log(`[观影网 V18.3] ${msg}`); } }
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

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    if (!text) {
        return jsonify({ list: [] });
    }

    if (searchCache.keyword !== text) {
        log(`新关键词搜索: "${text}"，将从后端获取数据。`);
        searchCache.keyword = text;
        searchCache.fullList = [];

        const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
        log(`请求后端执行搜索: ${url}`);
        
        try {
            const { data } = await $fetch.get(url);
            const result = JSON.parse(data);

            if (result.status !== "success") {
                throw new Error(result.message || '后端返回错误');
            }
            
            searchCache.fullList = result.list || [];
            log(`✅ 成功从后端获取到 ${searchCache.fullList.length} 个搜索结果并已缓存。`);

        } catch (e) {
            log(`❌ 搜索异常: ${e.message}`);
            $utils.toastError(`加载失败: ${e.message}`, 4000);
            searchCache.keyword = ''; 
            return jsonify({ list: [] });
        }
    } else {
        log(`命中缓存关键词: "${text}"，直接从本地缓存分页。`);
    }

    const { fullList, pageSize } = searchCache;
    const pagecount = Math.ceil(fullList.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    const paginatedList = fullList.slice(start, end);
    
    log(`前端分页: 第 ${page} 页, 共 ${pagecount} 页。返回 ${paginatedList.length} 条数据。`);

    return jsonify({ 
        list: paginatedList,
        page: page,
        pagecount: pagecount,
        total: fullList.length
    });
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}


// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 【核心修改】兼容性入口函数 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

async function home() {
    // home函数现在只负责返回分类信息
    return jsonify({ class: appConfig.tabs, filters: {} });
}

async function category(tid, pg) {
    // 【关键修改】如果tid(分类ID)为空，则默认使用第一个分类的ID
    const id = tid || appConfig.tabs[0].ext.id;
    log(`兼容入口 category 调用: tid=${tid}, pg=${pg}, 最终使用id=${id}`);
    return getCards({ id: id, page: pg });
}

async function detail(id) {
    // detail的参数通常是URL的一部分，这里保持不变
    return getTracks({ url: id });
}

async function play(vod_id, vod_name, ext) {
    // play的参数通常是完整的，这里保持不变
    return jsonify({ url: ext.url, name: vod_name, play: ext.url });
}

async function test(ext) {
    return getConfig();
}
