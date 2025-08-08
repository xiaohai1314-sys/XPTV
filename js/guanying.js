/**
 * 观影网脚本 - v35.4 (请求体修复诊断版)
 *
 * --- 核心思想 ---
 * 针对后端持续报错 "req.body is undefined" 的问题，进行最终的、釜底抽薪式的修复。
 * 经查，前端插件在发送POST报告时，将数据错误地包裹在 'data' 字段中，导致后端无法解析。
 * 本版本直接修正了请求体结构，确保后端能正确接收诊断信息。
 *
 * --- 更新日志 ---
 *  - v35.4 (请求体修复诊断版):
 *    - 【致命修复】修正了`reportErrorToBackend`函数。现在它会直接将JSON对象作为请求体发送，而不是包裹在'data'字段里，从根源上解决后端无法解析的问题。
 *    - 【保持健壮】保留了之前版本的所有远程诊断逻辑。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000'; 

const appConfig = {
    ver: '35.4', // 请求体修复诊断版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【全局Cookie缓存】★★★★★
let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v35_cookie_cache';
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V35.4] ${msg}`); } catch (_) { console.log(`[观影网 V35.4] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★★★ 错误报告函数 (已修复) ★★★
async function reportErrorToBackend(message, htmlContent) {
    try {
        log(`[远程诊断] 检测到严重错误: ${message}。正在上报给后端...`);
        
        // ★★★ 核心修复：直接将JSON对象作为请求体，不再使用 'data' 字段包裹 ★★★
        const reportData = {
            message: `[观影网 V35.4] ${message}`,
            htmlContent: htmlContent || ""
        };

        await $fetch.post(`${BACKEND_URL}/logError`, {
            headers: { 'Content-Type': 'application/json' },
            // 直接传递数据对象
            ...reportData 
        });
    } catch (e) {
        log(`❌ [远程诊断] 错误报告发送失败: ${e.message}`);
    }
}

async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) { GLOBAL_COOKIE = cachedCookie; return GLOBAL_COOKIE; }
    } catch (e) {}
    try {
        const response = await $fetch.get(`${BACKEND_URL}/getCookie`);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            try { $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); } catch (e) {}
            return GLOBAL_COOKIE;
        }
        throw new Error(`从后端获取Cookie失败: ${result.message || '未知错误'}`);
    } catch (e) {
        $utils.toastError(`无法连接Cookie后端: ${e.message}`, 5000);
        throw e;
    }
}

async function fetchWithCookie(url, options = {}) {
    const cookie = await ensureGlobalCookie();
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【最终的健壮解析逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

function parsePage(html) {
    if (!html || html.length < 200) {
        reportErrorToBackend("传入的HTML无效或过短", `HTML长度: ${html ? html.length : 'null'}`);
        return [];
    }

    const $ = cheerio.load(html);
    const cards = [];
    const cardElements = $('.v5d');

    if (cardElements.length === 0) {
        reportErrorToBackend("解析失败：在HTML中未找到任何 '.v5d' 卡片元素。网站结构可能已变更。", html);
        return []; 
    }

    cardElements.each((_, element) => {
        const $element = $(element);
        const name = $element.find('b').text().trim();
        const path = $element.find('a').attr('href');
        if (!name || !path) return;

        const match = path.match(/\/([a-z]+)\/(\w+)/);
        if (!match) return;
        const type = match[1];
        const vodId = match[2];

        let picUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
        if (!picUrl) picUrl = $element.find('img.lazy[data-src]').attr('data-src');
        if (!picUrl) picUrl = `${BACKEND_URL}/getPoster?type=${type}&vodId=${vodId}`;

        cards.push({
            vod_id: `${appConfig.site}res/downurl/${type}/${vodId}`,
            vod_name: name,
            vod_pic: picUrl,
            vod_remarks: $element.find('p').text().trim(),
            ext: { url: `${appConfig.site}res/downurl/${type}/${vodId}` },
        });
    });
    return cards;
}

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.id}${ext.page || 1}`;
    try {
        const { data } = await fetchWithCookie(url);
        const cards = parsePage(data);
        return jsonify({ list: cards });
    } catch (e) {
        reportErrorToBackend(`getCards函数发生网络或上层异常: ${e.message}`, `请求的URL: ${url}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/s/1---${ext.page || 1}/${encodeURIComponent(ext.text)}`;
    try {
        const { data } = await fetchWithCookie(url);
        const cards = parsePage(data);
        return jsonify({ list: cards });
    } catch (e) {
        reportErrorToBackend(`search函数发生网络或上层异常: ${e.message}`, `请求的URL: ${url}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks 和 getPlayinfo 保持不变 ---
async function getTracks(ext) { /* ...无改动... */ }
async function getPlayinfo(ext) { /* ...无改动... */ }

// 为了方便复制，附上无改动的函数
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
    try {
        const { data } = await fetchWithCookie(url);
        const respstr = JSON.parse(data);
        if (respstr.hasOwnProperty('panlist')) {
            const regex = { '中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g, '原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g };
            respstr.panlist.url.forEach((item, index) => {
                let name = '';
                for (const keyword in regex) {
                    const matches = (respstr.panlist.name[index] || '').match(regex[keyword]);
                    if (matches) name = `${name}${matches[0]}`;
                }
                tracks.push({ name: name || respstr.panlist.name[index], pan: item, ext: { url: '' } });
            });
        } else if (respstr.hasOwnProperty('file')) {
            $utils.toastError('网盘验证掉签，请前往主站完成验证或更新Cookie');
        } else {
            $utils.toastError('没有找到网盘资源');
        }
        return jsonify({ list: [{ title: '默认分组', tracks }] });
    } catch (e) {
        reportErrorToBackend(`getTracks函数发生异常: ${e.message}`, `请求的URL: ${url}`);
        return jsonify({ list: [] });
    }
}
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
