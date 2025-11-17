/**
 * Nullbr 影视库前端插件 - V52.0 (观影置换模式终极版)
 *
 * 变更日志:
 * - V52.0 (2025-11-17):
 *   - [终极顿悟] 严格遵循用户“像观影一样，然后置换”的指示，确认了“ID置换”模式是唯一解。
 *   - [占位符ID] 前端彻底放弃数字ID，改用无意义的业务字符串占位符（如'hot_movie'）。
 *   - [后端置换] 后端将负责接收这些占位符，并将其“置换”为真正的上游API数字ID。
 *   - 这是对“观影模式”精髓最忠实的模仿和实现。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V52.0] ${msg}`); }

// ★★★★★【这是本次修复的绝对核心：使用无意义的字符串占位符ID！】★★★★★
const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 52.0, title: 'Nullbr影视库 (V52)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★ 使用V50的category函数，它现在将处理和传递字符串占位符ID ★★★
async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    if (typeof tid === "object" && tid !== null) {
        if (tid.ext?.id) { id = tid.ext.id; } 
        else if (tid.id) { id = tid.id; }
    }

    if (!id && typeof tid === "string") {
        const name = tid.trim();
        const found = CATEGORIES.find(c => c.name === name);
        if (found) { id = found.ext.id; }
    }

    if (!id) { id = CATEGORIES[0].ext.id; }

    log(`category() 最终占位符ID=${id}`);
    return getCards({ id, page: pg || 1 });
}

// ★★★ 使用V27的getCards函数，它现在将向后端传递字符串占位符ID ★★★
async function getCards(ext) {
    log(`getCards() 调用，ext 原始值：${JSON.stringify(ext)}`);
    
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id; // categoryId 现在是 'hot_movie' 这样的字符串
    }
    
    if (!categoryId) { categoryId = CATEGORIES[0].ext.id; }

    const page = (ext && ext.page) ? ext.page : 1;

    // URL将变成 .../api/list?id=hot_movie&page=1
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`getCards() 最终请求后端：${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) { return jsonify({ list: [] }); }
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
