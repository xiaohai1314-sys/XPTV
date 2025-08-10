/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0.7 (远程日志诊断版)
 *
 * 版本说明:
 * 这是一个用于诊断的特殊版本。它会在 getCards 函数执行的关键步骤，
 * 通过 POST 请求将变量的状态和类型发送到后端的 /log 接口，
 * 以便我们能在后端控制台观察到前端脚本的内部执行情况。
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
function log(msg   ) { try { $log(`[七味网 v4.0.7] ${msg}`); } catch (_) { console.log(`[七味网 v4.0.7] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 【【【 新增：远程日志函数 】】】
async function remoteLog(message) {
    try {
        // 使用 $fetch.post 发送日志，不关心返回值。
        // 必须设置正确的 Content-Type 头，以便后端 express.json() 中间件能解析。
        await $fetch.post(`${appConfig.site}/log`, {
            headers: { 'Content-Type': 'application/json' },
            json: { message: message }
        });
    } catch (e) {
        // 远程日志失败，不影响主流程。可以在App的日志中看到这个错误。
        log(`远程日志发送失败: ${e.message}`);
    }
}

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/list?id=${ext.id}&pageNum=${ext.page || 1}`;
    await remoteLog(`[1] 即将请求URL: ${url}`);
    
    try {
        // 执行网络请求
        const responseData = await $fetch.get(url);
        
        // 记录收到的数据状态
        await remoteLog({
            step: '[2] $fetch.get 成功',
            type: typeof responseData,
            hasListProperty: responseData ? responseData.hasOwnProperty('list') : 'N/A',
            listLength: responseData && responseData.list ? responseData.list.length : 'N/A',
            firstItem: responseData && responseData.list && responseData.list.length > 0 ? responseData.list[0] : 'N/A'
        });

        // 执行 JSON 转换
        const jsonString = jsonify(responseData);

        // 记录转换后的字符串状态
        await remoteLog({
            step: '[3] jsonify 成功',
            type: typeof jsonString,
            contentSnippet: jsonString.substring(0, 200) + '...'
        });

        await remoteLog('[4] 即将返回最终的JSON字符串给App');
        return jsonString;

    } catch (e) {
        await remoteLog(`[E] getCards 捕获到异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/detail?urlPath=${ext.url}`;
    try {
        const { data } = await $fetch.get(url);
        return jsonify(data);
    } catch (e) {
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(ext.text)}`;
    try {
        const responseData = await $fetch.get(url);
        if (responseData && responseData.list) {
            responseData.list.forEach(item => {
                item.ext = { url: item.vod_id };
            });
        }
        return jsonify(responseData);
    } catch (e) {
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
