/**
 * 观影网脚本 - v49.2 (架构对接修正版)
 *
 * --- 更新日志 ---
 *  - v49.2:
 *    - 【分类修正】修正了 appConfig 中 tabs 的数据结构，解决了分类列表无法显示的问题。
 *    - 【列表修正】在 getCards 函数中增加了数据映射逻辑，解决了影片列表为空白的问题。
 *    - 【架构匹配】此版本为新版后端(v16.0)的最终前端匹配版本，解决了所有已知对接问题。
 */

// ================== 配置区 (已修正) ==================
const LIST_API_URL = 'http://192.168.1.4:5000/api/data'; 
const COOKIE_API_URL = 'http://192.168.1.4:5000/getCookie';

const appConfig = {
    ver: "49.2 (对接修正版 )",
    title: '观影网',
    site: 'https://www.gying.org/',
    // ★★★ 修正点 1: 扁平化 tabs 结构 ，让 App 能正确渲染分类标签 ★★★
    tabs: [
        { name: '电影', id: 'mv' },
        { name: '剧集', id: 'tv' },
        { name: '动漫', id: 'ac' },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V49.2] ${msg}`); } catch (_) { console.log(`[观影网 V49.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 列表获取 (已修正) ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const category = ext.id || 'mv'; // 现在可以正确从 ext.id 中获取分类

    const url = `${LIST_API_URL}?category=${category}&page=${page}`;
    log(`请求列表API: ${url}`);
    
    try {
        const { data } = await $fetch.get(url);
        log(`✅ 成功从后端获取到 ${data.list.length} 条原始列表数据。`);

        // ★★★ 修正点 2: 将后端返回的数据映射为 App 认识的标准格式 ★★★
        const formattedList = data.list.map(item => ({
            id: item.vod_id,        // 将 vod_id 映射为 App 认识的 id
            name: item.vod_name,    // 将 vod_name 映射为 App 认识的 name
            pic: item.vod_pic,      // 将 vod_pic 映射为 App 认识的 pic
            remarks: item.vod_remarks // 将 vod_remarks 映射为 App 认识的 remarks
        }));
        
        log(`✅ 成功将数据格式化，返回 ${formattedList.length} 个项目给 App。`);
        // 返回经过格式化处理后的、App可以识别的数据结构
        return jsonify({ list: formattedList }); 

    } catch (e) {
        log(`❌ 请求列表API或处理数据时失败: ${e.message}`);
        $utils.toastError(`加载失败: 无法连接数据中心`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    $utils.toast("搜索功能正在开发中...", 2000);
    return jsonify({ list: [] });
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 详情获取 (保持原样) ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// 用于详情页的、安全的、局部的Cookie缓存
let GLOBAL_TRACKS_COOKIE = null;
const TRACKS_COOKIE_CACHE_KEY = 'gying_v49_tracks_cookie_cache';

async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    
    // 注意：这里的 ext.id 是从 getCards 返回的 id 字段传递过来的
    // 经过修正后，ext.id 的值是 `https://www.gying.org/res/downurl/mv/xxxx`
    let detailApiUrl = ext.id; 
    if (!detailApiUrl ) { return jsonify({ list: [] }); }

    log(`准备请求详情数据: ${detailApiUrl}`);
    try {
        // 1. 优先从内存中获取Cookie
        if (!GLOBAL_TRACKS_COOKIE) {
            // 2. 内存中没有，则尝试从持久化缓存中获取
            try {
                const cachedCookie = $prefs.get(TRACKS_COOKIE_CACHE_KEY);
                if (cachedCookie) {
                    GLOBAL_TRACKS_COOKIE = cachedCookie;
                    log("✅ [详情页] 从持久化缓存中恢复了Cookie。");
                }
            } catch (e) {
                log("⚠️ [详情页] 读取持久化缓存失败 (可能是首次运行)。");
            }
        }

        // 3. 如果两种缓存都没有，才发起网络请求
        if (!GLOBAL_TRACKS_COOKIE) {
            log(" [详情页] 所有缓存未命中，正在从后端获取新Cookie...");
            try {
                const { data: cookieData } = await $fetch.get(COOKIE_API_URL);
                const result = JSON.parse(cookieData);
                if (result.status === "success" && result.cookie) {
                    GLOBAL_TRACKS_COOKIE = result.cookie;
                    log("✅ [详情页] 成功获取到新Cookie。");
                    // 将新Cookie存入持久化缓存
                    $prefs.set(TRACKS_COOKIE_CACHE_KEY, GLOBAL_TRACKS_COOKIE);
                }
            } catch (cookieError) {
                log(`⚠️ [详情页] 获取Cookie失败: ${cookieError.message}，将尝试无Cookie访问...`);
            }
        }

        // 4. 使用最终获取到的Cookie，请求详情API
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)', 
            'Cookie': GLOBAL_TRACKS_COOKIE || "", // 确保即使获取失败，也传递一个空字符串
            'Referer': appConfig.site 
        };
        const { data } = await $fetch.get(detailApiUrl, { headers });

        // 5. 解析网盘资源
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
