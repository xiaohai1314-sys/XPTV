/**
 * Nullbr 影视库前端插件 - V77.0 (信仰之跃最终版)
 *
 * 变更日志:
 * - V77.0 (2025-11-17):
 *   - [终极思想] 接受用户指引，进行“信仰之跃”：我们相信App调用的是getTracks函数，而非detail。
 *   - [函数迁移] 将V74版本中逻辑完美的detail函数，完整地、逐字逐句地，迁移到新的getTracks函数中。
 *   - [函数废弃] detail函数被彻底清空，只作为一个无用的占位符存在。
 *   - [剧集支持] 确认V2.9后端和本前端的逻辑，已天然支持用户提供的剧集接口格式。
 *   - 这是我们基于所有失败教训和成功范例的、最后的、唯一的、最合理的尝试。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

var API_BASE_URL = 'http://192.168.10.105:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log('[Nullbr V77.0] ' + msg); }

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
async function getConfig() { return jsonify({ ver: 77.0, title: 'Nullbr影视库 (V77)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 ---
// =======================================================================

// 1. 分类列表 (与V74相同)
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

// 2. 搜索功能 (与V74相同)
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

// 3. 详情页 (★★★ 核心修复：逻辑从detail迁移至此 ★★★)
async function getTracks(ext) {
    log('[getTracks] 信仰之跃！原始ext: ' + JSON.stringify(ext));
    
    try {
        // 步骤1 (接力): 用最安全的方式解析ext，获取上一步传递过来的影片自身信息
        var parsedExt = parseDetailExt(ext);
        var detailUrl = parsedExt.detail_url;
        var vodName = parsedExt.vod_name || '加载中...';
        var vodPic = parsedExt.vod_pic || '';
        var vodContent = parsedExt.vod_content || '加载中...';

        if (!detailUrl) {
            throw new Error("无法从ext中解析出detail_url");
        }

        log('[getTracks] 解析出的请求URL: ' + detailUrl);
        
        // 步骤2 (动态): 请求后端，获取纯粹的网盘JSON
        var data = await fetchData(detailUrl);
        
        // 步骤3 (组装): 严格按照你的指示，解析网盘JSON，生成播放列表字符串
        var resources = data['115'];
        var vod_play_url;
        if (!resources || !Array.isArray(resources) || resources.length === 0) {
            vod_play_url = "未找到115网盘链接";
        } else {
            var playUrlItems = [];
            for (var i = 0; i < resources.length; i++) {
                var item = resources[i];
                var name = item.title + ' [' + (item.size || '未知大小') + ']';
                var link = item.share_link;
                playUrlItems.push(name + '$' + link);
            }
            vod_play_url = playUrlItems.join('#');
        }
        
        // 步骤4 (结合): 将“接力”信息与“动态”信息组合成最终的详情页UI结构
        return jsonify({
            list: [{
                vod_name: vodName,
                vod_pic: vodPic,
                vod_content: vodContent,
                vod_play_from: "115网盘",
                vod_play_url: vod_play_url
            }]
        });

    } catch (err) {
        log('[getTracks] 发生致命错误: ' + err.message);
        return jsonify({
            list: [{
                vod_name: "加载失败",
                vod_pic: "",
                vod_content: "错误信息: " + err.message,
                vod_play_from: "错误",
                vod_play_url: "加载失败$"
            }]
        });
    }
}

// 4. detail函数 (★★★ 核心修复：彻底废弃，成为占位符 ★★★)
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
// --- 辅助函数区 (与V74相同) ---
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
                detail_url: detailUrl,
                vod_name: item.title || '未命名',
                vod_pic: picUrl,
                vod_content: item.overview || '暂无简介'
            }
        };
    });
}

function handleError(err) {
    log('请求失败: ' + err.message);
    return jsonify({ list: [] });
}
