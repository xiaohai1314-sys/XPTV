/**
 * 观影网脚本 - v17.3 (最终加固版)
 *
 * --- 核心思想 ---
 * 1.  完全基于用户最初提供的 V17.0 版本。
 * 2.  仅对 `getCards` 函数进行一次性、决定性的修复。
 * 3.  修复方案：放弃在 `getCards` 中使用 Cheerio 和分步查找。改为直接在整个HTML响应文本中
 *     通过正则表达式匹配核心数据 `_obj.inlist`。这使得逻辑最简化，鲁棒性最强。
 * 4.  脚本其余所有部分，包括Cookie逻辑、search、getTracks等，均保持 V17.0 的原貌。
 */

// ================== 配置区 (与V17.0完全一致) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 17.3, // 版本号更新为最终加固版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【全局Cookie缓存】(与V17.0完全一致 ) ★★★★★
let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v17_cookie_cache';
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 (与V17.0完全一致) ==================

function log(msg) { try { $log(`[观影网 V17.3] ${msg}`); } catch (_) { console.log(`[观影网 V17.3] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) { return GLOBAL_COOKIE; }
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) { log("✅ 从本地缓存中恢复了Cookie！"); GLOBAL_COOKIE = cachedCookie; return GLOBAL_COOKIE; }
    } catch (e) { log(`⚠️ 读取本地缓存失败: ${e.message}`); }
    log("缓存未命中或不可用，正在从后端获取...");
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心函数区 - 关键修复】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

/**
 * 【已加固】获取分类页面的卡片列表
 * 此版本直接在原始HTML文本中查找`_obj.inlist`，不再依赖Cheerio，解决了所有已知问题。
 */
async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        // 1. 获取页面HTML纯文本
        const { data: htmlText } = await fetchWithCookie(url);

        // 2. 直接在整个HTML文本中用正则匹配核心数据对象 `_obj.inlist`
        const inlistMatch = htmlText.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) {
            // 抛出更准确的错误信息
            throw new Error("未能从HTML响应中匹配到 '_obj.inlist' 数据块。");
        }

        // 3. 解析JSON数据
        const inlistData = JSON.parse(inlistMatch[1]);
        if (!inlistData || !inlistData.i) {
            log("警告: 解析到的 'inlist' 数据不完整。");
            return jsonify({ list: [] });
        }

        // 4. 遍历数据，构建卡片列表 (此逻辑来自V17.0，但数据源更可靠)
        const cards = inlistData.i.map((item, index) => {
            const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
            return {
                vod_id: detailApiUrl,
                vod_name: inlistData.t[index],
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`, // 正确拼接海报
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl },
            };
        } );

        log(`✅ 成功从JS变量中解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

/**
 * 【保持V17.0原样】获取播放轨道列表
 */
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

/**
 * 【保持V17.0原样】执行搜索
 */
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
            const imgUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
            const additionalInfo = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;
            const match = path.match(/\/([a-z]+)\/(\d+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: imgUrl || '',
                vod_remarks: additionalInfo,
                ext: { url: detailApiUrl },
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 【保持V17.0原样】获取播放链接
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
