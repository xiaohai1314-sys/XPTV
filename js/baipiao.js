/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.2 (最终修正版)
 *
 * 版本说明:
 * 移除了导致 id=undefined 的错误代码行，确保App传递的分类ID被正确接收。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();

// 【核心配置】请确保这里的IP地址和端口与您运行后端的电脑匹配
const appConfig = {
    ver: 4.2,
    title: '七味网(我的专属源)',
    site: 'http://192.168.1.4:3000', // <-- 示例IP ，请替换为您电脑的局域网IP
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[七味网 v4.2] ${msg}`); } catch (_) { console.log(`[七味网 v4.2] ${msg}`); } }
// 【重要】argsify 函数依然保留，因为它在 search 和 getTracks 中是必需的
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    // 【【【 核心修正：删除了错误的 ext = argsify(ext); 这一行 】】】
    // App直接传递过来的ext对象是正确的，我们直接使用即可。
    const url = `${appConfig.site}/list?id=${ext.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        
        if (data && data.list) {
            data.list.forEach(item => {
                item.ext = { url: item.vod_id };
            });
        }
        
        return jsonify(data);
    } catch (e) {
        log(`❌ 请求后端/list接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    // 在这里，argsify是必要的，因为ext是从字符串转换来的
    ext = argsify(ext);
    const url = `${appConfig.site}/detail?urlPath=${encodeURIComponent(ext.url)}`;
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
    // 在这里，argsify是必要的
    ext = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(ext.text)}`;
    log(`请求后端API: ${url}`);
    try {
        const { data } = await $fetch.get(url);

        if (data && data.list) {
            data.list.forEach(item => {
                item.ext = { url: item.vod_id };
            });
        }

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
