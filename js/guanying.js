/**
 * 观影网脚本 - v49.2 (聚合加载修正版)
 *
 * --- 更新日志 ---
 *  - v49.2:
 *    - 【列表修正】重构 getCards 函数。不再被动等待分类，而是主动并行请求所有分类(电影、剧集、动漫)。
 *    - 【UI优化】将不同分类的数据聚合在一起，并为每个视频名称前添加分类标识（如 "[电影] "），解决列表不全的问题。
 *    - 【兼容性】此修改确保了即使在不加载分类Tab的App环境中，也能看到所有分类的内容。
 */

// ================== 配置区 ==================
const LIST_API_URL = 'http://192.168.1.4:5000/api/data'; 
const COOKIE_API_URL = 'http://192.168.1.4:5000/getCookie';

const appConfig = {
    ver: "49.2 (聚合加载 )",
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv' } },
        { name: '剧集', ext: { id: 'tv' } },
        { name: '动漫', ext: { id: 'ac' } },
    ],
};

// ================== 核心函数 ==================

function log(msg  ) { try { $log(`[观影网 V49.2] ${msg}`); } catch (_) { console.log(`[观影网 V49.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 列表获取 (聚合加载版) ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;

    // 如果是翻页或指定了分类，保持原逻辑
    if (ext.id) {
        const category = ext.id;
        const url = `${LIST_API_URL}?category=${category}&page=${page}`;
        log(`请求指定分类列表: ${url}`);
        try {
            const { data } = await $fetch.get(url);
            log(`✅ 成功从后端获取到 [${category}] 列表数据。`);
            return data;
        } catch (e) {
            log(`❌ 请求列表API失败: ${e.message}`);
            $utils.toastError(`加载失败: 无法连接数据中心`, 4000);
            return jsonify({ list: [] });
        }
    }

    // 如果是首页加载 (ext.id 为空)，则聚合所有分类
    log("首页加载，开始聚合所有分类...");
    const categories = [
        { id: 'mv', name: '电影' },
        { id: 'tv', name: '剧集' },
        { id: 'ac', name: '动漫' },
    ];
    
    const allRequests = categories.map(cat => 
        $fetch.get(`${LIST_API_URL}?category=${cat.id}&page=${page}`)
            .then(response => {
                const parsedData = JSON.parse(response.data);
                parsedData.list.forEach(item => {
                    item.vod_name = `[${cat.name}] ${item.vod_name}`;
                });
                return parsedData.list;
            })
            .catch(e => {
                log(`❌ 加载分类 [${cat.name}] 失败: ${e.message}`);
                return [];
            })
    );

    try {
        const results = await Promise.all(allRequests);
        const combinedList = [].concat(...results);
        log(`✅ 成功聚合所有分类，共 ${combinedList.length} 个项目。`);
        return jsonify({ list: combinedList });
    } catch (e) {
        log(`❌ 聚合所有分类时发生严重错误: ${e.message}`);
        $utils.toastError(`聚合加载失败`, 4000);
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
const TRACKS_COOKIE_CACHE_KEY = 'gying_v49_tracks_cookie_cache';

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
                log("⚠️ [详情页] 读取持久化缓存失败 (可能是首次运行)。");
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
                log(`⚠️ [详情页] 获取Cookie失败: ${cookieError.message}，将尝试无Cookie访问...`);
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
