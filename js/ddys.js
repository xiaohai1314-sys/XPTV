/**
 * Nullbr 影视库前端插件 - V104.0 (最终收官版)
 *
 * 核心思想:
 * 1. 分类页/搜索页: 逻辑与V88完全一致，getCards函数正确地使用jsonify包装vod_id。
 * 2. 详情页(getTracks): 不再是“纯粹信使”，而是“观影网装箱员”。
 *    它会从后端获取结构化的JSON，然后将其“装箱”，
 *    放进一个`list`数组中，再返回给App。
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

// ================== 工具函数 ==================
function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log("[Nullbr V104.0] " + msg); }

// ================== 插件入口 ==================
async function init(ext) { return getConfig(); }

async function getConfig() {
    return jsonify({
        ver: 104.0,
        title: 'Nullbr影视库 (V104)',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    return jsonify({ "class": CATEGORIES, "filters": {} });
}

// ================== 分类页 (ID置换模式) ==================
async function category(tid, pg, filter, ext) {
    var categoryId = (typeof tid === 'object' && tid.id) ? tid.id : tid;
    if (!categoryId) { categoryId = CATEGORIES[0].ext.id; }
    var page = pg || 1;
    var url = API_BASE_URL + "/api/list?id=" + categoryId + "&page=" + page;
    return getCards(url);
}

// ================== 搜索页 (分页锁模式) ==================
var SEARCH_END = {};
async function search(wd, quick, pg) {
    var keyword = wd || "";
    var page = pg || 1;
    if (!keyword) return jsonify({ list: [] });
    if (SEARCH_END[keyword] && page > 1) {
        return jsonify({ list: [], page: 1, pagecount: 1 });
    }
    var url = API_BASE_URL + "/api/search?keyword=" + encodeURIComponent(keyword) + "&page=" + page;
    return getCards(url, keyword);
}

// ================== 卡片获取 (通用函数) ==================
async function getCards(url, keyword) {
    try {
        var response = await $fetch.get(url);
        var data = typeof response.data == 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }

        var cards = data.items.map(function(item) {
            var detailUrl = API_BASE_URL + "/api/resource?type=" + item.media_type + "&tmdbid=" + item.tmdbid;
            return {
                vod_id: jsonify({ ext: { detail_url: detailUrl } }), // ★★★ 核心：将请求详情的URL打包进vod_id
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "",
                vod_remarks: item.vote_average > 0 ? "⭐ " + item.vote_average.toFixed(1) : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
        });

        if (keyword && data.total_pages <= (data.page || 1)) {
            SEARCH_END[keyword] = true;
        }

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_pages,
            limit: cards.length,
            total: data.total_results
        });
    } catch (err) {
        log("请求失败: " + err.message);
        return jsonify({ list: [] });
    }
}

// ★★★★★【这是唯一的、回归了“观影网装箱模式”的终极 getTracks 函数】★★★★★
function parseDetailExt(ext) {
    try {
        if (typeof ext === 'string') { ext = JSON.parse(ext); }
        if (ext && ext.ext) { return ext.ext; }
        if (ext) { return ext; }
        return {};
    } catch (e) { return {}; }
}

async function getTracks(ext) {
    log('[getTracks] 观影网装箱版, 原始ext: ' + JSON.stringify(ext));
    try {
        var parsedExt = parseDetailExt(ext);
        var detailUrl = parsedExt.detail_url;
        if (!detailUrl) { throw new Error("无法从ext中解析出detail_url"); }
        log('[getTracks] 解析出的请求URL: ' + detailUrl);
        
        var response = await $fetch.get(detailUrl);
        var data = response.data; // data 是 {"title": "...", "tracks": [...]}
        if (!data || !data.tracks || !Array.isArray(data.tracks) || data.tracks.length === 0) {
            throw new Error("后端未返回有效的tracks数组");
        }
        
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

// ================== 占位/兼容函数 ==================
async function detail(id) {
    // 在我们的架构中，这个函数永远不应该被调用
    return getTracks(id);
}

async function play(flag, id, flags) {
    // App应该直接使用getTracks返回的pan链接，这个函数是备用的
    return jsonify({ url: id });
}
