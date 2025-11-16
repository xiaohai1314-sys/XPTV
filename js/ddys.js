/**
 * Nullbr 影视库前端插件 - V27.0 (最健壮的防御性修正版)
 *
 * 目标:
 * 1. 保持 home() 不变，确保分类 Tab 正常显示。
 * 2. 【核心修复】在 category() 中对传入的 tid 字符串进行 .trim() 清理，
 * 以对抗 App 环境可能引入的不可见字符或空格，确保 ID 查找成功。
 * 3. 修复 getCards() 中致命的 <LaTex> 语法错误。
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

// 保持 home() 不变，确保分类 Tab 正常显示。
async function home() {
    return jsonify({
        class: CATEGORIES, 
        filters: {}
    });
}

// -------------------- category（对传入字符串进行清理） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    // 1. 尝试解析 Object 或 Number
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    } else if (typeof tid === "number") {
        id = tid;
    }
    
    // 2. ★★★ 核心修复：处理字符串，并进行防御性清理 ★★★
    if (!id && typeof tid === "string") {
        const trimmedTid = tid.trim(); // <-- 清除字符串前后的空格和不可见字符

        // 2a. 尝试解析为数字 (如果 tid 是 "2142788")
        const n = parseInt(trimmedTid);
        if (!isNaN(n)) {
            id = n;
        } else {
            // 2b. tid 是一个分类名称，手动查找 ID
            const foundCategory = CATEGORIES.find(cat => cat.name === trimmedTid);
            if (foundCategory) {
                id = foundCategory.ext.id;
                log(`category()：防御性查找成功，ID ${id}，对应分类 "${trimmedTid}"`);
            } else {
                log(`category()：防御性查找失败。传入的清理后名称为: "${trimmedTid}"`);
            }
        }
    }

    // 3. 最终回退
    if (!id) {
        log("category()：所有解析均失败，回退到第一个默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 解析后的最终分类 ID：${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards（修复致命的语法错误） --------------------

async function getCards(ext) {
    log(`getCards() 调用，ext 原始值：${JSON.stringify(ext)}`);
    
    // V24.0 的防御性检查 (保留)
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        log("getCards()：ext.id 无效，强制使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = (ext && ext.page) ? ext.page : 1;

    // ★★★ 语法修正：将 <LaTex> 标签替换为正确的模板字符串反引号 (`) ★★★
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`getCards() 最终请求后端：${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            log("后端返回空 items");
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
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 -----------------

async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
