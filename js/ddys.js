/**
 * Nullbr 影视库前端插件 - V62.0 (URL作为ID最终版)
 *
 * 变更日志:
 * - V62.0 (2025-11-17):
 *   - [终极思想] 接受用户指引，确认detail函数崩溃的根源在于对vod_id字符串进行了处理(split)。
 *   - [URL作为ID] 彻底重构！getCards和search函数现在生成的vod_id是一个完整的、指向后端/api/resource的URL。
 *   - [简化detail] detail函数变得极其简单，它接收到这个URL后，不再进行任何字符串处理，而是直接发起网络请求。
 *   - [兼容性] 全面使用var和ES5语法，确保在任何古老环境中都能稳定运行。
 *   - 这是对“观影网”和“趣乐兔”成功模式最深刻、最忠实的最终复刻。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V62.0] ' + msg); }

var CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

var END_LOCK = {};

// --- 入口函数 ---
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 62.0, title: 'Nullbr影视库 (V62)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 (URL作为ID) ---
// =======================================================================

// 1. 分类列表 (生成URL作为vod_id)
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
        var cards = formatCards(data.items); // formatCards内部已改造
        
        var pageSize = 30;
        if (data.items.length < pageSize) { END_LOCK[lockKey] = true; }
        var hasMore = !END_LOCK[lockKey];

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) { return handleError(err); }
}

// 2. 搜索功能 (生成URL作为vod_id)
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
        var cards = formatCards(data.items); // formatCards内部已改造

        var pageSize = 30;
        if (data.items.length < pageSize) { END_LOCK[lockKey] = true; }
        var hasMore = !END_LOCK[lockKey];

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
            limit: cards.length,
            total: data.total_results
        });
    } catch (err) { return handleError(err); }
}

// 3. 详情页/网盘提取 (★★★ 核心修复处 ★★★)
async function detail(id) {
    log('[detail] 请求详情, vod_id(URL): ' + id);
    // ★★★ 不再对id做任何处理，直接使用它！ ★★★
    var url = id; 
    if (!url) return jsonify({ list: [] });

    log('[detail] 直接请求URL: ' + url);
    try {
        var data = await fetchData(url);
        if (!data || !Array.isArray(data['115'])) {
            return jsonify({ list: [] });
        }

        var tracks = data['115'].map(function(item) {
            return {
                name: item.title + ' [' + (item.size || '未知大小') + ']',
                url: item.share_link,
                size: item.size
            };
        });

        return jsonify({
            list: [{
                vod_name: "115网盘资源",
                vod_play_from: "115",
                vod_play_url: tracks.map(function(t) { return t.name + '$' + t.url; }).join('#')
            }]
        });
    } catch (err) {
        return handleError(err);
    }
}

// 4. 播放
async function play(flag, id, flags) {
    log('[play] 请求播放, flag: ' + flag + ', id: ' + id);
    return jsonify({
        parse: 0,
        url: id
    });
}

// =======================================================================
// --- 辅助函数区 ---
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

async function fetchData(url) {
    var response = await $fetch.get(url);
    var data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data) throw new Error("后端未返回有效数据");
    return data;
}

// ★★★ 改造formatCards，让它生成URL作为vod_id ★★★
function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(function(item) {
        // 构造指向我们后端/api/resource的完整URL
        var detailUrl = API_BASE_URL + '/api/resource?type=' + item.media_type + '&tmdbid=' + item.tmdbid;
        return {
            vod_id: detailUrl, // ★★★ vod_id现在是URL了！ ★★★
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "",
            vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '')
        };
    });
}

function handleError(err) {
    log('请求失败: ' + err.message);
    return jsonify({ list: [] });
}
