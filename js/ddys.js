/**
 * Nullbr 影视库前端插件 - V89.0 (XPTV专用版)
 *
 * 变更日志:
 * - V89.0 (2025-11-18):
 *   - 专门适配XPTV播放器
 *   - 使用vod_play_url字符串格式
 *   - 支持115网盘直链播放
 *
 * 作者: Manus
 * 日期: 2025-11-18
 * 适用: XPTV
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr XPTV V89] ' + msg); }

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

async function getConfig() {
    return jsonify({
        ver: 89.0,
        title: 'Nullbr影视库 (XPTV)',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

async function category(tid, pg, filter, ext) {
    return jsonify({ list: [] });
}

// =======================================================================
// --- 核心功能区 ---
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

// 3. 详情页 - XPTV专用
async function detail(ext) {
    log('[detail] XPTV详情请求');
    
    try {
        // 解析ext获取detail_url
        var parsedExt = parseDetailExt(ext);
        var detailUrl = parsedExt.detail_url;

        if (!detailUrl) {
            throw new Error("无法从ext中解析出detail_url");
        }

        log('[detail] 请求: ' + detailUrl);
        
        // 请求后端
        var data = await fetchData(detailUrl);
        
        // XPTV使用detail函数,返回vod_play_url格式
        var result = {
            vod_play_url: data.vod_play_url || "",
            vod_play_from: "115网盘"
        };
        
        log('[detail] 成功获取播放链接');
        return jsonify(result);

    } catch (err) {
        log('[detail] 错误: ' + err.message);
        return jsonify({
            vod_play_url: "115网盘$加载失败$",
            vod_play_from: "115网盘"
        });
    }
}

// 4. getTracks (XPTV备用)
async function getTracks(ext) {
    log('[getTracks] XPTV可能不使用此函数,重定向到detail');
    return await detail(ext);
}

// 5. 播放 - XPTV专用
async function play(flag, id, flags) {
    log('[play] 播放请求');
    log('[play] flag: ' + flag);
    log('[play] id: ' + id);
    
    // XPTV会传入115网盘链接
    // 直接返回,让XPTV的内置播放器处理
    return jsonify({
        parse: 0,
        url: id,
        header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
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

function parseDetailExt(ext) {
    try {
        if (typeof ext === 'string') {
            ext = JSON.parse(ext);
        }
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
        var detailUrl = API_BASE_URL + '/api/resource?type=' + item.media_type + '&tmdbid=' + item.tmdbid;
        var picUrl = item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "";
        return {
            vod_id: item.media_type + '_' + item.tmdbid,
            vod_name: item.title || '未命名',
            vod_pic: picUrl,
            vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : ''),
            vod_year: item.release_date ? item.release_date.substring(0, 4) : '',
            ext: {
                detail_url: detailUrl
            }
        };
    });
}

function handleError(err) {
    log('请求失败: ' + err.message);
    return jsonify({ list: [] });
}
