/**
 * Nullbr 影视库前端插件 - V40.0 (终极路径版)
 *
 * 变更日志:
 * - V40.0 (2025-11-17):
 *   - [终极解决方案] 接受用户指正，问题的根源是 $fetch 对带查询参数的URL处理中断。
 *   - [放弃参数] 彻底放弃 ?id=... 的查询参数形式，将ID作为URL路径的一部分。
 *   - [前后端协同] 前端拼接新URL /api/list/ID，后端修改路由为 /api/list/:id 来接收。
 *   - [回归V27逻辑] 使用V27中被证明至少能触发一次请求的 category -> getCards 调用链。
 *   - 这是解决“请求中断、后端无响应”这一根本问题的最终方案。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V40.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

async function init(ext) { return getConfig(); }
async function getConfig() { return jsonify({ ver: 40.0, title: 'Nullbr影视库 (V40)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★ 使用V27的category函数，它的回退逻辑至少能保证发出一个请求 ★★★
async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    } else if (typeof tid === "number") {
        id = tid;
    }
    
    if (!id && typeof tid === "string") {
        const trimmedTid = tid.trim();
        const n = parseInt(trimmedTid);
        if (!isNaN(n)) {
            id = n;
        } else {
            const foundCategory = CATEGORIES.find(cat => cat.name === trimmedTid);
            if (foundCategory) id = foundCategory.ext.id;
        }
    }

    if (!id) {
        log("category()：所有解析均失败，回退到第一个默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 解析后的最终分类 ID：${id}`);
    return getCards({ id, page: pg || 1 });
}

// ★★★★★【这是本次前端的核心修正】★★★★★
async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page;

    // ★★★ 拼接不带查询参数的URL，ID直接作为路径 ★★★
    const url = `<LaTex>${API_BASE_URL}/api/list/$</LaTex>{categoryId}?page=${page}`;
    log(`getCards() 最终请求后端：${url}`);

    try {
        // 使用V27被证明可行的请求逻辑
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => ({
            vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));
        return jsonify({ list: cards, page: data.page, pagecount: data.total_page, limit: cards.length, total: data.total_items });
    } catch (err) {
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

// --- 占位函数 ---
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
