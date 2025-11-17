/**
 * Nullbr 影视库前端插件 - V43.0 (URL拼接终极修正版)
 *
 * 变更日志:
 * - V43.0 (2025-11-17):
 *   - [根本性修复] 根据后端日志 "id=undefined"，定位到前端URL拼接的致命错误。
 *   - [回归模板字符串] 彻底放弃易错的 '+' 拼接方式，回归使用最健壮、最清晰的模板字符串 `${...}` 来构建URL。
 *   - [清理代码] 移除所有不必要的ES3兼容性代码，恢复使用const/let，因为环境显然支持ES6。
 *   - 这是针对后端404错误的最终、最直接的解决方案。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V43.0] ${msg}`); }

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

// ---------------- 入口函数 ----------------

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 43.0, title: 'Nullbr影视库 (V43)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ---------------- category 函数 (保持V42的健壮逻辑) ----------------
async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值: ${JSON.stringify(tid)}`);
    let id = null;

    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext && tid.ext.id) id = tid.ext.id;
    } else if (typeof tid === "number") {
        id = tid;
    }
    
    if (!id && typeof tid === "string") {
        const trimmedTid = tid.trim();
        const n = parseInt(trimmedTid);
        if (!isNaN(n)) {
            id = n;
        } else {
            let found = false;
            for (let i = 0; i < CATEGORIES.length; i++) {
                if (CATEGORIES[i].name === trimmedTid) {
                    id = CATEGORIES[i].ext.id;
                    found = true;
                    break;
                }
            }
            if (!found && NAME_LOOKUP[trimmedTid]) {
                id = NAME_LOOKUP[trimmedTid];
            }
        }
    }

    if (!id) {
        id = CATEGORIES[0].ext.id;
    }

    return getCards({ id: id, page: pg || 1 });
}

// ★★★★★【这是本次前端的唯一、核心的修正】★★★★★
async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page;

    // ★★★ 使用最健壮的模板字符串来构建URL ★★★
    const url = `${API_BASE_URL}/api/list/${categoryId}?page=${page}`;
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
