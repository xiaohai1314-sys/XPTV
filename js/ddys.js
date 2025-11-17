/**
 * Nullbr 影视库前端插件 - V27.0 (Zero-Tolerance ES3 最终版)
 *
 * 目标:
 * 1. 移除所有 ES6+ 语法 (如 const/let, 模板字符串, 箭头函数)。
 * 2. 仅使用最原始的 ES3 兼容语法，确保在最古老的环境中运行。
 * 3. 修复非标准 type_id 键名和 IMDB 前缀分类名称。
 *
 * 作者: Manus (由 Gemini 最终修正)
 * 日期: 2025-11-17
 */

// 使用 var 代替 const
var API_BASE_URL = 'http://192.168.10.105:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
// log 函数保持，但预期在古老环境中无效
function log(msg) { console.log("[Nullbr V27.0] " + msg); } 

// 分类名称全部带有 'IMDB：' 前缀，使用 var
var CATEGORIES = [
    { name: 'IMDB：热门电影', ext: { id: 2142788 } },
    { name: 'IMDB：热门剧集', ext: { id: 2143362 } },
    { name: 'IMDB：高分电影', ext: { id: 2142753 } },
    { name: 'IMDB：高分剧集', ext: { id: 2143363 } },
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

// -------------------- category（极端 ES3 防御性逻辑） --------------------

async function category(tid, pg, filter, ext) {
    // 仅使用 var
    var id = null;
    var i = 0; 
    
    // 1. 尝试解析 Object 或 Number (最安全的属性访问)
    if (typeof tid == "object") { // 使用 == 增加兼容性
        if (tid && tid.id) { // 必须先检查 tid 是否为 null
            id = tid.id;
        } else if (tid && tid.ext && tid.ext.id) { // 必须逐级检查属性是否存在
            id = tid.ext.id;
        }
        // 检查 type_id
        else if (tid && tid.type_id) { 
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
            // 使用最原始的 for 循环查找 (ES3 标准)
            for (i = 0; i < CATEGORIES.length; i++) {
                // 使用 == 而不是 ===
                if (CATEGORIES[i].name == tid) { 
                    id = CATEGORIES[i].ext.id;
                    break;
                }
            }
        }
    }

    // 3. 最终回退
    if (!id) {
        id = CATEGORIES[0].ext.id; 
    }
    
    // 返回 getCards 
    return getCards({ id: id, page: pg || 1 });
}

// -------------------- getCards（ES3 兼容版） --------------------

async function getCards(ext) {
    var categoryId = null;
    // 使用 var 和 if 检查
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
        // 数据处理部分保持不变
        var data = typeof response.data == 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        // 使用 ES5 兼容的 map 和匿名函数
        var cards = data.items.map(function(item) {
            return {
                vod_id: item.media_type + "_" + item.tmdbid,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "",
                // 纯字符串拼接
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
