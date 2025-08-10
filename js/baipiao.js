/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.1 (前后端协同最终版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。它将所有的数据请求
 * 发送到本地运行的后端API，并确保返回的数据格式完全符合App要求。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();

// 【核心配置】请确保这里的IP地址和端口与您运行后端的电脑匹配
const appConfig = {
    ver: 4.1,
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
function log(msg ) { try { $log(`[七味网 v4.1] ${msg}`); } catch (_) { console.log(`[七味网 v4.1] ${msg}`); } }
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
        const { data } = await $fetch.get(url);
        
        // 【【【 关键修正：为列表数据添加ext字段 】】】
        // 确保App知道点击每个海报后该做什么
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
    ext = argsify(ext);
    // 【【【 关键修正：确保urlPath被正确编码 】】】
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
    ext = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(ext.text)}`;
    log(`请求后端API: ${url}`);
    try {
        const { data } = await $fetch.get(url);

        // 【【【 关键修正：为搜索结果添加ext字段 】】】
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
