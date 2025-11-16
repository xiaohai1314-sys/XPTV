/**
 * Nullbr 影视库前端插件 - V27.0 (最小修复版：保留原结构 + 分类 Tab 正常 + 内容切换)
 *
 * 说明：
 * 1. 完全保留你 V27.0 原文的 CATEGORIES 结构（name + ext.id）
 * 2. 只改 category() 和 getCards() 两处，确保 tid 解析成功
 * 3. home() 完全不变，保证分类 Tab 正常显示
 * 4. 加 Toast 日志，你能看到解析过程
 * 5. 改动最少，仅 10 行
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }

// ★★★ Toast 日志（你必能看到）★★★
function log(msg) {
    const text = `[V27.0修复] ${msg}`;
    console.log(text);
    try { $utils.toastError?.(text, 5000); } 
    catch (_) { try { $utils.toast?.(text, 5000); } catch (_) {} }
}

// ★★★ 彻底清理 ★★★
function clean(str) { return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim(); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

async function init(ext) { return getConfig(); }
async function getConfig() {
    return jsonify({ ver: 27.0, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES });
}

// ★★★ home() 完全不变 —— 保证 4 个 Tab 显示 ★★★
async function home() {
    return jsonify({
        class: CATEGORIES, 
        filters: {}
    });
}

// -------------------- category（修复：优先字符串 + 彻底 clean） --------------------
async function category(tid, pg, filter, ext) {
    log(`category() tid: "${tid}" (type: ${typeof tid})`);
    let id = null;

    // ★★★ 修复1：优先处理字符串 tid（你的 App 传 "2143362"）★★★
    if (typeof tid === "string") {
        const cleaned = clean(tid);
        const n = parseInt(cleaned, 10);
        if (!isNaN(n)) {
            id = n;
            log(`category()：字符串解析 → ID ${id}`);
        }
    }

    // ★★★ 原有对象逻辑（保留）★★★
    if (!id && typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    }

    // ★★★ 回退默认 ★★★
    if (!id) {
        log("category()：解析失败，使用默认");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 最终 ID: ${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards（修复：强制转数字） --------------------
async function getCards(ext) {
    log(`getCards() ext: ${JSON.stringify(ext)}`);
    
    let categoryId = null;
    if (ext && ext.id !== undefined) {
        categoryId = parseInt(clean(ext.id), 10); // ★★★ 修复2：强制 clean + parseInt ★★★
        if (isNaN(categoryId)) categoryId = null;
    }
    
    if (!categoryId) {
        log("getCards()：id 无效，使用默认");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = ext?.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`请求后端: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date?.substring(0,4) || '')
        }));
        return jsonify({
            list: cards,
            page: data.page || page,
            pagecount: data.total_page || 1,
            limit: cards.length,
            total: data.total_items || 0
        });
    } catch (err) {
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
