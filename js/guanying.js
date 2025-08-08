/**
 * 观影网脚本 - v26.0 (兼容性修复版)
 *
 * --- 核心思想 ---
 * 解决了v24/v25版本中 "Can't find variable: setTimeout" 的致命错误。
 * 原因是脚本运行环境不支持标准的setTimeout函数，导致为反爬虫而加入的延迟功能崩溃。
 * 本版本移除了所有延迟相关的代码，以确保在非标准JS环境下的基本可用性。
 *
 * --- 更新日志 ---
 *  - v26.0 (AI兼容性修复):
 *    - [重大修复] 删除了导致崩溃的 sleep 函数和所有对它的调用。
 *    - [功能回退] 暂时取消了请求延迟功能，优先保证脚本能成功加载和运行。
 *    - [逻辑保留] 保留了v23版本中稳定有效的“URL直拼双保险”海报方案。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 26.0, // 兼容性修复版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【全局Cookie管理】★★★★★
let GLOBAL_COOKIE = null;
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V26.0] ${msg}`); } catch (_) { console.log(`[观影网 V26.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 移除了 sleep 函数

async function ensureGlobalCookie() {
    // 由于移除了延迟，暂时也简化Cookie缓存逻辑，每次都从后端获取以保证最新
    if (GLOBAL_COOKIE) {
        log("✅ 使用已有的全局Cookie。");
        return GLOBAL_COOKIE;
    }
    
    log("首次加载，将从后端获取Cookie...");
    try {
        const response = await $fetch.get(BACKEND_URL);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            log("✅ 成功从后端获取并缓存了全局Cookie！");
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【URL直拼稳定逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

function parseFromInlistData(html, cards) {
    const match = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (!match || !match[1]) {
        log("❌ 在页面中未找到 _obj.inlist 数据对象。");
        return;
    }
    try {
        const inlist = JSON.parse(match[1]);
        if (!inlist.t || !inlist.i || !inlist.ty) { return; }
        const type = inlist.ty;
        inlist.t.forEach((title, index) => {
            const vodId = inlist.i[index];
            if (!vodId) return;
            const name = title;
            const remarks = inlist.q && inlist.q[index] ? inlist.q[index].join(' ') : '';
            const picUrl1 = `${appConfig.site}img/${type}/${vodId}.webp`;
            const picUrl2 = `https://s.tutu.pm/img/${type}/${vodId}/220.webp`;
            const finalPicUrl = `${picUrl1}@${picUrl2}`;
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            cards.push({ vod_id: detailApiUrl, vod_name: name, vod_pic: finalPicUrl, vod_remarks: remarks, ext: { url: detailApiUrl } } );
        });
    } catch (e) { log(`❌ 解析过程异常: ${e.message}`); }
}

// getCards 和 search 函数移除了请求延迟
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        // await sleep(REQUEST_DELAY); // 移除延迟
        const { data } = await fetchWithCookie(url); 
        parseFromInlistData(data, cards);
        log(`✅ 成功解析到 ${cards.length} 个项目。`);
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
        // await sleep(REQUEST_DELAY); // 移除延迟
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
