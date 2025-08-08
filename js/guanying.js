/**
 * 观影网脚本 - v18.0 (最终统一逻辑版)
 *
 * --- 核心思想 ---
 * 经过深入分析，确认了问题的根源在于 s.tutu.pm 图床资源不完整，
 * 以及 _obj.inlist 数据的局限性。本版本采用终极解决方案，统一所有逻辑。
 *
 * --- 更新日志 ---
 *  - v18.0 (AI重构):
 *    - [重大重构] `getCards` 函数彻底放弃解析 `_obj.inlist`，因为它会导致部分海报丢失。
 *    - [逻辑统一] `getCards` 和 `search` 现在采用完全相同的、最可靠的逻辑：
 *      直接解析HTML页面中的影片卡片元素(.v5d)，确保数据完整性。
 *    - [双保险海报] 所有海报获取均采用“首选(data-srcset) + 备用(拼接)”的双重保险策略，
 *      确保在任何情况下都能最大可能地显示海报。
 *    - 此版本旨在一次性、一劳永逸地解决所有已知问题。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 18.0, // 全新版本号
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
const COOKIE_CACHE_KEY = 'gying_v18_cookie_cache'; // 更新缓存键
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg   ) { try { $log(`[观影网 V18.0] ${msg}`); } catch (_) { console.log(`[观影网 V18.0] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【最终统一逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// 统一的影片卡片解析函数
function parseMovieCards($, cards) {
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
        
        // 双保险海报获取逻辑
        let picUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
        if (!picUrl) {
            picUrl = `https://s.tutu.pm/img/${type}/${vodId}.webp`;
        }
        
        const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
        
        cards.push({
            vod_id: detailApiUrl,
            vod_name: name,
            vod_pic: picUrl,
            vod_remarks: remarks,
            ext: { url: detailApiUrl },
        } );
    });
}

// 重构后的 getCards 函数
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data } = await fetchWithCookie(url); 
        const $ = cheerio.load(data);
        parseMovieCards($, cards); // 调用统一的解析函数
        log(`✅ 成功通过DOM解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// 重构后的 search 函数
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
        parseMovieCards($, cards); // 调用统一的解析函数
        log(`✅ 成功从搜索结果中解析到 ${cards.length} 个项目。`);
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
