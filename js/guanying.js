/**
 * 观影网脚本 - v35.1 (海报代理修复版)
 *
 * --- 核心思想 ---
 * 本版本基于v35.0的健壮解析逻辑，精准修复了海报代理URL的生成错误。
 * 此前版本将代理参数作为路径(Path)拼接，导致后端无法识别。
 * 此修复将参数改为正确的查询参数(Query Parameters)格式，确保后端海报代理服务能被正确调用。
 *
 * --- 更新日志 ---
 *  - v35.1 (海报代理修复):
 *    - 【核心修复】修正了`parsePage`函数中备用海报URL的拼接逻辑。现在会生成 `.../getPoster?type=xx&vodId=xx` 格式的正确URL，以匹配后端接口。
 *    - 【功能完整】保留了v35.0的所有优点，包括移除无用检查和基于.v5d元素的稳定解析。
 *  - v35.0 (无用检查移除):
 *    - 【核心修复】彻底移除了在getCards/search函数中对scriptContent是否存在的检查，因为它已不适用于新的解析模式。
 *    - 【健壮性】现在，即使服务器返回不完整的HTML，脚本也不会崩溃，最多是临时显示空列表。
 *    - 【功能完整】保留了v31版本最完善的、基于HTML元素(.v5d)的解析逻辑和智能海报方案。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ★★★ 请确保这里的IP和端口与你的后端服务一致 ★★★
const BACKEND_URL = 'http://192.168.10.111:5000'; 

const appConfig = {
    ver: '35.1', // 海报代理修复版
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

// ================== 核心函数 (回归v31的稳定逻辑  ) ==================

function log(msg) { try { $log(`[观影网 V35.1] ${msg}`); } catch (_) { console.log(`[观影网 V35.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) {
            log("✅ 从本地缓存中恢复了Cookie！");
            GLOBAL_COOKIE = cachedCookie;
            return GLOBAL_COOKIE;
        }
    } catch (e) { log(`⚠️ 读取本地缓存失败 (可能是冷启动): ${e.message}`); }
    log("缓存未命中，正在从后端获取...");
    try {
        const response = await $fetch.get(`${BACKEND_URL}/getCookie`); // 从后端获取Cookie
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            log("✅ 成功从后端获取并缓存了全局Cookie！");
            try { $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); } catch (e) { log(`⚠️ 写入本地缓存失败: ${e.message}`); }
            return GLOBAL_COOKIE;
        }
        throw new Error(`从后端获取Cookie失败: ${result.message || '未知错误'}`);
    } catch (e) {
        log(`❌ 网络请求后端失败: ${e.message}`);
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【最终的健壮逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// 统一的、带有完美海报方案的解析函数
function parsePage(html) {
    const $ = cheerio.load(html);
    const cards = [];
    // 直接解析.v5d元素，这是最可靠的方式
    $('.v5d').each((_, element) => {
        const $element = $(element);
        const name = $element.find('b').text().trim();
        const remarks = $element.find('p').text().trim();
        const path = $element.find('a').attr('href');
        if (!path) return;

        const match = path.match(/\/([a-z]+)\/(\w+)/);
        if (!match) return;
        const type = match[1];
        const vodId = match[2];

        // 智能提取海报
        let picUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
        if (!picUrl) {
            picUrl = $element.find('img.lazy[data-src]').attr('data-src');
        }
        
        // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
        // ★★★ 核心修复：如果无法直接提取到海报，则拼接一个指向后端代理的、带有正确查询参数的URL ★★★
        if (!picUrl) {
            picUrl = `${BACKEND_URL}/getPoster?type=${type}&vodId=${vodId}`;
        }
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
        cards.push({
            vod_id: detailApiUrl,
            vod_name: name,
            vod_pic: picUrl,
            vod_remarks: remarks,
            ext: { url: detailApiUrl },
        } );
    });
    return cards;
}


async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        // ★★★ 核心修改：不再需要任何script检查，直接解析 ★★★
        const cards = parsePage(data);
        log(`✅ 成功解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        // 这里只在网络请求本身失败时才会触发，而不是因为解析失败
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`请求搜索页: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        // ★★★ 核心修改：不再需要任何script检查，直接解析 ★★★
        const cards = parsePage(data);
        log(`✅ 成功解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks 和 getPlayinfo 保持不变 ---
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
    log(`请求详情数据: ${url}`);
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
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
