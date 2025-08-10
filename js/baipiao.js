/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.3 (最终正确版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。它将所有的数据请求
 * 发送到本地运行的后端API，由后端负责处理所有验证和数据抓取。
 *
 * v4.3 更新日志:
 * - [重大修复] 修正了 getConfig 函数的返回值。该函数现在直接返回 appConfig 对象，
 *   而不是JSON字符串，解决了App无法加载分类列表（“列表都没有了”）的根本问题。
 * - [保留] 保留了 v4.2 版本对 getCards, getTracks, search 函数的所有修复，
 *   确保在分类列表恢复后，数据能够正确加载和显示。
 */

// ================== 配置区 ==================
const cheerio = createCheerio(); // 保留，以防某些App环境需要它

// 【核心配置】将site指向您本地运行的后端服务地址
// 1. 如果App和电脑在同一个局域网，请填写电脑的局域网IP地址 (例如: 'http://192.168.1.101:3000'  )
// 2. 如果您在电脑安卓模拟器上运行App，通常可以使用 'http://10.0.2.2:3000'
const appConfig = {
    ver: 4.3, // 版本号更新为 4.3
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
function log(msg   ) { try { $log(`[七味网 v4.3] ${msg}`); } catch (_) { console.log(`[七味网 v4.3] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 (已全部简化) ==================

async function init(ext) { return jsonify({}); }

// 【【【 已修复 】】】
// 此函数必须直接返回JavaScript对象，而不是JSON字符串，以确保App能正确加载配置。
async function getConfig() {
    return appConfig;
}

async function getCards(ext) {
    log(`getCards 接收到原始 ext: [${typeof ext}] ${JSON.stringify(ext)}`);
    const params = argsify(ext);
    const url = `${appConfig.site}/list?id=${params.id}&pageNum=${params.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        log(`✅ 成功从后端获取到列表数据。`);
        return jsonify(responseData);
    } catch (e) {
        log(`❌ 请求后端/list接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    const params = argsify(ext);
    const url = `${appConfig.site}/detail?urlPath=${params.url}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        log(`✅ 成功从后端获取到详情数据。`);
        return jsonify(responseData);
    } catch (e) {
        log(`❌ 请求后端/detail接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    const params = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(params.text)}`;
    log(`请求后端API: ${url}`);
    try {
        const responseData = await $fetch.get(url);
        if (responseData && responseData.list) {
            responseData.list.forEach(item => {
                item.ext = { url: item.vod_id };
            });
        }
        log(`✅ 成功从后端获取到搜索数据。`);
        return jsonify(responseData);
    } catch (e) {
        log(`❌ 请求后端/search接口异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    const params = argsify(ext);
    const panLink = params.pan;
    const password = params.pwd;
    let finalUrl = panLink;
    if (password) {
        finalUrl += `\n提取码: ${password}`;
    }
    return jsonify({ urls: [finalUrl] });
}
