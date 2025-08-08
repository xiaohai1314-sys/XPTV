/**
 * 观影网脚本 - v44.1 (详情页修复版)
 *
 * --- 核心思想 ---
 * 修复因v44架构升级后，未同步修改详情页(getTracks)参数传递方式而导致的“网盘提取”功能失效问题。
 *
 * --- 更新日志 ---
 *  - v44.1 (详情页修复版):
 *    - 【核心修复】修正 getTracks 函数，使其从 ext.vod_id (而不是旧的 ext.url) 中获取详情页API地址。
 *    - 【功能恢复】“网盘提取”功能现在应该可以正常工作了。
 *    - 【保持架构】继续保持v44版本前后端分离的稳定架构。
 */

// ================== 配置区 ==================
const BACKEND_API_URL = 'http://192.168.10.111:5000/api/movies'; 

const appConfig = {
    ver: "44.1", // 详情页修复版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { category: 'mv' } },
        { name: '剧集', ext: { category: 'tv' } },
        { name: '动漫', ext: { category: 'ac' } },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V44.1] ${msg}`); } catch (_) { console.log(`[观影网 V44.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★★★★★【详情页Cookie缓存】★★★★★
// 为了让getTracks能拿到cookie，我们需要一个地方缓存它。
// 在init或getCards成功后，可以把从后端拿到的cookie存一下。
// 但一个更简单的做法是，让getTracks自己去请求一个有效的cookie。
// 我们暂时保留一个独立的ensureGlobalCookie函数给getTracks用。
let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v44_cookie_cache';

async function ensureCookieForTracks() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) {
            GLOBAL_COOKIE = cachedCookie;
            return GLOBAL_COOKIE;
        }
    } catch (e) { /* ignore */ }
    
    // 如果缓存没有，需要一个能获取Cookie的途径。
    // 最简单的办法是复用旧后端的/getCookie接口。
    // 我们假设您的后端同时保留了/getCookie和/api/movies。
    try {
        const { data } = await $fetch.get('http://192.168.10.111:5000/getCookie' );
        const result = JSON.parse(data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            try { $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); } catch (e) { /* ignore */ }
            return GLOBAL_COOKIE;
        }
    } catch(e) {
        log("为详情页获取Cookie失败: " + e.message);
    }
    return ""; // 返回空字符串
}


async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 数据获取逻辑 ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, category } = ext;
    
    const url = `${BACKEND_API_URL}?category=${category}&page=${page}`;
    log(`请求后端API: ${url}`);
    
    try {
        const { data } = await $fetch.get(url);
        log(`✅ 成功从后端获取到数据。`);
        return data; 
    } catch (e) {
        log(`❌ 请求后端API失败: ${e.message}`);
        $utils.toastError(`加载失败: 无法连接数据中心`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    $utils.toast("搜索功能正在开发中...", 2000);
    return jsonify({ list: [] });
}

// --- getTracks 和 getPlayinfo ★★★ 核心修正区域 ★★★ ---
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    
    // ★★★ 核心修正：从 ext.vod_id 获取URL ★★★
    let url = ext.vod_id; 
    if (!url) {
        log("❌ getTracks失败：ext.vod_id为空。");
        return jsonify({ list: [] });
    }

    log(`请求详情数据: ${url}`);
    try {
        // 详情页请求观影网，依然需要有效的Cookie
        const cookie = await ensureCookieForTracks();
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)', 
            'Cookie': cookie, 
            'Referer': appConfig.site 
        };
        const { data } = await $fetch.get(url, { headers });

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
