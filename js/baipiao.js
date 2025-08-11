/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v7.1 (提纯修正版)
 *
 * 版本说明:
 * 基于 v7.0 的“后端主导”架构，对前端进行最终修正。
 *
 * v7.1 更新日志:
 * - [终极修正] 修正了 getCards, search 函数的返回值结构。
 *   之前直接返回了后端包含 status 等字段的完整对象，可能导致App不兼容。
 *   现在改为从后端数据中【只提取 list 数组】，然后构建一个纯粹的 { list: [...] } 对象返回。
 *   这 100% 对标了已知成功案例的数据返回模式，是解决问题的最后一步。
 */

// ================== 配置区 (不变) ==================
const appConfig = {
    ver: 7.1,
    title: '七味网(后端版)',
    site: 'http://192.168.1.4:3000', // 指向您的后端服务
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 (不变 ) ==================
function log(msg   ) { try { $log(`[七味网 v7.1] ${msg}`); } catch (_) { console.log(`[七味网 v7.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// --- getCards (提纯修正版) ---
async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/getCards?id=${ext.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        // ★★★ 关键修正：不再直接返回整个 responseData ★★★
        // 只从后端数据中提取 list 数组，然后构建一个纯粹的、App期望的对象。
        const pureList = responseData.list || [];
        log(`✅ 已从后端提纯了 ${pureList.length} 条数据。`);
        return jsonify({ list: pureList });
    } catch (e) {
        log(`❌ getCards 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks (保持不变，因为其结构 {list:[{title, tracks}]} 符合要求) ---
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

// --- search (提纯修正版) ---
async function search(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(ext.text)}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        // ★★★ 关键修正：同样只提取 list 数组 ★★★
        const pureList = responseData.list || [];
        log(`✅ 已从后端提纯了 ${pureList.length} 条搜索结果。`);
        return jsonify({ list: pureList });
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
