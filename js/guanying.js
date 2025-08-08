/**
 * 观影网脚本 - v50.0 (分类锁定最终版)
 *
 * --- 核心思想 ---
 * 彻底废弃了之前所有版本中，试图通过 ext.id 动态获取分类的、已被证明完全失败的逻辑。
 * 改为使用最原始、最可靠的方法：为每一个分类（电影、剧集、动漫）编写独立的、专属的获取函数。
 * 在这些函数中，category 参数被“写死”，从而彻底绕开了APP框架不稳定的参数传递问题。
 *
 * --- 更新日志 ---
 *  - v50.0 (分类锁定最终版):
 *    - 【架构重构】删除了通用的 getCards 函数。
 *    - 【核心修复】新增了 getMovies, getTvs, getAnimes 三个独立的、专属的列表获取函数。
 *    - 【逻辑锁定】在每个专属函数中，将 category 参数写死为 'mv', 'tv', 'ac'，确保请求的绝对正确。
 *    - 【配置修正】更新了 appConfig.tabs 的配置，使其与新的专属函数名完全对应。
 *    - 【郑重道歉】我为我之前犯下的、关于 category 的、极其低级且反复出现的错误，致以最诚恳的道歉。
 */

// ================== 配置区 ==================
const LIST_API_URL = 'http://192.168.10.111:5000/api/data'; 
const COOKIE_API_URL = 'http://192.168.10.111:5000/getCookie';

const appConfig = {
    ver: "50.0 (分类锁定 )",
    title: '观影网',
    site: 'https://www.gying.org/',
    // ★★★ 核心修正：将 tabs 的 ext 指向新的、专属的函数名 ★★★
    tabs: [
        { name: '电影', ext: 'getMovies' },
        { name: '剧集', ext: 'getTvs' },
        { name: '动漫', ext: 'getAnimes' },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V50.0] ${msg}`); } catch (_) { console.log(`[观影网 V50.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 专属列表获取函数 ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// ★ 为“电影”分类编写的专属函数
async function getMovies(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const category = 'mv'; // ★★★ 逻辑锁定：写死分类为 'mv' ★★★

    const url = `${LIST_API_URL}?category=${category}&page=${page}`;
    log(`请求专属列表API: ${url}`);
    
    try {
        const { data } = await $fetch.get(url);
        log(`✅ 成功获取 [${category}] 列表数据。`);
        return data; 
    } catch (e) {
        log(`❌ 请求 [${category}] 列表API失败: ${e.message}`);
        $utils.toastError(`加载电影失败`, 4000);
        return jsonify({ list: [] });
    }
}

// ★ 为“剧集”分类编写的专属函数
async function getTvs(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const category = 'tv'; // ★★★ 逻辑锁定：写死分类为 'tv' ★★★

    const url = `${LIST_API_URL}?category=${category}&page=${page}`;
    log(`请求专属列表API: ${url}`);
    
    try {
        const { data } = await $fetch.get(url);
        log(`✅ 成功获取 [${category}] 列表数据。`);
        return data; 
    } catch (e) {
        log(`❌ 请求 [${category}] 列表API失败: ${e.message}`);
        $utils.toastError(`加载剧集失败`, 4000);
        return jsonify({ list: [] });
    }
}

// ★ 为“动漫”分类编写的专属函数
async function getAnimes(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const category = 'ac'; // ★★★ 逻辑锁定：写死分类为 'ac' ★★★

    const url = `${LIST_API_URL}?category=${category}&page=${page}`;
    log(`请求专属列表API: ${url}`);
    
    try {
        const { data } = await $fetch.get(url);
        log(`✅ 成功获取 [${category}] 列表数据。`);
        return data; 
    } catch (e) {
        log(`❌ 请求 [${category}] 列表API失败: ${e.message}`);
        $utils.toastError(`加载动漫失败`, 4000);
        return jsonify({ list: [] });
    }
}


async function search(ext) {
    $utils.toast("搜索功能正在开发中...", 2000);
    return jsonify({ list: [] });
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 详情获取 (带安全缓存) ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

let GLOBAL_TRACKS_COOKIE = null;
const TRACKS_COOKIE_CACHE_KEY = 'gying_v50_tracks_cookie_cache';

async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    
    let detailApiUrl = ext.vod_id; 
    if (!detailApiUrl) { return jsonify({ list: [] }); }

    log(`准备请求详情数据: ${detailApiUrl}`);
    try {
        if (!GLOBAL_TRACKS_COOKIE) {
            try {
                const cachedCookie = $prefs.get(TRACKS_COOKIE_CACHE_KEY);
                if (cachedCookie) {
                    GLOBAL_TRACKS_COOKIE = cachedCookie;
                    log("✅ [详情页] 从持久化缓存中恢复了Cookie。");
                }
            } catch (e) {
                log("⚠️ [详情页] 读取持久化缓存失败。");
            }
        }

        if (!GLOBAL_TRACKS_COOKIE) {
            log(" [详情页] 所有缓存未命中，正在从后端获取新Cookie...");
            try {
                const { data: cookieData } = await $fetch.get(COOKIE_API_URL);
                const result = JSON.parse(cookieData);
                if (result.status === "success" && result.cookie) {
                    GLOBAL_TRACKS_COOKIE = result.cookie;
                    log("✅ [详情页] 成功获取到新Cookie。");
                    $prefs.set(TRACKS_COOKIE_CACHE_KEY, GLOBAL_TRACKS_COOKIE);
                }
            } catch (cookieError) {
                log(`⚠️ [详情页] 获取Cookie失败: ${cookieError.message}`);
            }
        }

        const headers = { 
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)', 
            'Cookie': GLOBAL_TRACKS_COOKIE || "", 
            'Referer': appConfig.site 
        };
        const { data } = await $fetch.get(detailApiUrl, { headers });

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
            log(`✅ 成功解析到 ${tracks.length} 条网盘链接。`);
        } else if (respstr.hasOwnProperty('file')) {
            $utils.toastError('网盘验证掉签，请前往主站完成验证或更新Cookie');
        } else {
            $utils.toastError('没有找到网盘资源');
        }
        return jsonify({ list: [{ title: '默认分组', tracks }] });

    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`详情加载失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
