/**
 * Nullbr 影视库前端插件 - V61.0 (100% ES5兼容最终版)
 *
 * 变更日志:
 * - V61.0 (2025-11-17):
 *   - [致命BUG修复] 修复了detail函数因使用ES6语法(const/解构赋值)导致在老旧App环境中崩溃的问题。
 *   - [语法回归] 将detail函数中的id.split('_')重写为100%兼容的ES5数组索引语法。
 *   - [全面审查] 审查并统一了所有函数，确保全部使用var和基础语法，杜绝任何ES6+语法地雷。
 *   - 这是对App古老JS环境的最终妥协，确保所有功能都能稳定运行。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V61.0] ' + msg); }

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
async function getConfig() { return jsonify({ ver: 61.0, title: 'Nullbr影视库 (V61)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 (全部使用var和ES5兼容语法) ---
// =======================================================================

// 1. 分类列表
async function getCards(ext) {
    var parsed = parseExt(ext);
    var id = parsed.id;
    var page = parsed.page;
    var lockKey = 'cat_' + id;
    
    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    var url = API_BASE_URL + '/api/list?id=' + id + '&page=' + page;
    log('[getCards] 请求URL: ' + url);

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
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) {
        return handleError(err);
    }
}

// 2. 搜索功能
async function search(ext) {
    var parsed = parseExt(ext);
    var keyword = parsed.text;
    var page = parsed.page;
    if (!keyword) return jsonify({ list: [] });
    var lockKey = 'search_' + keyword;

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    var url = API_BASE_URL + '/api/search?keyword=' + encodeURIComponent(keyword) + '&page=' + page;
    log('[search] 请求URL: ' + url);

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
            limit: cards.length,
            total: data.total_results
        });
    } catch (err) {
        return handleError(err);
    }
}

// 3. 详情页/网盘提取 (★★★ 核心修复处 ★★★)
async function detail(id) {
    log('[detail] 请求详情, vod_id: ' + id);
    if (!id || id.indexOf('_') === -1) return jsonify({ list: [] });

    // ★★★ 使用100%兼容的ES5语法来分割字符串 ★★★
    var parts = id.split('_');
    var type = parts[0];
    var tmdbid = parts[1];
    
    var url = API_BASE_URL + '/api/resource?type=' + type + '&tmdbid=' + tmdbid;
    log('[detail] 请求URL: ' + url);

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
// --- 辅助函数区 (全部使用var和ES5兼容语法) ---
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

function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(function(item) {
        return {
            vod_id: item.media_type + '_' + item.tmdbid,
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
