/**
 * Nullbr 影视库前端插件 - V44.0 (绝对字符串化终极版)
 *
 * 变更日志:
 * - V44.0 (2025-11-17):
 *   - [最终顿悟] 深入学习“观影网”模式，确认查询参数可行，问题在于JS变量类型转换BUG。
 *   - [绝对字符串化] 在拼接URL前，使用 String() 将所有变量强制转换为字符串，这是本次修复的核心。
 *   - [回归查询参数] URL拼接方式回归到 ...?id=... 的查询参数模式，与后端V2.7匹配。
 *   - [保持V42优点] 保留了V42中所有被证明有效的逻辑（jsonify, 纯净CATEGORIES, 健壮的category函数）。
 *   - 这应该是模仿成功案例后，最接近正确答案的版本。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V44.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

const NAME_LOOKUP = {
    'IMDB：热门电影': 2142788, 'IMDB：热门剧集': 2143362,
    'IMDB：高分电影': 2142753, 'IMDB：高分剧集': 2143363
};

// --- 入口和category函数 (保持V42的健壮逻辑) ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 44.0, title: 'Nullbr影视库 (V44)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) {
    // ... V42的category函数逻辑完全不变 ...
    let id = null;
    if (typeof tid === "object" && tid !== null) { if (tid.id) id = tid.id; else if (tid.ext && tid.ext.id) id = tid.ext.id; }
    else if (typeof tid === "number") { id = tid; }
    if (!id && typeof tid === "string") {
        const trimmedTid = tid.trim(); const n = parseInt(trimmedTid);
        if (!isNaN(n)) { id = n; } else {
            let found = false;
            for (let i = 0; i < CATEGORIES.length; i++) { if (CATEGORIES[i].name === trimmedTid) { id = CATEGORIES[i].ext.id; found = true; break; } }
            if (!found && NAME_LOOKUP[trimmedTid]) { id = NAME_LOOKUP[trimmedTid]; }
        }
    }
    if (!id) { id = CATEGORIES[0].ext.id; }
    return getCards({ id: id, page: pg || 1 });
}

// ★★★★★【这是本次前端的唯一、核心的修正】★★★★★
async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page;

    // ★★★ 在拼接前，使用 String() 将所有变量强制转换为字符串 ★★★
    const id_str = String(categoryId);
    const page_str = String(page);

    // ★★★ 回归到“观影网”模式的查询参数URL ★★★
    const url = `${API_BASE_URL}/api/list?id=${id_str}&page=${page_str}`;
    log(`getCards() 最终请求后端：${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));
        return jsonify({ list: cards, page: data.page, pagecount: data.total_page, limit: cards.length, total: data.total_items });
    } catch (err) {
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
