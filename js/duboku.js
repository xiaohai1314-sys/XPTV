/**
 * Nullbr 影视库前端插件 - V93.0 (强制解析修复版)
 *
 * 变更日志:
 * - V93.0 (2025-11-20):
 *   - [核心修复] 重新启用 getPlayinfo 函数，解决因 play 函数可能未被正确调用或参数传递错误导致后端无日志的问题。
 *   - [逻辑变更] getTracks 返回的播放地址不再直接交给App播放，而是作为一个“信标”传递给 getPlayinfo。
 *   - [强制解析] getPlayinfo 函数会亲自请求后端的 m3u8_proxy 接口，确保请求被发出，后端能收到日志。
 *   - 此版本旨在强制打通前端到后端代理的播放请求链路。
 *
 * 作者: Manus
 * 日期: 2025-11-20
 */

var API_BASE_URL = 'http://192.168.10.103:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V93.0] ' + msg); }

var CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

var END_LOCK = {};

// --- 入口与配置函数 ---
async function init(ext) { END_LOCK = {}; return jsonify({}); }
async function getConfig() { return jsonify({ ver: 93.0, title: 'Nullbr影视库 (V93)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 列表与搜索 (保持稳定) ---
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
// --- 详情与播放核心 (V93.0 修复版) ---
// =======================================================================

async function getTracks(ext) {
    log('[getTracks] 请求后端详情接口...');
    try {
        var parsedExt = parseDetailExt(ext);
        var detailUrl = parsedExt.detail_url;
        if (!detailUrl) throw new Error("无法从ext中解析出detail_url");
        log('[getTracks] 请求地址: ' + detailUrl);
        var data = await fetchData(detailUrl);
        log('[getTracks] 成功获取后端加工后的数据，透传给App。');
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

// ★★★【核心修复】★★★
// 重新启用 getPlayinfo，并让它来请求 m3u8_proxy
async function getPlayinfo(ext) {
    try {
        var parsed = parseDetailExt(ext);
        var m3u8ProxyUrl = parsed.url;
        if (!m3u8ProxyUrl) {
            throw new Error("无法从ext中获取到 m3u8_proxy 的地址");
        }
        log('[getPlayinfo] 截获到播放请求, 准备请求后端的M3U8代理: ' + m3u8ProxyUrl);
        
        // 直接将 m3u8_proxy 的地址返回给播放器
        // 这一步将强制App去请求我们的后端，后端应该会出现日志了！
        return jsonify({
            url: m3u8ProxyUrl
        });

    } catch (err) {
        log('[getPlayinfo] 错误: ' + err.message);
        // 出错时返回一个无效地址，避免App崩溃
        return jsonify({ url: 'http://error.com/play.m3u8' } );
    }
}

// play 函数现在变成了一个简单的信使，它只负责把播放线路的信息（包含 ext.url）传递给 getPlayinfo
async function play(flag, id, flags) {
    log('[play] 收到播放指令, flag: ' + flag + ', id: ' + id);
    // id 此时是 JSON 字符串, 如 '{"url":"http://.../m3u8_proxy?..."}'
    // 我们把它直接传递给 getPlayinfo 去处理
    return jsonify({
        parse: 1,  // 告诉App需要进一步解析
        jx: '1',   // 启动解析
        url: id    // 把包含 m3u8_proxy 地址的 JSON 字符串传递过去
    } );
}

// =======================================================================
// --- 辅助函数区 (保持稳定) ---
// =======================================================================
function parseExt(ext) { try { var extObj = typeof ext === 'string' ? JSON.parse(ext) : ext; var nestedExt = extObj.ext || extObj || {}; var id = nestedExt.id || (extObj.class && extObj.class.length > 0 ? extObj.class[0].ext.id : CATEGORIES[0].ext.id); var page = nestedExt.pg || nestedExt.page || 1; var text = nestedExt.text || ""; return { id: id, page: page, text: text }; } catch (e) { return { id: CATEGORIES[0].ext.id, page: 1, text: "" }; } }
function parseDetailExt(ext) { try { if (typeof ext === 'string') { ext = JSON.parse(ext); } if (ext && ext.ext) { return ext.ext; } if (ext) { return ext; } return {}; } catch (e) { return {}; } }
async function fetchData(url) { var response = await $fetch.get(url); var data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data; if (!data) throw new Error("后端未返回有效数据"); return data; }
function formatCards(items) { if (!items || !Array.isArray(items)) return []; return items.map(function(item) { var picUrl = item.poster ? TMDB_IMAGE_BASE_URL + item.poster : ""; return { vod_id: item.media_type + '_' + item.tmdbid, vod_name: item.title || '未命名', vod_pic: picUrl, vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : ''), ext: item.ext }; }); }
function handleError(err) { log('请求失败: ' + err.message); return jsonify({ list: [] }); }
