/**
 * Nullbr 影视库前端插件 - V92.0 (列表优先版)
 *
 * 变更日志:
 * - V92.0 (2025-11-19):
 *   - [回归原点] 彻底回滚到V91.0的稳定状态，确保Tabs分类和列表100%能正常显示。
 *   - [隔离问题] 暂时移除了所有为解决“0kb”问题而做的修改。
 *   - 我们的首要目标是先恢复基本功能，再此基础上解决播放问题。
 *
 * 作者: Manus
 * 日期: 2025-11-19
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V92.0] ' + msg); }

var CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

var END_LOCK = {};

// --- 入口与配置函数 ---
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 92.0, title: 'Nullbr影视库 (V92)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 列表与搜索 (与V91.0一字不差，保证正常) ---
// =======================================================================

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
        return jsonify({ list: cards, page: data.page, pagecount: hasMore ? data.page + 1 : data.page });
    } catch (err) { return handleError(err); }
}

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
        return jsonify({ list: cards, page: data.page, pagecount: hasMore ? data.page + 1 : data.page });
    } catch (err) { return handleError(err); }
}

// =======================================================================
// --- 详情与播放核心 (回滚到V91.0的稳定状态) ---
// =======================================================================

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

async function detail(ext) {
    log('[detail] 此函数已被废弃，不应被调用。');
    return jsonify({ list: [] });
}

// ★★★【回滚】★★★
// 暂时不实现 getPlayinfo，等待列表问题解决
// async function getPlayinfo(ext) { ... }

// ★★★【回滚】★★★
// play 函数恢复到最原始、最简单的状态
async function play(flag, id, flags) {
    log('[play] 请求播放, id: ' + id);
    return jsonify({ parse: 0, url: id });
}

// =======================================================================
// --- 辅助函数区 (与V91.0一字不差) ---
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
