/**
 * Nullbr 影视库前端插件 - V60.2 (最终稳定版)
 *
 * 变更日志:
 * - V60.2 (2025-11-18):
 *   - [紧急修复] 修正了V60.1中因fetchData函数错误处理空对象，导致插件完全瘫痪(分类丢失)的致命BUG。
 *   - [优化] 恢复fetchData为一个更简洁、稳定且兼容的版本，只处理最核心的响应格式，避免意外崩溃。
 *   - [保留] 保留了对detail函数的健壮性修改和日志增强，以解决最初的详情页加载问题。
 *   - 此版本旨在恢复所有功能并修复详情页BUG。
 *
 * 作者: Manus
 * 日期: 2025-11-18
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60.2] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

let END_LOCK = {};

// --- 入口函数 ---
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 60.2, title: 'Nullbr影视库 (V60.2)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 (分类和搜索原封不动) ---
// =======================================================================

async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`;
    if (END_LOCK[lockKey] && page > 1) return jsonify({ list: [], page: page, pagecount: page });
    if (page === 1) delete END_LOCK[lockKey];
    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{id}&page=${page}`;
    log(`[getCards] 请求URL: ${url}`);
    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);
        if (data.items.length < 30) END_LOCK[lockKey] = true;
        const hasMore = !END_LOCK[lockKey];
        return jsonify({ list: cards, page: data.page, pagecount: hasMore ? data.page + 1 : data.page, limit: cards.length, total: data.total_items });
    } catch (err) { return handleError(err); }
}

async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });
    const lockKey = `search_${keyword}`;
    if (END_LOCK[lockKey] && page > 1) return jsonify({ list: [], page: page, pagecount: page });
    if (page === 1) delete END_LOCK[lockKey];
    const url = `<LaTex>${API_BASE_URL}/api/search?keyword=$</LaTex>{encodeURIComponent(keyword)}&page=${page}`;
    log(`[search] 请求URL: ${url}`);
    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);
        if (data.items.length < 30) END_LOCK[lockKey] = true;
        const hasMore = !END_LOCK[lockKey];
        return jsonify({ list: cards, page: data.page, pagecount: hasMore ? data.page + 1 : data.page, limit: cards.length, total: data.total_results });
    } catch (err) { return handleError(err); }
}

// 3. 详情页/网盘提取 (保留健壮性修改)
async function detail(id) {
    log(`[detail] 开始处理详情页, vod_id: ${id}`);
    if (!id || id.indexOf('_') === -1) {
        log(`[detail] 错误: vod_id格式不正确: ${id}`);
        return jsonify({ list: [] });
    }
    const [type, tmdbid] = id.split('_');
    const url = `<LaTex>${API_BASE_URL}/api/resource?type=$</LaTex>{type}&tmdbid=${tmdbid}`;
    log(`[detail] 准备请求URL: ${url}`);
    try {
        const data = await fetchData(url);
        if (!data || !Array.isArray(data['115']) || data['115'].length === 0) {
            log(`[detail] 错误: 响应数据中没有找到有效的 '115' 数组。数据: ${JSON.stringify(data)}`);
            return jsonify({ list: [] });
        }
        log(`[detail] 成功获取到 ${data['115'].length} 个115资源，开始格式化...`);
        const tracks = data['115'].map(item => {
            if (!item || !item.share_link) return null;
            return `<LaTex>${item.title || '未知标题'} [$</LaTex>{item.size || '未知大小'}]$${item.share_link}`;
        }).filter(Boolean);
        if (tracks.length === 0) {
            log('[detail] 格式化后没有可用的播放链接。');
            return jsonify({ list: [] });
        }
        const playUrlString = tracks.join('#');
        log(`[detail] 成功生成播放字符串 (共${tracks.length}条)`);
        return jsonify({ list: [{ vod_name: "115网盘资源", vod_play_from: "115", vod_play_url: playUrlString }] });
    } catch (err) { return handleError(err); }
}

async function play(flag, id, flags) {
    log(`[play] 请求播放, flag: <LaTex>${flag}, id: $</LaTex>{id}`);
    return jsonify({ parse: 0, url: id });
}

// =======================================================================
// --- 辅助函数区 ---
// =======================================================================

function parseExt(ext) {
    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id, pg, page: page_alt, text } = extObj.ext || extObj || {};
        return { id: id || CATEGORIES[0].ext.id, page: pg || page_alt || 1, text: text || "" };
    } catch (e) { return { id: CATEGORIES[0].ext.id, page: 1, text: "" }; }
}

// ★★★ 统一请求数据 (V3 - 最终稳定版) ★★★
async function fetchData(url) {
    const response = await $fetch.get(url);
    // 检查 response 是字符串还是对象
    if (typeof response === 'string') {
        return JSON.parse(response);
    }
    // 检查 response.data 是否存在且为字符串或对象
    if (response && response.data) {
        return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    }
    // 如果以上都不满足，则假定 response 本身就是数据对象
    return response;
}

function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => ({
        vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
        vod_name: item.title || '未命名',
        vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
        vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '')
    }));
}

function handleError(err) {
    log(`请求失败: ${err.message}`);
    return jsonify({ list: [] });
}
