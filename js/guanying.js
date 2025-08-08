/**
 * 观影网脚本 - v45.1 (网盘提取修复版)
 *
 * --- 更新日志 ---
 *  - v45.1:
 *    - 【核心修复】根据与v37.0的对比，将 getTracks 函数的实现恢复为最稳定可靠的逻辑。
 *    - 【逻辑统一】getTracks 现在重新使用全局的 fetchWithCookie 函数来发起请求，确保了Cookie的正确性和一致性。
 *    - 【拨乱反正】移除了在v45.0中画蛇添足的、独立的 ensureCookieForTracks 函数和相关逻辑。
 */

// ================== 配置区 ==================
const BACKEND_API_URL = 'http://192.168.1.4:5000/api/movies'; 
const COOKIE_BACKEND_URL = 'http://192.168.1.4:5000/getCookie'; // 为fetchWithCookie定义Cookie后端地址

const appConfig = {
    ver: "45.1", // 网盘提取修复版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv' } },
        { name: '剧集', ext: { id: 'tv' } },
        { name: '动漫', ext: { id: 'ac' } },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V45.1] ${msg}`); } catch (_) { console.log(`[观影网 V45.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★★★ 全局、统一的Cookie处理逻辑 (回归v37的经典模式) ★★★
let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v45_cookie_cache';

async function fetchWithCookie(url, options = {}) {
    if (!GLOBAL_COOKIE) {
        try {
            const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
            if (cachedCookie) {
                log("从缓存中恢复了Cookie");
                GLOBAL_COOKIE = cachedCookie;
            } else {
                log("缓存未命中，从后端获取Cookie...");
                const { data } = await $fetch.get(COOKIE_BACKEND_URL);
                const result = JSON.parse(data);
                if (result.status === "success" && result.cookie) {
                    GLOBAL_COOKIE = result.cookie;
                    $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE);
                }
            }
        } catch (e) {
            log("获取Cookie失败: " + e.message);
        }
    }
    
    const headers = { 
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)', 
        'Cookie': GLOBAL_COOKIE, 
        'Referer': appConfig.site,
        ...options.headers 
    };
    return $fetch.get(url, { ...options, headers });
}

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 数据获取逻辑 ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const category = ext.id || 'mv';

    const url = `${BACKEND_API_URL}?category=${category}&page=${page}`;
    log(`请求后端API: ${url}`);
    
    try {
        // getCards直接请求自己的后端，不需要cookie
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

// --- getTracks 和 getPlayinfo (★ 核心修复区域 ★) ---
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    
    // 1. URL来源使用新架构的 ext.vod_id
    let url = ext.vod_id; 
    if (!url) { return jsonify({ list: [] }); }

    log(`请求详情数据: ${url}`);
    try {
        // 2. 请求方式恢复为v37的、最可靠的 fetchWithCookie
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
