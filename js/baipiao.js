/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0.8 (最终完整修正版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。它将所有的数据请求
 * 发送到本地运行的后端API，由后端负责处理所有验证和数据抓取。
 *
 * v4.0.8 更新日志:
 * - [校对] 完整保留了所有原始函数逻辑，特别是 getTracks 和 getPlayinfo 的正确实现。
 * - [关键修复] 修正了 getCards 函数中 ext 字段的构建逻辑，通过 jsonify 将其字符串化，解决列表页为空的问题。
 * - [逻辑修正] 修正了 search 函数的逻辑，为从后端获取的搜索结果手动添加【字符串化】的 ext 字段，确保搜索结果可点击。
 */

// ================== 配置区 (原封不动) ==================
const cheerio = createCheerio();

const appConfig = {
    ver: 4.0,
    title: '七味网(我的专属源 )',
    site: 'http://192.168.1.7:3000',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 (原封不动 ) ==================
function log(msg   ) { try { $log(`[七味网 v4.0.8] ${msg}`); } catch (_) { console.log(`[七味网 v4.0.8] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// --- getCards 函数 (已修正) ---
async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/list?id=${ext.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        if (!responseData || !responseData.list || responseData.list.length === 0) {
            log('后端返回数据为空或格式不正确。');
            return jsonify({ list: [] });
        }

        // 【【【 核心修复：数据净化/重生 】】】
        const pureCards = [];
        for (const item of responseData.list) {
            pureCards.push({
                vod_id: item.vod_id,
                vod_name: item.vod_name,
                vod_pic: item.vod_pic,
                vod_remarks: item.vod_remarks,
                // 将后端返回的 ext 对象【字符串化】
                ext: jsonify(item.ext),
            });
        }
        
        log(`✅ 数据已净化，构造了 ${pureCards.length} 个纯净的列表项。`);
        return jsonify({ list: pureCards });

    } catch (e) {
        log(`❌ getCards 捕获到异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks 函数 (已还原为您的正确版本) ---
// 此函数负责处理包含“网盘美化词”的详情数据
async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/detail?urlPath=${ext.url}`;
    log(`请求后端API: ${url}`);
    try {
        // 【关键】使用 {data} 解构来正确获取后端返回的 JSON 对象
        const { data } = await $fetch.get(url);
        // 直接将后端处理好的、包含美化词的数据返回给应用
        return jsonify(data);
    } catch (e) {
        log(`❌ 请求后端/detail接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- search 函数 (已修正) ---
async function search(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(ext.text)}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        if (responseData && responseData.list) {
            // 遍历后端返回的列表，为每一项手动添加 ext 字段
            responseData.list.forEach(item => {
                // 构建包含 url 的对象，并将其【字符串化】
                item.ext = jsonify({ url: item.vod_id });
            });
        }
        return jsonify(responseData);
    } catch (e) {
        log(`❌ 请求后端/search接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getPlayinfo 函数 (已还原为您的正确版本) ---
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
