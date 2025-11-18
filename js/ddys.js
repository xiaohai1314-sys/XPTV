/**
 * Nullbr 影视库前端插件 - V88.2 (多格式支持版)
 *
 * 变更日志:
 * - V88.2 (2025-11-18):
 *   - 支持多种数据格式返回
 *   - 增加格式转换兜底方案
 *   - 确保最大兼容性
 *
 * 作者: Manus
 * 日期: 2025-11-18
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V88.2] ' + msg); }

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
        ver: 88.2,
        title: 'Nullbr影视库 (V88.2)',
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

// 3. 详情页 - 智能格式转换版
async function getTracks(ext) {
    log('[getTracks] 开始处理详情请求');
    
    try {
        // 步骤1: 解析ext获取detail_url
        var parsedExt = parseDetailExt(ext);
        var detailUrl = parsedExt.detail_url;

        if (!detailUrl) {
            throw new Error("无法从ext中解析出detail_url");
        }

        log('[getTracks] 请求URL: ' + detailUrl);
        
        // 步骤2: 请求后端
        var data = await fetchData(detailUrl);
        
        // 步骤3: 智能格式转换
        var finalData = ensureCompatibleFormat(data);
        
        log('[getTracks] 成功获取并处理数据');
        return jsonify(finalData);

    } catch (err) {
        log('[getTracks] 错误: ' + err.message);
        return jsonify({
            list: [{
                title: "错误",
                tracks: [{
                    name: "加载失败: " + err.message,
                    pan: ""
                }]
            }]
        });
    }
}

// 4. detail函数 (兼容性支持)
async function detail(ext) {
    log('[detail] 被调用,重定向到getTracks');
    return await getTracks(ext);
}

// 5. 播放
async function play(flag, id, flags) {
    log('[play] 播放URL: ' + id);
    
    // 如果URL包含115cdn.com,直接播放
    if (id.indexOf('115cdn.com') !== -1) {
        return jsonify({
            parse: 0,
            url: id,
            header: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }
    
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
            ext: {
                detail_url: detailUrl
            }
        };
    });
}

// ★★★ 新增: 智能格式转换函数 ★★★
function ensureCompatibleFormat(data) {
    // 如果已经有正确的list结构,直接返回
    if (data.list && Array.isArray(data.list)) {
        return data;
    }
    
    // 尝试从urls字段构建
    if (data.urls && Array.isArray(data.urls) && data.urls.length > 0) {
        return {
            list: [{
                title: data.source || "115网盘",
                tracks: data.urls
            }]
        };
    }
    
    // 尝试从parse_urls字段构建
    if (data.parse_urls && Array.isArray(data.parse_urls) && data.parse_urls.length > 0) {
        return {
            list: [{
                title: "115网盘",
                tracks: data.parse_urls.map(function(url, index) {
                    return {
                        name: "资源 " + (index + 1),
                        pan: url
                    };
                })
            }]
        };
    }
    
    // 如果什么都没有,返回空资源
    return {
        list: [{
            title: "无资源",
            tracks: [{
                name: "未找到可用资源",
                pan: ""
            }]
        }]
    };
}

function handleError(err) {
    log('请求失败: ' + err.message);
    return jsonify({ list: [] });
}
