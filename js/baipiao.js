/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v5.0 (后端主导版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。
 *
 * v5.0 更新日志:
 * - [架构变更] 前端 getCards 函数不再进行任何数据处理、净化或重构。
 * - [核心改动] getCards 现在仅负责请求后端，并将后端返回的、已完全处理好的数据直接转发给App。
 *   所有复杂的、可能引发兼容性问题的操作全部移至后端完成。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();

const appConfig = {
    ver: 5.0,
    title: '七味网(我的专属源 )',
    site: 'http://192.168.1.7:3000', // 请确保这里的 IP 和端口是正确的
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg    ) { try { $log(`[七味网 v5.0] ${msg}`); } catch (_) { console.log(`[七味网 v5.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// --- getCards 函数 (全新简化版) ---
async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/list?id=${ext.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API (v5.0模式): ${url}`);
    try {
        // 从后端获取已经完全处理好的数据对象
        const finalData = await $fetch.get(url);
        
        // 直接将这个对象字符串化后返回给 App，不做任何额外处理
        log(`✅ 已从后端接收到成品数据，直接转发。`);
        return jsonify(finalData);

    } catch (e) {
        log(`❌ getCards 捕获到异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 搜索和详情函数保持不变，因为它们原本的逻辑就是正确的 ---

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
        const responseData = await $fetch.get(url);
        if (responseData && responseData.list) {
            // 搜索结果的处理依然保留在前端，因为它逻辑简单且工作正常
            responseData.list.forEach(item => {
                item.ext = jsonify({ url: item.vod_id });
            });
        }
        return jsonify(responseData);
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
