/**
 * Nullbr 影视库前端插件 - V89.0 (终极信使版)
 *
 * 变更日志:
 * - V89.0 (2025-11-18):
 *   - [架构统一] 全面采用与“观影网”项目相同的“后端大脑，前端信使”模式。
 *   - [简化formatCards] 不再自行拼接detail_url，完全信赖并使用后端在ext中提供的完整URL。
 *   - [重写getTracks] getTracks函数回归纯粹，只负责请求ext.detail_url并透传后端返回的、已完美加工的JSON。
 *   - 前端不再关心任何链接清理、域名转换或数据拼接的逻辑。
 *
 * 作者: Manus
 * 日期: 2025-11-18
 */

var API_BASE_URL = 'http://192.168.10.102:3003'; // 保持不变 ，指向你的后端服务
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V89.0] ' + msg); }

var CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

var END_LOCK = {};

// --- 入口函数 (无变化) ---
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 89.0, title: 'Nullbr影视库 (V89)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 ---
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
        // ★★★ 核心简化：formatCards现在只做最简单的格式化 ★★★
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
        // ★★★ 核心简化：formatCards现在只做最简单的格式化 ★★★
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

// 3. 详情页 (★★★ 终极核心：纯粹的信使 ★★★)
async function getTracks(ext) {
    log('[getTracks] 纯粹信使版, 原始ext: ' + JSON.stringify(ext));
    
    try {
        // 步骤1: 从ext中获取后端提供好的detail_url
        var parsedExt = parseDetailExt(ext);
        var detailUrl = parsedExt.detail_url;

        if (!detailUrl) {
            throw new Error("无法从ext中解析出detail_url");
        }

        log('[getTracks] 解析出的请求URL: ' + detailUrl);
        
        // 步骤2: 请求后端的智能加工接口
        var data = await fetchData(detailUrl);
        
        // 步骤3: 直接、原封不动地将后端返回的、已经处理好的JSON，透传给App
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

// ★★★ 核心简化：formatCards不再需要拼接URL，只做最基础的格式转换 ★★★
function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(function(item) {
        var picUrl = item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "";
        return {
            vod_id: item.media_type + '_' + item.tmdbid,
            vod_name: item.title || '未命名',
            vod_pic: picUrl,
            vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : ''),
            // ext现在直接使用后端注入好的ext对象，里面包含了我们需要的detail_url
            ext: item.ext 
        };
    });
}

function handleError(err) {
    log('请求失败: ' + err.message);
    return jsonify({ list: [] });
}
