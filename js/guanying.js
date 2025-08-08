/**
 * 观影网脚本 - v35.3 (远程诊断版)
 *
 * --- 核心思想 ---
 * 解决前端App无日志查看能力的问题。本版本引入了“前端告警，后端记录”机制。
 * 当解析失败时，前端不再静默返回空列表，而是主动向后端发送一条包含错误信息和问题HTML的报告。
 * 这使得开发者可以通过查看后端控制台日志，来远程诊断发生在用户设备上的问题。
 *
 * --- 更新日志 ---
 *  - v35.3 (远程诊断版):
 *    - 【诊断革命】新增`reportErrorToBackend`函数，用于向后端`/logError`接口发送POST请求。
 *    - 【智能告警】`parsePage`函数在解析失败（如找不到卡片元素）时，会调用上述函数，将问题现场(HTML)发送给后端进行分析。
 *    - 【代码健壮】使用`try...catch`包裹告警函数，确保即使日志发送失败，也不会影响主流程。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000'; 

const appConfig = {
    ver: '35.3', // 远程诊断版
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

function log(msg ) { try { $log(`[观影网 V35.3] ${msg}`); } catch (_) { console.log(`[观影网 V35.3] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★★★ 新增：错误报告函数 ★★★
async function reportErrorToBackend(message, htmlContent) {
    try {
        log(`[远程诊断] 检测到严重错误: ${message}。正在上报给后端...`);
        // 使用 $fetch.post 发送错误报告
        await $fetch.post(`${BACKEND_URL}/logError`, {
            headers: { 'Content-Type': 'application/json' },
            data: {
                message: `[观影网 V35.3] ${message}`,
                htmlContent: htmlContent || ""
            }
        });
    } catch (e) {
        // 如果日志上报本身都失败了，我们也无能为力，只能在本地（如果可能）记录一下
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
        // ★★★ 核心诊断点 ★★★
        // 如果找不到任何卡片，就向后端报告这个问题，并附上当前的HTML内容
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
