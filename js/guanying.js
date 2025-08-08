/**
 * 观影网脚本 - v43.0 (数据合并最终版)
 *
 * --- 核心思想 ---
 * 最终确认：页面返回的是一个包含多种数据格式的“混合体”，且页面JS会在短时间内“自毁”内容。
 * v42的“择一返回”逻辑会导致数据不全。
 * 
 * 本最终版采用“数据合并”策略：
 * 1. 不再择一返回，而是同时执行所有已知的解析路径（_obj.inlist, <li>, .v5d）。
 * 2. 将从所有路径中搜刮到的数据，全部汇集到一个总的数组中。
 * 3. 对汇总后的数据进行去重，确保每个影片只出现一次。
 * 这种“三路并进，统一汇总”的方案，旨在页面自毁前，将其所有角落的数据搜刮干净，从根本上解决“不全”和“变空”的问题。
 *
 * --- 更新日志 ---
 *  - v43.0 (数据合并最终版):
 *    - 【核心重构】parsePage函数采用“数据合并”逻辑，同时执行所有解析路径。
 *    - 【数据汇总】将从不同路径解析到的结果全部添加到一个主数组中。
 *    - 【智能去重】在最后返回结果前，根据影片ID进行去重，保证列表干净、不重复。
 *    - 【终极形态】这应该是能应对该网站复杂、善变前端的最终解决方案。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 43.0, // 数据合并最终版
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
const COOKIE_CACHE_KEY = 'gying_v43_cookie_cache';
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 (通信部分原封不动 ) ==================

function log(msg) { try { $log(`[观影网 V43.0] ${msg}`); } catch (_) { console.log(`[观影网 V43.0] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 终极解析函数 ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

function parsePage(html) {
    let finalCards = [];

    // --- 解析路径1：搜刮 _obj.inlist 数据 ---
    try {
        const scriptContentMatch = html.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (scriptContentMatch && scriptContentMatch[1]) {
            const inlistData = JSON.parse(scriptContentMatch[1]);
            if (inlistData.t && inlistData.i) {
                const vodType = inlistData.ty;
                inlistData.t.forEach((name, index) => {
                    const vodId = inlistData.i[index];
                    if (!vodId) return;
                    const detailApiUrl = `${appConfig.site}res/downurl/${vodType}/${vodId}`;
                    const picUrl = `${appConfig.site}img/${vodType}/${vodId}.webp@https://s.tutu.pm/img/${vodType}/${vodId}/220.webp@https://s.tutu.pm/img/${vodType}/${vodId}.webp`;
                    const remarks = inlistData.q && inlistData.q[index] ? inlistData.q[index].join(' ' ) : '';
                    finalCards.push({ vod_id: detailApiUrl, vod_name: name, vod_pic: picUrl, vod_remarks: remarks, ext: { url: detailApiUrl } });
                });
                log(`路径1 (_obj.inlist) 搜刮到 ${finalCards.length} 个项目。`);
            }
        }
    } catch (e) { log(`路径1解析异常: ${e.message}`); }

    // --- 解析路径2：搜刮 HTML <li> 元素数据 ---
    try {
        const $ = cheerio.load(html);
        let count = 0;
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
            finalCards.push({ vod_id: detailApiUrl, vod_name: name, vod_pic: picUrl, vod_remarks: remarksText, ext: { url: detailApiUrl } });
            count++;
        });
        log(`路径2 (HTML <li>) 搜刮到 ${count} 个项目。`);
    } catch (e) { log(`路径2解析异常: ${e.message}`); }

    // --- 解析路径3：搜刮 .v5d 元素数据 (兼容旧版) ---
    try {
        const $ = cheerio.load(html);
        let count = 0;
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
            let picUrl = $element.find('picture source[data-srcset]').attr('data-srcset') || $element.find('img.lazy[data-src]').attr('data-src');
            if (!picUrl) {
                picUrl = `${appConfig.site}img/${type}/${vodId}.webp@https://s.tutu.pm/img/${type}/${vodId}/220.webp`;
            }
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            finalCards.push({ vod_id: detailApiUrl, vod_name: name, vod_pic: picUrl, vod_remarks: remarks, ext: { url: detailApiUrl } } );
            count++;
        });
        log(`路径3 (.v5d) 搜刮到 ${count} 个项目。`);
    } catch (e) { log(`路径3解析异常: ${e.message}`); }

    // --- 最后去重 ---
    if (finalCards.length === 0) {
        log("❌ 所有路径均未搜刮到任何数据。");
        return [];
    }
    
    const uniqueCards = [];
    const seenIds = new Set();
    for (const card of finalCards) {
        if (!seenIds.has(card.vod_id)) {
            seenIds.add(card.vod_id);
            uniqueCards.push(card);
        }
    }
    
    log(`✅ 数据汇总完成，共 ${finalCards.length} 个项目，去重后剩 ${uniqueCards.length} 个。`);
    return uniqueCards;
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
        // 在这种复杂情况下，即使出错也可能需要一个空的toast
        // $utils.toastError(`加载失败: ${e.message}`, 4000);
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
