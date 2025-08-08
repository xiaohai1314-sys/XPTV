/**
 * 观影网脚本 - v40.0 (择优录取最终版)
 *
 * --- 核心思想 ---
 * v39版本的“优先/回退”逻辑存在缺陷：当页面同时存在_obj.inlist和HTML元素，但_obj.inlist为空或无效时，脚本会错误地选择它并返回空列表。
 * 
 * 本最终版本采用“择优录取”的全新逻辑：
 * 1. 同时尝试解析 _obj.inlist 和 HTML <li> 元素，分别得到两份数据。
 * 2. 比较两份数据的结果，选择其中包含项目更多（更丰富）的一份作为最终结果返回。
 * 这种方法可以智能地忽略无效或空的数据源，确保在任何复杂的页面结构下都能采用最有效的数据进行解析。
 *
 * --- 更新日志 ---
 *  - v40.0 (择优录取最终版):
 *    - 【核心重构】parsePage 函数彻底重写，不再使用“回退”逻辑，而是“择优”逻辑。
 *    - 【智能决策】函数会同时执行两种解析，并返回包含更多卡片数量的那个结果。
 *    - 【终极健壮】从根本上解决了因数据源混乱或存在“假数据”而导致列表为空的问题。
 */

// ================== 配置区 (原封不动) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 40.0, // 择优录取最终版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【全局Cookie缓存】(原封不动 ) ★★★★★
let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v40_cookie_cache';
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 (通信部分原封不动) ==================

function log(msg) { try { $log(`[观影网 V40.0] ${msg}`); } catch (_) { console.log(`[观影网 V40.0] ${msg}`); } }
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
        const response = await $fetch.get(BACKEND_URL);
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 核心修改区域 ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

/**
 * 统一的、采用“择优录取”逻辑的页面解析函数
 * @param {string} html 网页的HTML源码
 * @returns {Array} 卡片对象数组
 */
function parsePage(html) {
    let cardsFromObj = [];
    let cardsFromHtml = [];

    // --- 解析路径1：尝试解析 _obj.inlist ---
    const scriptContentMatch = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (scriptContentMatch && scriptContentMatch[1]) {
        try {
            const inlistData = JSON.parse(scriptContentMatch[1]);
            if (inlistData.t && inlistData.i) {
                const vodType = inlistData.ty;
                inlistData.t.forEach((name, index) => {
                    const vodId = inlistData.i[index];
                    if (!vodId) return;
                    const detailApiUrl = `${appConfig.site}res/downurl/${vodType}/${vodId}`;
                    const picUrl1 = `${appConfig.site}img/${vodType}/${vodId}.webp`;
                    const picUrl2 = `https://s.tutu.pm/img/${vodType}/${vodId}/220.webp`;
                    const picUrl3 = `https://s.tutu.pm/img/${vodType}/${vodId}.webp`;
                    const picUrl = `${picUrl1}@${picUrl2}@${picUrl3}`;
                    const remarks = inlistData.q && inlistData.q[index] ? inlistData.q[index].join(' ' ) : '';
                    cardsFromObj.push({ vod_id: detailApiUrl, vod_name: name, vod_pic: picUrl, vod_remarks: remarks, ext: { url: detailApiUrl } });
                });
            }
        } catch (e) {
            log(`⚠️ 解析 _obj.inlist 时发生错误: ${e.message}`);
        }
    }
    log(`路径1 (_obj.inlist) 解析到 ${cardsFromObj.length} 个项目。`);

    // --- 解析路径2：尝试解析 HTML <li> 元素 ---
    try {
        const $ = cheerio.load(html);
        $('ul.content-list > li').each((_, element) => {
            const $li = $(element);
            const $anchor = $li.find('a').first();
            const path = $anchor.attr('href');
            const name = $anchor.attr('title');
            const $image = $li.find('img.lazy');
            const picUrl = $image.attr('data-src');
            const remarksText = $li.find('.li-bottom').text().trim();
            if (!path || !name || !picUrl) return;
            const match = path.match(/\/([a-z]+)\/(\w+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            cardsFromHtml.push({ vod_id: detailApiUrl, vod_name: name, vod_pic: picUrl, vod_remarks: remarksText, ext: { url: detailApiUrl } });
        });
    } catch (e) {
        log(`⚠️ 解析 HTML <li> 时发生错误: ${e.message}`);
    }
    log(`路径2 (HTML <li>) 解析到 ${cardsFromHtml.length} 个项目。`);

    // --- 最终决策：择优录取 ---
    if (cardsFromHtml.length > cardsFromObj.length) {
        log(`✅ 最终决策：选择 HTML <li> 解析结果 (${cardsFromHtml.length} 个项目)。`);
        return cardsFromHtml;
    } else {
        log(`✅ 最终决策：选择 _obj.inlist 解析结果 (${cardsFromObj.length} 个项目)。`);
        return cardsFromObj;
    }
}


async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const cards = parsePage(data);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
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
        const cards = parsePage(data);
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
