/**
 * 观影网脚本 - v18.4 (终极适应版)
 *
 * --- v18.4 更新日志 ---
 * - 【终极修复】在 getCards 函数中增加防御性代码。当APP框架在首次加载分类页未传递 id 时，
 *   脚本会主动从 appConfig.tabs[0] 中获取默认的 id，从而彻底解决“收到的ID: undefined”的问题。
 * - 【保留】保留了 v18.3 中所有正确的逻辑，包括分类的 id 格式和搜索的前端分页。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.4,
    title: '观影网 (后端版  )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

const gySearchCache = {
    keyword: '',
    results: [],
    pageSize: 20,
};

// ================== 核心函数 ==================
function log(msg ) { try { $log(`[观影网 V18.4] ${msg}`); } catch (_) { console.log(`[观影网 V18.4] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
//                  【终极修复】 最终版 getCards 接口
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
async function getCards(ext) {
    ext = argsify(ext);
    let { page = 1, id } = ext;

    // 【防御性代码】检查 id 是否为 undefined (通常发生在首次进入分类页时)
    if (id === undefined) {
        log("⚠️ getCards 未收到 id，判定为首次加载。将使用默认分类ID。");
        // 从 appConfig 中读取第一个 tab 的 id 作为默认值
        if (appConfig.tabs && appConfig.tabs.length > 0) {
            id = appConfig.tabs[0].ext.id;
            log(`✅ 已设置默认 id 为: "${id}"`);
        } else {
            log("❌ 错误：appConfig 中没有可用的 tabs 配置！");
            // 如果连配置都没有，就只能报错了
            $utils.toastError("配置错误，无分类信息", 4000);
            return jsonify({ list: [] });
        }
    }

    const url = `${BACKEND_URL}/getCards?id=${id}&page=${page}`;
    log(`请求后端获取卡片列表: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") {
            // 将后端的错误信息直接显示出来
            const errorMessage = result.message || '后端返回错误';
            log(`❌ 后端错误: ${errorMessage}`);
            $utils.toastError(errorMessage, 4000);
            throw new Error(errorMessage);
        }
        log(`✅ 成功从后端获取到 ${result.list.length} 个项目。`);
        return jsonify({ list: result.list });
    } catch (e) {
        // 如果是网络等其他错误，也进行提示
        if (!e.message.includes("分类ID(id)无效")) { // 避免重复提示
             log(`❌ 请求后端卡片列表异常: ${e.message}`);
             $utils.toastError(`加载失败: ${e.message}`, 4000);
        }
        return jsonify({ list: [] });
    }
}

// --- search (使用 v18.3 的版本) ---
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    if (!text) return jsonify({ list: [] });

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
        return jsonify({ list: pageResults });
    }

    log("缓存未命中，开始向后端请求全部数据...");
    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
    log(`请求后端执行搜索: ${url}`);

    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") throw new Error(result.message || '后端返回错误');

        gySearchCache.results = result.list || [];
        log(`✅ 成功从后端获取到 ${gySearchCache.results.length} 条完整结果，并已存入缓存。`);

        const start = (page - 1) * gySearchCache.pageSize;
        const end = start + gySearchCache.pageSize;
        const pageResults = gySearchCache.results.slice(start, end);
        
        return jsonify({ list: pageResults });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        gySearchCache.keyword = ''; 
        return jsonify({ list: [] });
    }
}

// --- getTracks 和 getPlayinfo (保持不变) ---
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

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
