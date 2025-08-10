/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0.5 (终极净化版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。它将所有的数据请求
 * 发送到本地运行的后端API，由后端负责处理所有验证和数据抓取。
 *
 * v4.0.5 更新日志:
 * - [重大修复] 解决了数据从后端返回后，因App环境兼容性问题导致无法渲染的根本原因。
 *   在 getCards 函数中增加了“数据净化”步骤：手动遍历从后端获取的列表，
 *   重新创建一个纯净、原生的JavaScript对象数组，确保App渲染引擎能正确识别。
 *   这完美复刻了 v3.0 纯前端脚本在内存中处理数据的成功模式。
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
function log(msg   ) { try { $log(`[七味网 v4.0.5] ${msg}`); } catch (_) { console.log(`[七味网 v4.0.5] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/list?id=${ext.id.id}&pageNum=${ext.page || 1}`;
    log(`请求后端API: ${url}`);
    try {
        // 1. 从后端获取数据对象
        const responseData = await $fetch.get(url);
        if (!responseData || !responseData.list || responseData.list.length === 0) {
            log('后端返回数据为空或格式不正确。');
            return jsonify({ list: [] });
        }

        // 2. 【【【 核心修复：数据净化/重生 】】】
        const pureCards = [];
        for (const item of responseData.list) {
            pureCards.push({
                vod_id: item.vod_id,
                vod_name: item.vod_name,
                vod_pic: item.vod_pic,
                vod_remarks: item.vod_remarks,
                ext: item.ext,
            });
        }
        
        log(`✅ 数据已净化，构造了 ${pureCards.length} 个纯净的列表项。`);

        // 3. 将纯净的数据对象传递给 jsonify
        return jsonify({ list: pureCards });

    } catch (e) {
        log(`❌ getCards 捕获到异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 其他函数保持 v4.0.4 的正确逻辑
async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/detail?urlPath=${ext.url}`;
    log(`请求后端API: ${url}`);
    try {
        // 详情页和搜索页的 $fetch 行为可能不同，保留原始的 {data} 解构
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
        // 搜索功能由前端脚本自己添加 ext，保持 v4.0 的模式
        const responseData = await $fetch.get(url);
        if (responseData && responseData.list) {
            responseData.list.forEach(item => {
                item.ext = { url: item.vod_id };
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
