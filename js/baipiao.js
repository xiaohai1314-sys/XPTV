/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0.6 (修正版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。它将所有的数据请求
 * 发送到本地运行的后端API，由后端负责处理所有验证和数据抓取。
 *
 * v4.0.6 更新日志:
 * - [关键修复] 修正了 getCards 函数中 ext 字段的构建逻辑。
 *   之前直接传递了后端返回的 ext 对象，导致前端渲染引擎无法解析。
 *   现已改为将 ext 对象通过 jsonify (JSON.stringify) 转换为字符串，
 *   确保符合应用框架的渲染和点击跳转要求，从而解决了列表页为空的问题。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();

const appConfig = {
    ver: 4.0,
    title: '七味网(我的专属源 )',
    site: 'http://192.168.1.4:3000',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg    ) { try { $log(`[七味网 v4.0.6] ${msg}`); } catch (_) { console.log(`[七味网 v4.0.6] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/list?id=${ext.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        // 1. 从后端获取数据对象
        const responseData = await $fetch.get(url);
        if (!responseData || !responseData.list || responseData.list.length === 0) {
            log('后端返回数据为空或格式不正确。');
            return jsonify({ list: [] });
        }

        // 2. 【【【 核心修正：数据净化并正确构建 ext 】】】
        const pureCards = [];
        for (const item of responseData.list) {
            pureCards.push({
                vod_id: item.vod_id,
                vod_name: item.vod_name,
                vod_pic: item.vod_pic,
                vod_remarks: item.vod_remarks,
                
                // ★★★ 唯一的、关键的修改点在这里 ★★★
                // 将后端返回的 ext 对象【字符串化】，以符合前端框架要求
                ext: jsonify(item.ext),
            });
        }
        
        log(`✅ 数据已净化，并为 ${pureCards.length} 个列表项正确构建了 ext 字段。`);

        // 3. 将纯净的数据对象传递给 jsonify
        return jsonify({ list: pureCards });

    } catch (e) {
        log(`❌ getCards 捕获到异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 其他函数保持原样，无需修改
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
            responseData.list.forEach(item => {
                // 在搜索结果中，我们同样需要构建一个【字符串化】的 ext
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
