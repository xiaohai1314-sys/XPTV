/**
 * Nullbr 影视库前端插件 - V60.10 (原版最小改动修复版)
 * 仅改一行 fetchData，专治 xptv 转圈，其他完全不动！
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// ★★★★★【统一的分页锁，服务于分类和搜索】★★★★★
let END_LOCK = {};

// --- 入口函数 ---
async function init(ext) {
    END_LOCK = {}; // 插件初始化时，清空所有锁
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 60.0, title: 'Nullbr影视库 (V60)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); } // 彻底废弃

// =======================================================================
// --- 核心功能区（全部原封不动）---
// =======================================================================

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

async function detail(id) {
    log(`[detail] 请求详情, vod_id: ${id}`);
    if (!id || id.indexOf('_') === -1) return jsonify({ list: [] });

    const [type, tmdbid] = id.split('_');
    const url = `${API_BASE_URL}/api/resource?type=${type}&tmdbid=${tmdbid}`;
    log(`[detail] 请求URL: ${url}`);

    try {
        const data = await fetchData(url);
        if (!data || !Array.isArray(data['115'])) {
            return jsonify({ list: [] });
        }

        const tracks = data['115'].map(item => ({
            name: `${item.title} [${item.size || '未知大小'}]`,
            url: item.share_link,
            size: item.size
        }));

        return jsonify({
            list: [{
                vod_name: "115网盘资源",
                vod_play_from: "115",
                vod_play_url: tracks.map(t => `${t.name}$${t.url}`).join('#')
            }]
        });
    } catch (err) {
        return handleError(err);
    }
}

async function play(flag, id, flags) {
    log(`[play] 请求播放, flag: ${flag}, id: ${id}`);
    return jsonify({
        parse: 0,
        url: id
    });
}

// =======================================================================
// --- 辅助函数区（除了 fetchData 其他全部原封不动）---
// =======================================================================

function parseExt(ext) {
    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id, pg, page: page_alt, text } = extObj.ext || extObj || {};
        return {
            id: id || (extObj.class && extObj.class.length > 0 ? extObj.class[0].ext.id : CATEGORIES[0].ext.id),
            page: pg || page_alt || 1,
            text: text || ""
        };
    } catch (e) {
        return { id: CATEGORIES[0].ext.id, page: 1, text: "" };
    }
}

// ★★★★★ 唯一改动的地方：xptv 兼容版 fetchData（只替换这一段！）★★★★★
async function fetchData(url) {
    const res = await req(url, { timeout: 20000 });
    let data = res.content || res.data || res;
    if (typeof data === 'string') data = JSON.parse(data.trim());
    return data;
}

function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => ({
        vod_id: `${item.media_type}_${item.tmdbid}`,
        vod_name: item.title || '未命名',
        vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
        vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '')
    }));
}

function handleError(err) {
    log(`请求失败: ${err.message}`);
    return jsonify({ list: [] });
}
