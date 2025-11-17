/**
 * Nullbr 影视库前端插件 - V60（原版结构 · 分类与网盘修复最终版）
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60-FINAL] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// ★★★★★【统一的分页锁】★★★★★
let END_LOCK = {};

// --- 入口函数 ---
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { 
    return jsonify({ 
        ver: 60.1, 
        title: 'Nullbr影视库', 
        site: API_BASE_URL, 
        tabs: CATEGORIES 
    }); 
}
async function home() { 
    return jsonify({ class: CATEGORIES, filters: {} }); 
}

// 保持原版结构：category() 不能删！
// ★★★ 修复①：分类必须映射 getCards()，否则 tabs 消失 ★★★
async function category(tid, pg, filter, ext) {
    return await getCards({ ext: { id: tid, pg: pg } });
}

// =======================================================================
// --- 核心功能区 ---
// =======================================================================

// 1. 分类列表
async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`;
    
    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page, pagecount: page });
    }
    if (page === 1) delete END_LOCK[lockKey];

    const url = `${API_BASE_URL}/api/list?id=${id}&page=${page}`;
    log(`[getCards] URL: ${url}`);

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);
        
        if (data.items.length < 30) END_LOCK[lockKey] = true;

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: END_LOCK[lockKey] ? data.page : data.page + 1
        });
    } catch (err) {
        return handleError(err);
    }
}

// 2. 搜索
async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });

    const lockKey = `search_${keyword}`;

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page, pagecount: page });
    }
    if (page === 1) delete END_LOCK[lockKey];

    const url = `${API_BASE_URL}/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    log(`[search] URL: ${url}`);

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);

        if (data.items.length < 30) END_LOCK[lockKey] = true;

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: END_LOCK[lockKey] ? data.page : data.page + 1
        });
    } catch (err) {
        return handleError(err);
    }
}

// =======================================================================
// 3. 详情页 / 网盘
// =======================================================================

// ★★★ 修复②：detail() 返回 Null-UI 识别格式，而不是 TVBox 格式 ★★★
async function detail(id) {
    log(`[detail] id: ${id}`);
    if (!id || id.indexOf('_') === -1) return jsonify({ list: [] });

    const [type, tmdbid] = id.split('_');
    const url = `${API_BASE_URL}/api/resource?type=${type}&tmdbid=${tmdbid}`;
    log(`[detail] URL: ${url}`);

    try {
        const data = await fetchData(url);
        if (!data || !Array.isArray(data['115'])) return jsonify({ list: [] });

        const urls = data['115'].map(item => ({
            name: `${item.title} (${item.size || '未知'})`,
            url: item.share_link
        }));

        return jsonify({
            list: [
                {
                    name: "115网盘",
                    flag: "115",
                    urls: urls
                }
            ]
        });

    } catch (err) {
        return handleError(err);
    }
}

// 4. 播放
async function play(flag, id, flags) {
    return jsonify({ parse: 0, url: id });
}

// =======================================================================
// --- 辅助函数区 ---
// =======================================================================

function parseExt(ext) {
    try {
        const obj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id, pg, page: page_alt, text } = obj.ext || obj || {};
        return {
            id: id || CATEGORIES[0].ext.id,
            page: pg || page_alt || 1,
            text: text || ""
        };
    } catch {
        return { id: CATEGORIES[0].ext.id, page: 1, text: "" };
    }
}

async function fetchData(url) {
    const response = await $fetch.get(url);
    return typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;
}

function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => ({
        vod_id: `${item.media_type}_${item.tmdbid}`,
        vod_name: item.title,
        vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
        vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '')
    }));
}

function handleError(err) {
    log(`错误: ${err.message}`);
    return jsonify({ list: [] });
}
