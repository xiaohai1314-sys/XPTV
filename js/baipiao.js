/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0 (精准修复版)
 *
 * 版本说明:
 * 基于能正常工作的v4.0版本，仅在返回数据前为列表项添加App渲染所必需的ext字段。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();

// 【核心配置】请确保这里的IP地址和端口与您运行后端的电脑匹配
const appConfig = {
    ver: "4.0-fix",
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
function log(msg  ) { try { $log(`[七味网 v4.0-fix] ${msg}`); } catch (_) { console.log(`[七味网 v4.0-fix] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    // 【保持原样】使用您版本中能正常工作的代码
    ext = argsify(ext);
    const url = `${appConfig.site}/list?id=${ext.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        
        // 【【【 唯一增加的逻辑：为列表数据添加ext字段 】】】
        if (data && data.list) {
            data.list.forEach(item => {
                // App需要这个ext对象来知道点击海报后该请求哪个详情页
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
    // 【保持原样】
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
    // 【保持原样】
    ext = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(ext.text)}`;
    log(`请求后端API: ${url}`);
    try {
        const { data } = await $fetch.get(url);

        // 【【【 唯一增加的逻辑：为搜索结果添加ext字段 】】】
        // 这里的逻辑在您的版本中已经存在，我们保持即可
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
    // 【保持原样】
    ext = argsify(ext);
    const panLink = ext.pan;
    const password = ext.pwd;
    let finalUrl = panLink;
    if (password) {
        finalUrl += `\n提取码: ${password}`;
    }
    return jsonify({ urls: [finalUrl] });
}
