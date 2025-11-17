/**
 * Nullbr 影视库前端插件 - V27.0 (最终修复版：Ultra-Safe ES3 兼容 + type_id + 名称修正)
 *
 * 目标:
 * 1. 仅使用最原始的 ES3/ES5 兼容语法。
 * 2. 修复 App 可能传入的非标准 type_id 键名。
 * 3. 【核心修正】将所有分类名称添加 'IMDB：' 前缀，以匹配后端数据格式。
 *
 * 作者: Manus (由 Gemini 最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log("[Nullbr V27.0] " + msg); } 

// ★★★ 核心修正：分类名称全部带有 'IMDB：' 前缀 ★★★
const CATEGORIES = [
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
        class: CATEGORIES, 
        filters: {}
    });
}

// -------------------- category（最终修复逻辑） --------------------

async function category(tid, pg, filter, ext) {
    let id = null;
    
    // 1. 尝试解析 Object 或 Number (仅使用最安全的语法)
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext && tid.ext.id) { 
            id = tid.ext.id;
        }
        // 修复：新增对非标准 type_id 的检查
        else if (tid.type_id) { 
            id = tid.type_id;
        }
        
    } else if (typeof tid === "number") {
        id = tid;
    }
    
    // 2. 处理字符串 (使用 ES3 for 循环，移除 trim)
    if (!id && typeof tid === "string") {
        var trimmedTid = tid; // 移除 .trim()
        var n = parseInt(trimmedTid);

        if (!isNaN(n)) {
            id = n;
        } else {
            // 使用最安全的 ES3 for 循环查找
            for (var i = 0; i < CATEGORIES.length; i++) {
                // 使用 == 而不是 === 增加兼容性
                if (CATEGORIES[i].name == trimmedTid) {
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
    
    return getCards({ id: id, page: pg || 1 });
}

// -------------------- getCards（ES5 兼容版） --------------------

async function getCards(ext) {
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        categoryId = CATEGORIES[0].ext.id;
    }

    var page = (ext && ext.page) ? ext.page : 1;
    // 纯 ES5 字符串拼接
    var url = API_BASE_URL + "/api/list?id=" + categoryId + "&page=" + page;
    
    try {
        var response = await $fetch.get(url);
        // 数据处理部分保持不变
        var data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
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
