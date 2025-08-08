/**
 * 观影网脚本 - v17.4 (智能融合最终版)
 *
 * --- 核心思想 ---
 * 以V17.0为基础，打造一个能智能适应网站变化的健壮脚本。
 *
 * --- 更新日志 ---
 *  - v17.4 (由AI优化):
 *    - [智能getCards] `getCards`函数采用混合模式：
 *      1. **优先尝试**V17.0的核心方法，解析`<script>`中的`_obj.inlist`变量，高效、准确。
 *      2. **如果失败**，则自动无缝切换到备用方案，通过解析HTML DOM元素获取数据。
 *      这完美解决了因网站返回不同页面而导致的“加载失败”问题。
 *    - [保持优化] `search`函数保留了对海报URL获取的优化，确保搜索结果海报的稳定性。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 17.4, // 版本号更新
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
const COOKIE_CACHE_KEY = 'gying_v17_cookie_cache';
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg   ) { try { $log(`[观影网 V17.4] ${msg}`); } catch (_) { console.log(`[观影网 V17.4] ${msg}`); } }
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
    } catch (e) { log(`⚠️ 读取本地缓存失败: ${e.message}`); }
    
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【智能融合的函数】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithCookie(url); 
        const $ = cheerio.load(data);

        // --- 方案一：优先尝试V17.0的script解析法 ---
        log("优先尝试 [方案一]: 解析script中的_obj.inlist...");
        const scriptContent = $('script').filter((_, script) => {
            return $(script).html().includes('_obj.inlist');
        }).html();

        let inlistMatch;
        if (scriptContent) {
            inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
        }

        if (inlistMatch && inlistMatch[1]) {
            const inlistData = JSON.parse(inlistMatch[1]);
            if (inlistData && inlistData.i) {
                inlistData.i.forEach((item, index) => {
                    const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
                    cards.push({
                        vod_id: detailApiUrl,
                        vod_name: inlistData.t[index],
                        vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                        vod_remarks: inlistData.g[index],
                        ext: { url: detailApiUrl },
                    } );
                });
                log(`✅ [方案一] 成功！从JS变量中解析到 ${cards.length} 个项目。`);
                return jsonify({ list: cards });
            }
        }

        // --- 方案二：如果方案一失败，则自动启用DOM解析法 ---
        log("⚠️ [方案一] 失败，自动切换到 [方案二]: 直接解析HTML元素...");
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const name = $element.find('b').text().trim();
            const remarks = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;
            const match = path.match(/\/([a-z]+)\/(\w+)/);
            if (!match) return;
            const type = match[1], vodId = match[2];
            cards.push({
                vod_id: `${appConfig.site}res/downurl/${type}/${vodId}`,
                vod_name: name,
                vod_pic: `https://s.tutu.pm/img/${type}/${vodId}.webp`,
                vod_remarks: remarks,
                ext: { url: `${appConfig.site}res/downurl/${type}/${vodId}` },
            } );
        });

        if (cards.length > 0) {
            log(`✅ [方案二] 成功！通过DOM解析到 ${cards.length} 个项目。`);
        } else {
            log("❌ [方案二] 也失败了。页面上既没有_obj.inlist，也没有.v5d元素。请检查Cookie或网站结构。");
            $utils.toastError("加载失败，请检查Cookie或更新脚本", 4000);
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        let cards = [];
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const name = $element.find('b').text().trim();
            const additionalInfo = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;
            let picUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
            if (!picUrl) {
                const match = path.match(/\/([a-z]+)\/(\w+)/);
                if (match) picUrl = `https://s.tutu.pm/img/${match[1]}/${match[2]}.webp`;
            }
            const match = path.match(/\/([a-z]+ )\/(\w+)/);
            if (!match) return;
            const type = match[1], vodId = match[2];
            cards.push({
                vod_id: `${appConfig.site}res/downurl/${type}/${vodId}`,
                vod_name: name,
                vod_pic: picUrl || '',
                vod_remarks: additionalInfo,
                ext: { url: `${appConfig.site}res/downurl/${type}/${vodId}` },
            });
        });
        log(`✅ 成功从搜索结果中解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 其他函数保持不变 ---
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
