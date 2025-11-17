/**
 * Nullbr 影视库前端插件 - V272.0 (Final-Safe 兼容性 + 网络注入诊断版)
 *
 * 目标:
 * 1. 仅使用最原始的 ES5 语法和简单的字符串操作。
 * 2. 避免所有可能导致 App 崩溃的函数调用（如 JSON.stringify, encodeURIComponent）。
 * 3. 确保诊断参数能成功注入到后端 URL。
 *
 * 作者: Manus (由 Gemini 最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log("[Nullbr V27.0] " + msg); } 

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
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

// -------------------- category（Final-Safe 诊断注入） --------------------

async function category(tid, pg, filter, ext) {
    let id = null;
    var diagnosticInfo = null;
    
    // 1. 尝试解析 Object 或 Number 
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        // 兼容性修复 (tid.ext && tid.ext.id)
        else if (tid.ext && tid.ext.id) { 
            id = tid.ext.id;
        }
    } else if (typeof tid === "number") {
        id = tid;
    }
    
    // 2. 处理字符串
    if (!id && typeof tid === "string") {
        var trimmedTid = tid.trim(); 

        var n = parseInt(trimmedTid);
        if (!isNaN(n)) {
            id = n;
        } else {
            // ES5兼容的find函数写法
            var foundCategory = CATEGORIES.find(function(cat) { return cat.name === trimmedTid; }); 
            if (foundCategory) {
                id = foundCategory.ext.id;
            }
        }
    }

    // 3. 最终回退（及诊断注入）
    if (!id) {
        // ★★★ 核心变动：最安全的诊断信息生成 ★★★
        diagnosticInfo = "TYPE_" + (typeof tid);
        
        if (typeof tid === "object" && tid !== null) {
            // 只做最基本的布尔检查，避免任何复杂的JS操作
            if (tid.name) diagnosticInfo += "_HAS_NAME";
            if (tid.type_id) diagnosticInfo += "_HAS_TYPEID"; 
        } else if (typeof tid === "string") {
            diagnosticInfo = "RAW_STR_" + tid.substring(0, 10);
        }
        
        // 强制回退到第一个 ID
        id = CATEGORIES[0].ext.id; 
    }
    
    var cardsParams = { id: id, page: pg || 1 };
    if (diagnosticInfo) {
        cardsParams.diagnostic = diagnosticInfo; // 将诊断信息传入 getCards
    }
    
    return getCards(cardsParams);
}

// -------------------- getCards（将诊断信息注入到 URL） --------------------

async function getCards(ext) {
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        categoryId = CATEGORIES[0].ext.id;
    }

    var page = (ext && ext.page) ? ext.page : 1;
    // 正常 URL 拼接 (ES5)
    var url = API_BASE_URL + "/api/list?id=" + categoryId + "&page=" + page;
    
    // ★★★ 核心诊断逻辑：移除 encodeURIComponent，只做纯拼接 ★★★
    if (ext.diagnostic) {
        url = url + "&tid_raw=" + ext.diagnostic; // 纯字符串拼接
    }
    
    try {
        var response = await $fetch.get(url);
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
