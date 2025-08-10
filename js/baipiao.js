/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0.4 (证据修复版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。它将所有的数据请求
 * 发送到本地运行的后端API，由后端负责处理所有验证和数据抓取。
 *
 * v4.0.4 更新日志:
 * - [重大修复] 根据后端调试日志提供的确凿证据，确认了App的HTTP库(Alamofire)
 *   不会对后端返回的JSON进行额外包装。因此，彻底修正了 getCards 函数，
 *   使其直接处理后端返回的原始数据，解决了列表为空的根本问题。
 */

// ================== 配置区 ==================
const cheerio = createCheerio(); // 保留，以防某些App环境需要它

// 【核心配置】将site指向您本地运行的后端服务地址
// 1. 如果App和电脑在同一个局域网，请填写电脑的局域网IP地址 (例如: 'http://192.168.1.101:3000'  )
// 2. 如果您在电脑安卓模拟器上运行App，通常可以使用 'http://10.0.2.2:3000'
const appConfig = {
    ver: 4.0, // 保持主版本号为 4.0
    title: '七味网(我的专属源  )',
    site: 'http://192.168.1.4:3000', // <-- 请根据您的实际情况修改这里！
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg   ) { try { $log(`[七味网 v4.0] ${msg}`); } catch (_) { console.log(`[七味网 v4.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 (已全部简化) ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/list?id=${ext.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        // 【【【 最终修复点 】】】
        // 根据日志证据，$fetch.get(url) 直接返回了后端发送的 { list: [...] } 对象。
        // 我们直接接收这个对象，然后 jsonify 它即可。
        const responseData = await $fetch.get(url);
        log(`✅ 成功获取到 ${responseData.list.length} 条列表数据。`);
        return jsonify(responseData);
    } catch (e) {
        log(`❌ 请求后端/list接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 其他函数保持原样，因为它们的逻辑在 v4.0 中是经过验证的
async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/detail?urlPath=${ext.url}`;
    log(`请求后端API: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        return jsonify(data);
    } catch (e) {
        log(`❌ 请求后端/detail接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(ext.text)}`;
    log(`请求后端API: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        data.list.forEach(item => {
            item.ext = { url: item.vod_id };
        });
        return jsonify(data);
    } catch (e) {
        log(`❌ 请求后端/search接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

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
