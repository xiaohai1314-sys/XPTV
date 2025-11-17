/**
 * Nullbr 影视库前端插件 - V63.0 (预加载模式最终版)
 *
 * 变更日志:
 * - V63.0 (2025-11-17):
 *   - [终极架构] 采纳“预加载”模式，完美模拟“趣乐兔”的一步到位数据获取。
 *   - [本地缓存] 新增全局RESOURCE_CACHE对象，用于存储由后端预加载的网盘资源。
 *   - [改造formatCards] 此函数现在负责填充RESOURCE_CACHE。
 *   - [重写detail] detail函数不再进行任何网络请求，改为从RESOURCE_CACHE中同步读取数据，彻底杜绝崩溃。
 *   - 这是对所有已知问题和环境限制的最终、最完美的解决方案。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V63.0] ' + msg); }

var CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// ★★★★★【这是本次升级的核心：本地资源缓存】★★★★★
var RESOURCE_CACHE = {};
var END_LOCK = {};

// --- 入口函数 ---
async function init(ext) {
    END_LOCK = {};
    RESOURCE_CACHE = {}; // 初始化时清空所有锁和缓存
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 63.0, title: 'Nullbr影视库 (V63)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

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
        var cards = formatCards(data.items); // formatCards内部会填充缓存
        
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
        var cards = formatCards(data.items); // formatCards内部会填充缓存

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

// 3. 详情页 (★★★ 核心修复：不再联网，只读缓存 ★★★)
async function detail(id) {
    log('[detail] 从本地缓存中查找资源, vod_id: ' + id);
    
    // ★★★ 核心：从全局缓存中同步读取数据 ★★★
    var resources = RESOURCE_CACHE[id];
    
    if (!resources || !Array.isArray(resources) || resources.length === 0) {
        log('缓存未命中或资源为空');
        // 可以返回一个提示信息
        return jsonify({
            list: [{
                vod_name: "无可用资源",
                vod_play_from: "提示",
                vod_play_url: "未找到115网盘链接"
            }]
        });
    }
    
    log('缓存命中！找到 ' + resources.length + ' 个资源。');
    var tracks = resources.map(function(item) {
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
}

// 4. 播放
async function play(flag, id, flags) {
    log('[play] 请求播放, id: ' + id);
    return jsonify({ parse: 0, url: id });
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

// ★★★ 改造formatCards，它现在会填充缓存 ★★★
function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(function(item) {
        var vod_id = item.media_type + '_' + item.tmdbid;
        
        // ★★★ 核心：将预加载的资源存入缓存 ★★★
        if (item.resources) {
            RESOURCE_CACHE[vod_id] = item.resources;
        }
        
        return {
            vod_id: vod_id, // ID回归到“复合ID”
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
