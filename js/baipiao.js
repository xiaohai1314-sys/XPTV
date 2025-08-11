/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v7.0 (纯调用版)
 *
 * 版本说明:
 * 全面采用“后端重、前端轻”的成功架构。
 *
 * v7.0 更新日志:
 * - [架构重构] 前端不再进行任何数据抓取、解析或格式化。
 * - [核心改动] 所有函数 (getCards, getTracks, search) 都改造为直接调用后端对应的API接口。
 * - [职责单一] 前端只负责将App的请求转发给后端，并将后端返回的成品数据再转发给App。
 */

// ================== 配置区 ==================
const appConfig = {
    ver: 7.0,
    title: '七味网(后端版)',
    site: 'http://192.168.1.7:3000', // 指向您的后端服务
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg    ) { try { $log(`[七味网 v7.0] ${msg}`); } catch (_) { console.log(`[七味网 v7.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// --- getCards (纯调用) ---
async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/getCards?id=${ext.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        // 直接将后端返回的成品数据字符串化后返回
        return jsonify(responseData);
    } catch (e) {
        log(`❌ getCards 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks (纯调用) ---
async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/getTracks?urlPath=${ext.url}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        return jsonify(responseData);
    } catch (e) {
        log(`❌ getTracks 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- search (纯调用) ---
async function search(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(ext.text)}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        return jsonify(responseData);
    } catch (e) {
        log(`❌ search 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getPlayinfo (保持不变) ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    const password = ext.pwd;
    let finalUrl = panLink;
    if (password) {
        finalUrl += `\n提取码: ${password}`;
    }
    return jsonify({ urls: [finalUrl] });
}
