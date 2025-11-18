/**
 * 找盘资源前端插件 - V2.0.0 (终极信使版)
 * 变更内容：
 *  - 全面采用“后端大脑，前端信使”架构。
 *  - [移除] 前端不再进行任何资源筛选、排序、链接清理。
 *  - [简化] search函数只负责请求后端/api/search接口，并直接展示后端返回的、已完美处理的数据。
 *  - [简化] getTracks/detail/play函数统一请求后端的/api/play接口，获取最终链接。
 *  - 前端回归纯粹的UI展示角色，所有复杂逻辑交由后端处理。
 */

// --- 配置区 ---
const API_BASE_URL = "http://192.168.1.7:3004"; // 指向你的新后端
const SITE_URL = "https://v2pan.com"; // 仅用于标题和图标
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;

// --- 辅助函数 ---
function log(msg ) { if (DEBUG) console.log(`[找盘 V2.0.0] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V2.0.0 (终极信使版) ====");
    try {
        // 从后端获取动态分类
        const { data } = await $fetch.get(`${API_BASE_URL}/api/home`);
        return jsonify({ ver: 2, title: '找盘(大脑版)', site: SITE_URL, cookie: '', tabs: data.class });
    } catch (e) {
        log(`获取配置失败: ${e.message}`);
        return jsonify({ ver: 2, title: '找盘(大脑版)', site: SITE_URL, cookie: '', tabs: [{name: '电影', ext: {id: '电影'}}] });
    }
}

// ★★★★★【首页分页 - 信使版】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    log(`[getCards] 请求后端分类="${categoryName}", 页=${page}`);
    try {
        const { data } = await $fetch.get(`${API_BASE_URL}/api/category?id=${encodeURIComponent(categoryName)}&page=${page}`);
        return jsonify(data);
    } catch (e) {
        log(`[getCards] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索 - 终极信使版】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });

    log(`[search] 请求后端搜索, 关键词="${text}", 页=${page}`);
    try {
        const url = `${API_BASE_URL}/api/search?text=${encodeURIComponent(text)}&page=${page}`;
        const { data } = await $fetch.get(url);
        // 直接返回后端处理好的、已排序的数据
        log(`[search] ✓ 成功获取后端处理后的 ${data.list.length} 个结果`);
        return jsonify(data);
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页/播放 - 统一信使版】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const resourceLink = ext.url || ext.vod_id; // 从ext或vod_id获取链接
    if (!resourceLink) {
        log(`[getTracks] ❌ 资源链接为空`);
        return jsonify({ list: [] });
    }
    log(`[getTracks] 准备直接播放/解析: ${resourceLink}`);
    // 在这个插件的逻辑里，详情页和播放页是同一个概念，都是获取最终链接
    // 我们直接返回链接，让APP的播放器去处理
    return jsonify({
        list: [{
            title: "播放线路",
            tracks: [{
                name: "点击播放",
                pan: resourceLink, // 直接将清理过的链接给播放器
                ext: {}
            }]
        }]
    });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return c; }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 插件加载完成 V2.0.0 ====');
