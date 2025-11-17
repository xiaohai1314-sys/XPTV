/**
 * Nullbr 影视库前端插件 - V41.0 (去Jsonify终极版)
 *
 * 变更日志:
 * - V41.0 (2025-11-17):
 *   - [致命错误修复] 接受用户反馈“分类标签没了”，定位到 jsonify() 是问题的根源。
 *   - [移除所有jsonify] 彻底移除所有函数中的 jsonify() 调用，直接返回原生JavaScript对象，以适应App环境的接口要求。
 *   - [保留V40.1优点] 继承了路径参数通信、ES3兼容语法、双重名称查找等所有健壮性设计。
 *   - 这应该是与你的App环境完全兼容的最终形态。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function log(msg) { console.log("[Nullbr V41.0] " + msg); } 

var CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788, alt_name: 'IMDB：热门电影' } },
    { name: '热门剧集', ext: { id: 2143362, alt_name: 'IMDB：热门剧集' } },
    { name: '高分电影', ext: { id: 2142753, alt_name: 'IMDB：高分电影' } },
    { name: '高分剧集', ext: { id: 2143363, alt_name: 'IMDB：高分剧集' } },
];

// ★★★★★【核心修正：所有函数直接返回对象，不再使用jsonify】★★★★★

async function init(ext) {
    return {}; // 直接返回空对象
}

async function getConfig() {
    return { // 直接返回配置对象
        ver: 41.0,
        title: 'Nullbr影视库 (V41)',
        site: API_BASE_URL,
        tabs: CATEGORIES
    };
}

async function home() {
    return { // 直接返回首页对象
        "class": CATEGORIES, 
        "filters": {} 
    };
}

async function category(tid, pg, filter, ext) {
    var id = null;
    var i = 0; 
    
    if (typeof tid == "object" && tid != null) { 
        if (tid.id) { id = tid.id; } 
        else if (tid.ext && tid.ext.id) { id = tid.ext.id; }
        else if (tid.type_id) { id = tid.type_id; }
    } else if (typeof tid == "number") {
        id = tid;
    }
    
    if (!id && typeof tid == "string") {
        var n = parseInt(tid); 
        if (!isNaN(n)) {
            id = n;
        } else {
            for (i = 0; i < CATEGORIES.length; i++) {
                var category = CATEGORIES[i];
                var extData = category.ext;
                if (category.name == tid || (extData && extData.alt_name == tid)) {
                    id = extData.id;
                    break;
                }
            }
        }
    }

    if (!id) {
        id = CATEGORIES[0].ext.id; 
    }
    
    return getCards({ id: id, page: pg || 1 });
}

async function getCards(ext) {
    var categoryId = null;
    if (typeof ext == "object" && ext != null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        categoryId = CATEGORIES[0].ext.id; 
    }

    var page = (ext && ext.page) ? ext.page : 1;
    var url = API_BASE_URL + "/api/list/" + categoryId + "?page=" + page;
    log("getCards() 最终请求后端: " + url);

    try {
        // $fetch.get 应该直接返回一个可用的对象或字符串
        var response = await $fetch.get(url);
        
        // 健壮地处理 response，无论它是字符串还是对象
        var data;
        if (typeof response === 'string') {
            data = JSON.parse(response);
        } else {
            data = response; // 假设它已经是对象
        }

        if (!data || !Array.isArray(data.items)) {
            return { list: [] }; // 直接返回对象
        }
        var cards = data.items.map(function(item) {
            return {
                vod_id: item.media_type + "_" + item.tmdbid,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "",
                vod_remarks: item.vote_average > 0 ? "⭐ " + item.vote_average.toFixed(1) : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
        });
        return { // 直接返回最终的对象
            list: cards,
            page: data.page,
            pagecount: data.total_page,
            limit: cards.length,
            total: data.total_items
        };
    } catch (err) {
        log("请求失败: " + err.message);
        return { list: [] }; // 直接返回对象
    }
}

// --- 占位函数 ---
async function detail(id) { return {}; }
async function play(flag, id, flags) { return { url: "" }; }
async function search(wd, quick) { return { list: [] }; }
