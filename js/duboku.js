/**
 * Nullbr 影视库前端插件 - V91.4 (基于抓包证据的终极修复版)
 *
 * 变更日志:
 * - V91.4 (2025-11-19):
 *   - [终极修复] 根据用户提供的精确抓包证据，修正了 getPlayinfo 函数中的 headers。
 *   - [精确伪造] 将 Referer 和 Origin 都精确指向了 'https://vip.vipuuuvip.com/' 。
 *   - 这是基于确凿证据的最后一次修复，旨在彻底解决“0kb”播放失败问题。
 *
 * 作者: Manus
 * 日期: 2025-11-19
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V91.4] ' + msg); }

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
async function getConfig() { return jsonify({ ver: 91.4, title: 'Nullbr影视库 (V91.4)', site: API_BASE_URL, tabs: CATEGORIES }); }
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
// --- 详情与播放核心 ---
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

// ★★★【终极修复 - 基于你的抓包证据】★★★
async function getPlayinfo(ext) {
    log('[getPlayinfo] 收到播放解析请求, ext: ' + JSON.stringify(ext));
    try {
        var parsedExt = parseDetailExt(ext);
        var playUrl = parsedExt.url;

        if (!playUrl) {
            throw new Error("无法从ext中解析出url");
        }

        // 定义一个完全匹配抓包证据的请求头
        const headers = {
            'Origin': 'https://vip.vipuuuvip.com',
            'Referer': 'https://vip.vipuuuvip.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        };

        if (playUrl.endsWith('.m3u8')) {
            log('[getPlayinfo] 检测到是直接的M3U8链接，附加请求头后直接播放。');
            return jsonify({ 
                urls: [playUrl],
                headers: [headers]
            });
        }

        log('[getPlayinfo] 请求后端二级解析接口: ' + playUrl);
        var data = await fetchData(playUrl);
        
        log('[getPlayinfo] 成功获取后端解析后的数据，附加请求头后透传给App。');
        return jsonify({
            ...data,
            headers: [headers]
        });

    } catch (err) {
        log('[getPlayinfo] 播放解析失败: ' + err.message);
        return jsonify({ msg: '播放解析失败: ' + err.message });
    }
}

async function play(flag, id, flags) {
    log('[play] 请求播放, flag: ' + flag + ', id: ' + id);
    // 保持V91.3的结构，触发 getPlayinfo
    return jsonify({
        parse: 2,
        url: id,
    });
}

// =======================================================================
// --- 辅助函数区 (与V91.3一字不差) ---
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
