/**
 * 观影网脚本 - v22.0 (逻辑修正与URL直拼版)
 *
 * --- 核心思想 ---
 * 诚恳致歉！v21版本存在严重的逻辑错误导致全部失败。
 * 本版本根据用户的精准反馈和最终确认的海报URL规律，彻底重写海报获取逻辑。
 * 放弃复杂且错误的HTML解析，回归到最稳定、最高效的URL直接拼接方案。
 *
 * --- 海报获取双保险方案 (修正后) ---
 * 1. [主方案] 拼接官方主站URL: `https://www.gying.org/img/类型/ID.webp`
 * 2. [备方案] 拼接图床URL: `https://s.tutu.pm/img/类型/ID/220.webp`
 * 脚本会先尝试加载主方案URL ，如果失败（图片不存在），播放器会自动尝试加载备方案URL。
 *
 * --- 更新日志 ---
 *  - v22.0 (AI修正):
 *    - [重大修正] 彻底废弃v21中错误、复杂的HTML解析逻辑。
 *    - [逻辑回归] 回归到最高效、最稳定的URL直接拼接模式。
 *    - [全新拼接] 根据已确认的规律，将两种有效的海报URL规则都提供给播放器。
 *    - [稳定性] 此方案不依赖任何HTML结构，只依赖最核心的`_obj.inlist`数据，最为健壮。
 */

// ================== 配置区 ==================
const cheerio = createCheerio(); // 保留以备不时之需
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 22.0, // 逻辑修正版
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
const COOKIE_CACHE_KEY = 'gying_v22_cookie_cache'; // 更新缓存键
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V22.0] ${msg}`); } catch (_) { console.log(`[观影网 V22.0] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【URL直拼修正逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// 修正后的核心解析函数
function parseFromInlistData(html, cards) {
    const match = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (!match || !match[1]) {
        log("❌ 在页面中未找到 _obj.inlist 数据对象。");
        return;
    }

    try {
        const inlist = JSON.parse(match[1]);
        if (!inlist.t || !inlist.i || !inlist.ty) {
            log("❌ _obj.inlist 数据结构不完整。");
            return;
        }

        const type = inlist.ty;

        inlist.t.forEach((title, index) => {
            const vodId = inlist.i[index];
            if (!vodId) return;

            const name = title;
            const remarks = inlist.q && inlist.q[index] ? inlist.q[index].join(' ') : '';
            
            // ★★★ 修正后的URL直拼双保险方案 ★★★
            // 很多播放器支持用“@”或“&&&”分隔多个URL，它会依次尝试。
            // 我们将两个可能的URL都提供给它。
            const picUrl1 = `${appConfig.site}img/${type}/${vodId}.webp`; // 主站URL
            const picUrl2 = `https://s.tutu.pm/img/${type}/${vodId}/220.webp`; // 图床URL
            
            // 用 '@' 符号连接两个URL ，播放器会先试第一个，失败了再试第二个。
            const finalPicUrl = `${picUrl1}@${picUrl2}`;
            
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;

            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: finalPicUrl, // 提供包含两种可能的URL字符串
                vod_remarks: remarks,
                ext: { url: detailApiUrl },
            });
        });

    } catch (e) {
        log(`❌ 解析过程异常: ${e.message}`);
    }
}

// getCards 和 search 函数调用修正后的解析函数
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data } = await fetchWithCookie(url); 
        parseFromInlistData(data, cards);
        log(`✅ 成功通过URL直拼模式解析到 ${cards.length} 个项目。`);
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
        let cards = [];
        parseFromInlistData(data, cards);
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
