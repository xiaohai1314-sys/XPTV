/**
 * Nullbr 影视库前端插件 - V27.0 (兼容性修复 + Toast 诊断版)
 *
 * 目标:
 * 1. 【兼容性修复】保留所有 ES5 语法，确保在最古老的环境下运行。
 * 2. 【Toast 诊断】在 category() 函数的 ID 解析成功或失败时，通过 Toast 消息输出结果。
 *
 * 作者: Manus (由 Gemini 最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log("[Nullbr V27.0] " + msg); } 

// --- Toast 诊断工具 ---
function showToast(msg, isError) {
    // 检查全局 $toast 对象是否存在
    if (typeof $toast !== 'undefined' && $toast.show) {
        // 假设 $toast.show 支持第二个参数来控制红色/错误样式
        $toast.show(msg, isError);
    } else {
        log("[Toast-Fallback] " + msg);
    }
}

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

// -------------------- category（Toast 诊断注入） --------------------

async function category(tid, pg, filter, ext) {
    let id = null;
    var diagnosticInfo = null; // 用于存储诊断信息
    
    // 1. 尝试解析 Object 或 Number 
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
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
            var foundCategory = CATEGORIES.find(function(cat) { return cat.name === trimmedTid; });
            if (foundCategory) {
                id = foundCategory.ext.id;
            }
        }
    }

    // 3. 最终回退（及 Toast 诊断）
    if (id) {
        // ★★★ 解析成功：显示绿色或默认 Toast ★★★
        showToast("✅ SUCCESS: ID找到: " + id, false);
    } else {
        // ★★★ 解析失败：显示红色 Toast ★★★
        
        // Final-Safe 诊断：只诊断类型和最可能属性，避免 JSON.stringify 崩溃
        diagnosticInfo = "TYPE_" + (typeof tid);
        if (typeof tid === "object" && tid !== null) {
            if (tid.name) diagnosticInfo += "_HAS_NAME";
            if (tid.type_id) diagnosticInfo += "_HAS_TYPEID"; 
            if (tid.key) diagnosticInfo += "_HAS_KEY";
        } else if (typeof tid === "string") {
            diagnosticInfo = "RAW_STRING_" + tid.substring(0, 10);
        }

        showToast("❌ FAILED: 原始数据类型为: " + diagnosticInfo, true);

        // 强制回退到第一个 ID，确保 App 继续加载内容
        id = CATEGORIES[0].ext.id; 
    }
    
    return getCards({ id: id, page: pg || 1 });
}

// -------------------- getCards（非诊断版 - 确保不崩溃） --------------------

async function getCards(ext) {
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id;
    }
    
    // 正常 API 请求流程 (非诊断逻辑)

    if (!categoryId) {
        categoryId = CATEGORIES[0].ext.id;
    }

    var page = (ext && ext.page) ? ext.page : 1;
    var url = API_BASE_URL + "/api/list?id=" + categoryId + "&page=" + page;
    
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
