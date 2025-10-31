/**
 * reboys.cn 前端插件 - V39-Diag-NumericID (数字ID诊断版)
 * 
 * 核心诊断：
 * - 测试纯数字字符串作为 vod_id 是否能被APP框架正确传递。
 * - getTracks 函数将明确显示它接收到的ID是什么，或者是否为空。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000"; // 确保这是您后端服务的正确地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V39] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V39-Diag-NumericID ====");
    return jsonify({ ver: 1, title: 'reboys搜(V39-Diag)', site: SITE_URL, tabs: [] });
}

// --- 首页/分类 (为避免干扰，暂时返回空) ---
async function getCards(ext) {
    return jsonify({ list: [] });
}

// --- 搜索函数 (保持不变) ---
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 搜索: "${keyword}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);
        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        return jsonify({ list: response.list });
    } catch (e) {
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ getTracks函数 - 诊断版：明确显示收到的ID ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    const receivedId = ext.vod_id || '';
    log(`[getTracks] 诊断开始，收到的原始 vod_id 是: "${receivedId}"`);

    // 1. 最关键的诊断步骤：检查ID是否为空
    if (!receivedId) {
        log(`[getTracks] 诊断结果：收到的ID为空值！`);
        return jsonify({ list: [{ title: '诊断报告', tracks: [{ name: '错误：插件收到的ID为空', pan: '' }] }] });
    }

    // 2. 如果ID不是空，我们把它显示出来，并尝试用它请求后端
    log(`[getTracks] 诊断结果：收到非空ID，值为 "${receivedId}"。现在尝试用它请求后端...`);
    try {
        const url = `${BACKEND_URL}/resolve_id?id=${encodeURIComponent(receivedId)}`;
        const fetchResult = await $fetch.get(url);
        const response = argsify(fetchResult.data || fetchResult);

        if (!response.success || !response.links) {
            // 如果后端解析失败，也把收到的ID显示出来，方便排查
            const errorMsg = `后端解析失败: ${response.message || '未知错误'}. (发送给后端的ID是: ${receivedId})`;
            throw new Error(errorMsg);
        }

        const links = response.links;
        if (links.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
        }

        // 3. 渲染链接
        const tracks = links.map((linkData, index) => {
            const url = linkData.url || '';
            const password = linkData.password || '';
            let panType = '网盘';
            if (linkData.type === 'quark' || url.includes('quark.cn')) panType = '夸克';
            else if (linkData.type === 'aliyun' || url.includes('aliyundrive.com')) panType = '阿里';
            else if (linkData.type === 'baidu' || url.includes('pan.baidu.com')) panType = '百度';
            const buttonName = `${panType}网盘 ${index + 1}`;
            const nameWithPassword = password ? `${buttonName}（密码:${password}）` : buttonName;
            return { name: nameWithPassword, pan: url, ext: {} };
        });

        return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ list: [{ title: '诊断报告', tracks: [{ name: `请求后端时出错: ${e.message}`, pan: '' }] }] });
    }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { return jsonify({ class: [] }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ parse: 0, url: id }); }

log('==== 插件加载完成 V39-Diag-NumericID ====');
