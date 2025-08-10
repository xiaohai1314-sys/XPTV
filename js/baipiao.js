/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0.3 (最终正确版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。它将所有的数据请求
 * 发送到本地运行的后端API，由后端负责处理所有验证和数据抓取。
 *
 * v4.0.3 更新日志:
 * - [重大修复] 根据 v3.0 纯前端脚本的工作模式，完全修正了 getCards 函数。
 *   现在脚本能正确处理 $fetch 库对后端JSON响应的包装，通过 `const { data } = ...`
 *   成功解构出列表数据，解决了海报列表为空的根本问题。
 * - [兼容性] 所有函数的数据处理模式均与 v3.0 对齐，确保与特定App环境完美兼容。
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
        // 1. $fetch.get(url) 返回的是 { data: { list: [...] } }
        // 2. 使用 const { data } 解构，得到 data = { list: [...] }
        // 3. 将这个 data 对象 jsonify 后返回给App，完全符合 v3.0 的成功模式。
        const { data } = await $fetch.get(url);
        log(`✅ 成功解构并获取到 ${data.list.length} 条列表数据。`);
        return jsonify(data);
    } catch (e) {
        log(`❌ 请求后端/list接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

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
        // 为详情页请求准备ext数据
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
