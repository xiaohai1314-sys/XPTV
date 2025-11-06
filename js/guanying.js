/**
 * 观影网脚本 - v18.5 (兼容修复版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 *
 * --- v18.5 更新日志 ---
 * - 【兼容性修复】search 函数的返回值恢复为APP期望的简单格式 {list: [...]}, 解决了v18.3引入的“不通”问题。
 * - 【保留】保留了v18.3中对 search 缓存逻辑和 category 入口的修复，确保功能正确。
 * - 【恢复】恢复使用 $fetch 和 $utils，因为 v18.2 版本证明了当前环境支持它们。
 *
 * --- v18.3 更新日志 ---
 * - 【修复】重构 search 函数，修复前端缓存逻辑。
 * - 【修复】增强 category 兼容入口函数的健壮性。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.105:5000'; 

const appConfig = {
    ver: 18.5, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv' } },
        { name: '剧集', ext: { id: 'tv' } },
        { name: '动漫', ext: { id: 'ac' } },
    ],
};

const gySearchCache = {
    keyword: '',
    data: [],       // 存储从后端获取的完整结果
    pageSize: 20,   // 每页显示数量
};

// ================== 核心函数 ==================

function log(msg  ) { try { $log(`[观影网 V18.5] ${msg}`); } catch (_) { console.log(`[观影网 V18.5] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;

    if (!id || id === 'undefined') {
        log('❌ getCards 检测到无效id，已阻止请求。');
        return jsonify({ list: [] });
    }

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

// --- 【v18.5 修复】search (修复缓存逻辑 + 保持兼容返回格式) ---
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;

    if (!text) return jsonify({ list: [] });

    // 1. 关键词变化，重置缓存
    if (gySearchCache.keyword !== text) {
        log(`新关键词搜索: "${text}"，清空缓存。`);
        gySearchCache.keyword = text;
        gySearchCache.data = [];
    }

    // 2. 如果缓存中已有数据，直接执行前端分页
    if (gySearchCache.data.length > 0) {
        log(`✅ 命中前端缓存，执行纯前端分页 (第 ${page} 页)。`);
        const start = (page - 1) * gySearchCache.pageSize;
        const end = start + gySearchCache.pageSize;
        const pageResults = gySearchCache.data.slice(start, end);
        // ★★★ 兼容性修复：只返回 list 属性 ★★★
        return jsonify({ list: pageResults });
    }

    // 3. 缓存未命中，执行后端请求
    log("缓存未命中，开始向后端请求数据...");
    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
    log(`请求后端执行搜索: ${url}`);

    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);

        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }

        // 4. 填充缓存
        gySearchCache.data = result.list || [];
        log(`✅ 成功获取 ${gySearchCache.data.length} 条结果并缓存。`);

        // 5. 返回第一页数据
        const start = (page - 1) * gySearchCache.pageSize;
        const end = start + gySearchCache.pageSize;
        const pageResults = gySearchCache.data.slice(start, end);
        
        // ★★★ 兼容性修复：只返回 list 属性 ★★★
        return jsonify({ list: pageResults });

    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        gySearchCache.keyword = ''; // 清空关键词以便重试
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}

// ======= 兼容入口 (v18.3 修复逻辑保留) =======
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }

async function category(tid, pg) {
    const id = tid && tid.id ? tid.id : tid;
    log(`[兼容入口] category 调用, 解析出 id: ${id}, page: ${pg}`);
    return getCards({ id: id, page: pg });
}

async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
