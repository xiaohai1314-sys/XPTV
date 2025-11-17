/**
 * Nullbr 影视库前端插件 - V60.0 (xptv 完美兼容版)
 * 专治 xptv 分类正常但详情一直转圈的终极版
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';   // ←←← 改成你自己后端IP:端口
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60-xptv] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

let END_LOCK = {};

async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 60.0, title: 'Nullbr影视库 (V60)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`;
    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `${API_BASE_URL}/api/list?id=${id}&page=${page}`;
    log(`[getCards] 请求URL: ${url}`);

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);
        
        const pageSize = 30;
        if (data.items.length < pageSize) {
            END_LOCK[lockKey] = true;
        }
        const hasMore = !END_LOCK[lockKey];

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) {
        return handleError(err);
    }
}

async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });
    const lockKey = `search_${keyword}`;

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `${API_BASE_URL}/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    log(`[search] 请求URL: ${url}`);

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);

        const pageSize = 30;
        if (data.items.length < pageSize) {
            END_LOCK[lockKey] = true;
        }
        const hasMore = !END_LOCK[lockKey];

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
            limit: cards.length,
            total: data.total_results
        });
    } catch (err) {
        return handleError(err);
    }
}

// ★★★★★ 详情页（xptv 完美兼容）★★★★★
async function detail(id) {
    log(`[detail] 已触发，vod_id: ${id}`);
    if (!id || id.indexOf('_') === -1) return jsonify({ list:
