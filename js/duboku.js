/**
 * Nullbr 影视库前端插件 - V40.2 (终极集成 + 同步修正版)
 *
 * 目标:
 * 1. 【同步修正】将 init/getConfig/home 更改为同步函数 (function)，确保分类 Tab 正常显示。
 * 2. 【通信修复】使用路径参数 /api/list/ID?page=... 结构 (配合后端V3.0)。
 * 3. 【运行时修复】使用最原始的 ES3 语法，同时支持双重名称查找 (防止 category() 崩溃)。
 *
 * 作者: Manus (由 Gemini 最终修正)
 * 日期: 2025-11-17
 */

// 仅使用 var
var API_BASE_URL = 'http://192.168.1.7:3003';
var TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log("[Nullbr V40.2] " + msg); } 

// 双重名称查找支持
var CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788, alt_name: 'IMDB：热门电影' } },
    { name: '热门剧集', ext: { id: 2143362, alt_name: 'IMDB：热门剧集' } },
    { name: '高分电影', ext: { id: 2142753, alt_name: 'IMDB：高分电影' } },
    { name: '高分剧集', ext: { id: 2143363, alt_name: 'IMDB：高分剧集' } },
];

// ---------------- 入口：init / getConfig / home (已修正为同步) ----------------

function init(ext) { return getConfig(); } // 移除 async

function getConfig() { // 移除 async
    return jsonify({
        ver: 40.2,
        title: 'Nullbr影视库 (V40.2)', // 标题更新
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

function home() { // 移除 async
    return jsonify({ "class": CATEGORIES, "filters": {} });
}

// -------------------- category（极端 ES3 防御性逻辑 + 双重查找） --------------------

// category 和 getCards 必须保持 async，因为它们使用了 await $fetch.get()
async function category(tid, pg, filter, ext) {
    var id = null;
    var i = 0; 
    
    // 1. 尝试解析 Object 或 Number (最安全的属性访问)
    if (typeof tid == "object" && tid != null) { 
        if (tid.id) { id = tid.id; } 
        else if (tid.ext && tid.ext.id) { id = tid.ext.id; }
        else if (tid.type_id) { id = tid.type_id; }
    } else if (typeof tid == "number") {
        id = tid;
    }
    
    // 2. 处理字符串 
    if (!id && typeof tid == "string") {
        var n = parseInt(tid); 
        if (!isNaN(n)) {
            id = n;
        } else {
            // 使用最原始的 for 循环查找，并匹配 name 和 alt_name
            for (i = 0; i < CATEGORIES.length; i++) {
                var category = CATEGORIES[i];
                var extData = category.ext;
                
                // 检查是否匹配 name 或 alt_name
                if (category.name == tid || (extData && extData.alt_name == tid)) {
                    id = extData.id;
                    break;
                }
            }
        }
    }

    // 3. 最终回退
    if (!id) {
        log("category()：解析失败，回退到默认 ID");
        id = CATEGORIES[0].ext.id; 
    }
    
    return getCards({ id: id, page: pg || 1 });
}

// -------------------- getCards（路径参数 + ES3 兼容版） --------------------

async function getCards(ext) {
    var categoryId = null;
    if (typeof ext == "object" && ext != null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        categoryId = CATEGORIES[0].ext.id; 
    }

    var page = (ext && ext.page) ? ext.page : 1;
    // 核心修正：使用路径参数和 ES3 字符串拼接
    var url = API_BASE_URL + "/api/list/" + categoryId + "?page=" + page;
    log("getCards() 最终请求后端: " + url);

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
        log("请求失败: " + err.message);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 (保持 async) -----------------

async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
