/**
 * Nullbr 影视库前端插件 - V91.0 (终极协同版)
 *
 * 变更日志:
 * - V91.0 (2025-11-19):
 *   - [架构对齐] 与后端 V10.0 (完全体) 完美协同。
 *   - [实现 getPlayinfo] 新增 getPlayinfo 函数，用于处理在线播放的二级解析逻辑。
 *   - [改造 play] play 函数现在会正确地触发 getPlayinfo 的调用。
 *   - [IP校准] API_BASE_URL 已根据用户环境精确设置为 192.168.1.7。
 *   - 前端现在能同时处理“在线播放”(ext)和“网盘”(pan)两种资源类型。
 *
 * 作者: Manus
 * 日期: 2025-11-19
 */

var API_BASE_URL = 'http://192.168.1.7:3003'; // ★★★ 已为你校准 ★★★
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V91.0] ' + msg); }

var CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

var END_LOCK = {};

// --- 入口与配置函数 (无重大变化) ---
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 91.0, title: 'Nullbr影视库 (V91)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 (与V89.0基本一致，信使模式) ---
// =======================================================================

// 1. 分类列表
async function getCards(ext) {
    var parsed = parseExt(ext);
    var id = parsed.id;
    var page = parsed.page;
    var lockKey = 'cat_' + id;
    
    if (END_LOCK[lockKey] && page > 1) { return jsonify({ list: [], page: page, pagecount: page }); }
    if (page === 1) { delete END_LOCK[lockKey]; }

    var url = API_BASE_URL + '/api/list?id=' + id + '&page=' + page;
    try {
        var data = await fetchData(url);
        var cards = formatCards(data.items);
        
        var pageSize = 30;
        if (data.items.length < pageSize) { END_LOCK[lockKey] = true; }
        var hasMore = !END_LOCK[lockKey];

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
        });
    } catch (err) { return handleError(err); }
}

// 2. 搜索功能
async function search(ext) {
    var parsed = parseExt(ext);
    var keyword = parsed.text;
    var page = parsed.page;
    if (!keyword) return jsonify({ list: [] });
    var lockKey = 'search_' + keyword;

    if (END_LOCK[lockKey] && page > 1) { return jsonify({ list: [], page: page, pagecount: page }); }
    if (page === 1) { delete END_LOCK[lockKey]; }

    var url = API_BASE_URL + '/api/search?keyword=' + encodeURIComponent(keyword) + '&page=' + page;
    try {
        var data = await fetchData(url);
        var cards = formatCards(data.items);

        var pageSize = 30;
        if (data.items.length < pageSize) { END_LOCK[lockKey] = true; }
        var hasMore = !END_LOCK[lockKey];

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
        });
    } catch (err) { return handleError(err); }
}

// 3. 详情页 (纯粹的信使，无变化)
async function getTracks(ext) {
    log('[getTracks] 纯粹信使版, 原始ext: ' + JSON.stringify(ext));
    try {
        var parsedExt = parseDetailExt(ext);
        var detailUrl = parsedExt.detail_url;
        if (!detailUrl) throw new Error("无法从ext中解析出detail_url");

        log('[getTracks] 请求后端的智能加工接口: ' + detailUrl);
        var data = await fetchData(detailUrl);
        
        log('[getTracks] 成功获取后端加工后的数据，直接透传给App。');
        return jsonify(data);
    } catch (err) {
        log('[getTracks] 发生致命错误: ' + err.message);
        return jsonify({ list: [{ title: "错误", tracks: [{ name: "加载失败: " + err.message, pan: "" }] }] });
    }
}

// 4. detail函数 (废弃的占位符)
async function detail(ext) {
    log('[detail] 此函数已被废弃，不应被调用。');
    return jsonify({ list: [] });
}

// =======================================================================
// --- ★★★★★【播放核心区 - 本次升级的关键】★★★★★ ---
// =======================================================================

/**
 * 5. 获取播放信息 (新增的核心函数)
 * 当用户点击一个可播放的剧集按钮时，App会调用此函数。
 * @param {*} ext - App会把 getTracks 中返回的 ext 对象原样传来
 */
async function getPlayinfo(ext) {
    log('[getPlayinfo] 收到播放解析请求, ext: ' + JSON.stringify(ext));
    try {
        var parsedExt = parseDetailExt(ext);
        var playUrl = parsedExt.url; // 获取我们存放在ext里的那个“待解析URL”

        if (!playUrl) {
            throw new Error("无法从ext中解析出url");
        }

        // 如果链接本身就是m3u8，说明是电影，直接返回
        if (playUrl.endsWith('.m3u8')) {
            log('[getPlayinfo] 检测到是直接的M3U8链接，直接播放。');
            return jsonify({ urls: [playUrl] });
        }

        // 否则，说明是剧集，需要请求我们的后端二级解析接口
        log('[getPlayinfo] 请求后端二级解析接口: ' + playUrl);
        var data = await fetchData(playUrl);
        
        // 直接将后端返回的、已处理好的JSON { urls: [...] } 透传给App
        log('[getPlayinfo] 成功获取后端解析后的数据，透传给App: ' + JSON.stringify(data));
        return jsonify(data);

    } catch (err) {
        log('[getPlayinfo] 播放解析失败: ' + err.message);
        // 返回一个App能识别的错误格式
        return jsonify({ msg: '播放解析失败: ' + err.message });
    }
}

/**
 * 6. 播放 (改造后的核心函数)
 * 当App准备播放时，会调用此函数。
 * @param {*} flag - 播放列表的标识，比如 "在线播放"
 * @param {*} id - track对象的唯一标识，在这里就是我们存放在ext里的url
 * @param {*} flags - 包含所有播放列表信息的数组
 */
async function play(flag, id, flags) {
    log('[play] 请求播放, flag: ' + flag + ', id: ' + id);
    // ★★★ 核心改造 ★★★
    // 告诉App，这是一个需要通过 getPlayinfo 函数来解析的地址。
    // App看到 parse: 2 就会去调用 getPlayinfo，并把 id (即我们的ext.url) 作为参数传过去。
    return jsonify({
        parse: 2,
        url: id,
    });
}


// =======================================================================
// --- 辅助函数区 (无重大变化) ---
// =======================================================================

function parseExt(ext) {
    try {
        var extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        var nestedExt = extObj.ext || extObj || {};
        var id = nestedExt.id || (extObj.class && extObj.class.length > 0 ? extObj.class[0].ext.id : CATEGORIES[0].ext.id);
        var page = nestedExt.pg || nestedExt.page || 1;
        var text = nestedExt.text || "";
        return { id: id, page: page, text: text };
    } catch (e) {
        return { id: CATEGORIES[0].ext.id, page: 1, text: "" };
    }
}

function parseDetailExt(ext) {
    try {
        if (typeof ext === 'string') { ext = JSON.parse(ext); }
        if (ext && ext.ext) { return ext.ext; }
        if (ext) { return ext; }
        return {};
    } catch (e) {
        return {};
    }
}

async function fetchData(url) {
    var response = await $fetch.get(url);
    var data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data) throw new Error("后端未返回有效数据");
    return data;
}

function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(function(item) {
        var picUrl = item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "";
        return {
            vod_id: item.media_type + '_' + item.tmdbid,
            vod_name: item.title || '未命名',
            vod_pic: picUrl,
            vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : ''),
            ext: item.ext 
        };
    });
}

function handleError(err) {
    log('请求失败: ' + err.message);
    return jsonify({ list: [] });
}
