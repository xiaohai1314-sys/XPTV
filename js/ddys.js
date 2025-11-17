/**
 * Nullbr 影视库前端插件 - V27.0 (Zero-Tolerance ES3 + 双重名称查找)
 *
 * 目标:
 * 1. 移除所有 ES6+ 语法，仅使用最原始的 ES3 兼容语法。
 * 2. 修复非标准 type_id 键名。
 * 3. 【核心修正】让脚本在 category() 函数中同时接受原始名称 ('热门电影') 和带前缀的名称 ('IMDB：热门电影')。
 *
 * 作者: Manus (由 Gemini 最终修正)
 * 日期: 2025-11-17
 */

// 使用 var 代替 const
var API_BASE_URL = 'http://192.168.10.105:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log("[Nullbr V27.0] " + msg); } 

// ★★★ 核心修正：CATEGORIES 数组使用原始名称 (用于 App 兼容显示) ★★★
// 并添加一个 alt_name 键，存储带前缀的名称，用于 category() 查找
var CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788, alt_name: 'IMDB：热门电影' } },
    { name: '热门剧集', ext: { id: 2143362, alt_name: 'IMDB：热门剧集' } },
    { name: '高分电影', ext: { id: 2142753, alt_name: 'IMDB：高分电影' } },
    { name: '高分剧集', ext: { id: 2143363, alt_name: 'IMDB：高分剧集' } },
];

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 27.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    return jsonify({
        "class": CATEGORIES, 
        "filters": {}
    });
}

// -------------------- category（极端 ES3 防御性逻辑 + 双重查找） --------------------

async function category(tid, pg, filter, ext) {
    var id = null;
    var i = 0; 
    
    // 1. 尝试解析 Object 或 Number (最安全的属性访问)
    if (typeof tid == "object" && tid != null) { // 必须先检查 tid 是否为 null
        // 检查 id
        if (tid.id) { 
            id = tid.id;
        } 
        // 检查 ext.id
        else if (tid.ext && tid.ext.id) { 
            id = tid.ext.id;
        }
        // 检查 type_id
        else if (tid.type_id) { 
            id = tid.type_id;
        }
    } else if (typeof tid == "number") {
        id = tid;
    }
    
    // 2. 处理字符串 
    if (!id && typeof tid == "string") {
        var n = parseInt(tid); // 移除 .trim() 和任何字符串方法

        if (!isNaN(n)) {
            id = n;
        } else {
            // ★★★ 核心修复：使用最原始的 for 循环查找，并匹配 name 和 alt_name ★★★
            for (i = 0; i < CATEGORIES.length; i++) {
                var category = CATEGORIES[i];
                var extData = category.ext;
                
                // 检查是否匹配 CATEGORIES[i].name (例如 '热门电影')
                if (category.name == tid) { 
                    id = extData.id;
                    break;
                }
                
                // 检查是否匹配 CATEGORIES[i].ext.alt_name (例如 'IMDB：热门电影')
                if (extData && extData.alt_name == tid) {
                    id = extData.id;
                    break;
                }
            }
        }
    }

    // 3. 最终回退
    if (!id) {
        id = CATEGORIES[0].ext.id; 
    }
    
    return getCards({ id: id, page: pg || 1 });
}

// -------------------- getCards（ES3 兼容版） --------------------

async function getCards(ext) {
    var categoryId = null;
    if (typeof ext == "object" && ext != null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        categoryId = CATEGORIES[0].ext.id;
    }

    var page = (ext && ext.page) ? ext.page : 1;
    // 纯 ES5 字符串拼接 (移除模板字符串)
    var url = API_BASE_URL + "/api/list?id=" + categoryId + "&page=" + page;
    
    try {
        var response = await $fetch.get(url);
        var data = typeof response.data == 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        var cards = data.items.map(function(item) {
            return {
                vod_id: item.media_type + "_" + item.tmdbid,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "",
                vod_remarks: item.vote_average > 0 ? "⭐ " + item.vote_average.toFixed(1) : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
        });
        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) {
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 -----------------

async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
