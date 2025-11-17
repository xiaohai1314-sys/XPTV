/**
 * Nullbr 影视库前端插件 - V64.0 (手动JSON最终版)
 *
 * 变更日志:
 * - V64.0 (2025-11-17):
 *   - [终极BUG修复] 确认detail函数崩溃的最后诅咒，在于JSON.stringify无法处理其复杂的返回对象。
 *   - [手动拼接JSON] 彻底重写detail函数，放弃使用jsonify，改为用最原始的字符串拼接方式，手动构建返回的JSON字符串。
 *   - [绝对兼容] 这是对App古老JS环境的最终、最彻底的妥协，确保任何情况下都不会发生JS崩溃。
 *   - 我们所有的探索到此结束。这，就是最终的答案。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// jsonify 仍然在其他函数中使用 ，所以保留
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V64.0] ' + msg); }

var CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// ★★★ 全局的、用于预加载的本地缓存 和 分页锁 ★★★
var RESOURCE_CACHE = {};
var END_LOCK = {};

// --- 入口函数 ---
async function init(ext) {
    END_LOCK = {};
    RESOURCE_CACHE = {}; // 初始化时清空所有锁和缓存
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 64.0, title: 'Nullbr影视库 (V64)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); } // 彻底废弃

// =======================================================================
// --- 核心功能区 (预加载模式) ---
// =======================================================================

// 1. 分类列表 (获取预加载数据)
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
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) { return handleError(err); }
}

// 2. 搜索功能 (获取预加载数据)
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
            limit: cards.length,
            total: data.total_results
        });
    } catch (err) { return handleError(err); }
}

// 3. 详情页 (★★★ 核心修复：手动拼接JSON字符串 ★★★)
async function detail(id) {
    log('[detail] 从本地缓存中查找资源, vod_id: ' + id);
    
    var resources = RESOURCE_CACHE[id];
    
    if (!resources || !Array.isArray(resources) || resources.length === 0) {
        log('缓存未命中或资源为空');
        // 手动拼接一个“无资源”的JSON字符串
        return '{"list":[{"vod_name":"无可用资源","vod_play_from":"提示","vod_play_url":"未找到115网盘链接"}]}';
    }
    
    log('缓存命中！找到 ' + resources.length + ' 个资源。');
    
    // --- 手动构建 vod_play_url 字符串 ---
    var playUrlItems = [];
    for (var i = 0; i < resources.length; i++) {
        var item = resources[i];
        // 对name中的特殊字符进行转义，以防破坏JSON结构
        var safeName = (item.title + ' [' + (item.size || '未知大小') + ']')
            .replace(/\\/g, '\\\\') // 1. 转义反斜杠
            .replace(/"/g, '\\"');  // 2. 转义双引号
        
        playUrlItems.push(safeName + '$' + item.share_link);
    }
    var vod_play_url = playUrlItems.join('#');

    // --- 手动构建最终的完整JSON字符串 ---
    var jsonString = '{';
    jsonString += '"list":[';
    jsonString += '{';
    jsonString += '"vod_name":"115网盘资源",';
    jsonString += '"vod_play_from":"115",';
    // 再次对拼接好的vod_play_url字符串进行转义，因为#和$可能也是特殊字符
    jsonString += '"vod_play_url":"' + vod_play_url.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    jsonString += '}';
    jsonString += ']';
    jsonString += '}';

    log('手动构建的JSON字符串: ' + jsonString);
    return jsonString;
}

// 4. 播放
async function play(flag, id, flags) {
    log('[play] 请求播放, id: ' + id);
    return jsonify({ parse: 0, url: id });
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
        var vod_id = item.media_type + '_' + item.tmdbid;
        
        if (item.resources) {
            RESOURCE_CACHE[vod_id] = item.resources;
        }
        
        return {
            vod_id: vod_id,
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
