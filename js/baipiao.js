/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0.9 (终极兼容版)
 *
 * 版本说明:
 * 这是一个依赖本地后端服务的客户端脚本。它将所有的数据请求
 * 发送到本地运行的后端API，由后端负责处理所有验证和数据抓取。
 *
 * v4.0.9 更新日志:
 * - [终极兼容] 结合了所有已知问题的修复方案。回归并强化了最初的“数据净化/重生”思想。
 *   在 getCards 函数中，采用最原始、最“笨拙”的方式，手动创建一个全新的 pureItem 对象，
 *   并逐一为其赋值。这旨在解决特定App环境下，因无法识别 puppeteer 返回的复杂对象
 *   而导致列表为空的根本性兼容问题。同时保留了 ext 字段字符串化的正确逻辑。
 */

// ================== 配置区 (原封不动) ==================
const cheerio = createCheerio();

const appConfig = {
    ver: 4.0,
    title: '七味网(我的专属源 )',
    site: 'http://192.168.1.7:3000', // 请确保这里的 IP 和端口是正确的
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 (原封不动 ) ==================
function log(msg   ) { try { $log(`[七味网 v4.0.9] ${msg}`); } catch (_) { console.log(`[七味网 v4.0.9] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// --- getCards 函数 (终极兼容版) ---
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

        // ★★★ 【终极净化/重生】 ★★★
        // 我们假设 App 无法处理 puppeteer 返回的对象，即使它看起来正常。
        // 因此，我们创建一个全新的、纯净的数组。
        const pureCards = [];
        
        // 遍历后端返回的列表
        for (const itemFromBackend of responseData.list) {
            // 对于列表中的每一项，我们都创建一个全新的、纯净的对象。
            const pureItem = {};
            
            // 然后，我们逐一、手动地将属性从旧对象复制到新对象。
            // 这可以确保 pureItem 是一个最简单、最原生的 JavaScript 对象，
            // 没有任何来自 puppeteer 环境的潜在“污染”。
            pureItem.vod_id      = itemFromBackend.vod_id;
            pureItem.vod_name    = itemFromBackend.vod_name;
            pureItem.vod_pic     = itemFromBackend.vod_pic;
            pureItem.vod_remarks = itemFromBackend.vod_remarks;
            
            // 在这里，我们执行已验证为正确的逻辑：将 ext 对象字符串化。
            pureItem.ext = jsonify(itemFromBackend.ext);
            
            // 最后，将这个“绝对纯净”的新对象推入我们的新数组。
            pureCards.push(pureItem);
        }
        
        log(`✅ 数据已终极净化，构造了 ${pureCards.length} 个纯净的列表项。`);
        return jsonify({ list: pureCards });

    } catch (e) {
        log(`❌ getCards 捕获到异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 其他函数保持我们之前验证过的正确版本 ---

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
