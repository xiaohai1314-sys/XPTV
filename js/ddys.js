/**
 * Nullbr 影视库前端插件 - V110.0 (最终收官版)
 *
 * 核心思想:
 * 1. 分类页/搜索页: 逻辑与V88完全一致。
 * 2. vod_id: 不再进行任何jsonify或ext包裹，直接使用详情页URL作为字符串。
 * 3. getTracks: 直接将传入的ext参数作为URL使用。
 *
 * 作者: Manus (由你最终指引)
 * 日期: 2025-11-18
 */

// ================== 配置区 ==================
var API_BASE_URL = 'http://192.168.10.105:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

var CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

var END_LOCK = {};

// ================== 工具函数 ==================
function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V110.0] ' + msg); }

// ================== 插件入口 (与V88完全一致) ==================
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 110.0, title: 'Nullbr影视库 (V110)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); } // 保持V88的空占位符状态

// ================== 核心功能区 (与V88完全一致) ==================

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
            limit: cards.length,
            total: data.total_items
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
            limit: cards.length,
            total: data.total_results
        });
    } catch (err) { return handleError(err); }
}

// ★★★★★【这是唯一的、在V88基础上修改的、回归了“观影网明信片模式”的终极 getTracks 函数】★★★★★
async function getTracks(ext) {
    log('[getTracks] V110.0 观影网明信片版, 原始ext: ' + JSON.stringify(ext));
    try {
        var detailUrl = ext; // ★★★★★【在这里，我们直接把ext当成URL，因为App会把vod_id的值直接传给它！】★★★★★
        if (!detailUrl || typeof detailUrl !== 'string') { throw new Error("传入的ext不是一个有效的URL字符串"); }
        log('[getTracks] 解析出的请求URL: ' + detailUrl);
        
        var data = await fetchData(detailUrl); // data 是 {"title": "...", "tracks": [...]}
        
        log('[getTracks] 成功获取后端加工后的数据，准备装箱。');
        
        var finalResponse = {
            list: [data] // ★★★★★【在这里，我们把后端返回的整个对象，作为数组的第一个元素，放进list里！】★★★★★
        };

        log('[getTracks] 装箱完成，最终返回的对象: ' + JSON.stringify(finalResponse));
        return jsonify(finalResponse);

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

// 5. 播放
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

// ★★★★★【这是唯一的、在V88基础上修改的、回归了“观影网明信片模式”的终极 formatCards 函数】★★★★★
function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(function(item) {
        var detailUrl = API_BASE_URL + '/api/resource?type=' + item.media_type + '&tmdbid=' + item.tmdbid;
        var picUrl = item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "";
        return {
            vod_id: detailUrl, // ★★★★★【在这里，我们把详情页URL，直接作为字符串，赋值给vod_id！】★★★★★
            vod_name: item.title || '未命名',
            vod_pic: picUrl,
            vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : ''),
        };
    });
}

async function fetchData(url) {
    var response = await $fetch.get(url);
    var data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data) throw new Error("后端未返回有效数据");
    return data;
}

function handleError(err) {
    log('请求失败: ' + err.message);
    return jsonify({ list: [] });
}
