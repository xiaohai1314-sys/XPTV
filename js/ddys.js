/**
 * Nullbr 影视库前端插件 - V27.0 (兼容性修复 + App 界面诊断版)
 *
 * 目标:
 * 1. 【兼容性修复】解决老旧 App 环境中 ID 解析失败的问题。
 * 2. 【诊断功能】在 ID 解析失败时，将原始 tid 值作为电影标题显示在 App 界面上。
 *
 * 作者: Manus (由 Gemini 最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V27.0] ${msg}`); }

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

// -------------------- category（兼容性修复版 + 诊断注入） --------------------

async function category(tid, pg, filter, ext) {
    let id = null;
    
    // 1. 尝试解析 Object 或 Number
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        
        // ★★★ 兼容性修复：替换可选链操作符 ★★★
        else if (tid.ext && tid.ext.id) {
            id = tid.ext.id;
        }
        
    } else if (typeof tid === "number") {
        id = tid;
    }
    
    // 2. 处理字符串（防御性清理）
    if (!id && typeof tid === "string") {
        const trimmedTid = tid.trim(); 

        const n = parseInt(trimmedTid);
        if (!isNaN(n)) {
            id = n;
        } else {
            const foundCategory = CATEGORIES.find(cat => cat.name === trimmedTid);
            if (foundCategory) {
                id = foundCategory.ext.id;
            }
        }
    }

    // 3. 最终回退（及诊断注入）
    if (!id) {
        let diagnosticInfo;
        try {
            // 将原始 tid 转化为字符串
            diagnosticInfo = JSON.stringify(tid);
        } catch (e) {
            // 防止循环引用导致崩溃
            diagnosticInfo = "Serialization_Error: " + typeof tid; 
        }
        
        // ★★★ 诊断注入：将诊断信息作为 ID 返回，并添加前缀 ★★★
        // 强制返回一个字符串 ID，让 getCards 函数识别并显示它
        id = `DIAG_${diagnosticInfo}`; 
    }
    
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards（诊断信息显示到 App 界面） --------------------

async function getCards(ext) {
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id;
    }
    
    // ★★★ 诊断检查：如果 categoryId 是诊断字符串 ★★★
    if (typeof categoryId === 'string' && categoryId.startsWith('DIAG_')) {
        const rawTid = categoryId.substring(5); // 移除 "DIAG_"
        
        // 返回一个假的列表，将原始 tid 作为标题显示
        return jsonify({
            list: [{
                vod_id: 'DIAG_001',
                vod_name: `【请复制】原始 tid 值: ${rawTid}`,
                vod_pic: '', 
                vod_remarks: '↑ 这是App传入的原始数据'
            },
            {
                vod_id: 'DIAG_002',
                vod_name: '请将上方的完整内容（包括引号/大括号）发给我',
                vod_pic: '', 
                vod_remarks: ''
            }],
            page: 1,
            pagecount: 1,
            limit: 2,
            total: 2
        });
    }


    // -------------------- 正常 API 请求流程 --------------------

    if (!categoryId) {
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = (ext && ext.page) ? ext.page : 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    
    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => {
            return {
                vod_id: `${item.media_type}_${item.tmdbid}`,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
                vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
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
