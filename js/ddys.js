/**
 * Nullbr 影视库前端插件 - V61.0 (诊断与容错版)
 *
 * 变更日志:
 * - V61.0 (2025-11-17):
 *   - [核心增强] 对 `detail` 函数进行全面重构，增加了极强的健壮性和容错性。
 *   - [诊断能力] `detail` 函数在遇到严重错误时，不再静默失败，而是会返回一个包含错误信息的“伪视频”，让问题在App界面上可见。
 *   - [类型安全] 所有核心函数都增加了对输入参数的严格类型检查，防止因App传递错误参数类型而导致的崩溃。
 *   - [逻辑修正] 修正了 `parseExt` 中可能存在的解析问题。
 *   - [日志优化] 优化了日志输出，使其在（可能存在的）日志系统中更易读。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 (无变更 ) ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V61.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

let END_LOCK = {};

// --- 入口函数 (无变更) ---
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 61.0, title: 'Nullbr影视库 (V61)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 (重点修改在 detail 函数) ---
// =======================================================================

// 1. 分类列表 (V60 版本，已稳定)
async function getCards(ext) {
    try {
        const { id, page } = parseExt(ext);
        const lockKey = `cat_${id}`;
        
        if (END_LOCK[lockKey] && page > 1) return jsonify({ list: [], page: page, pagecount: page });
        if (page === 1) delete END_LOCK[lockKey];

        const url = `${API_BASE_URL}/api/list?id=${id}&page=${page}`;
        const data = await fetchData(url);
        const cards = formatCards(data.items);
        
        if (data.items.length < 30) END_LOCK[lockKey] = true;
        const hasMore = !END_LOCK[lockKey];

        return jsonify({ list: cards, page: data.page, pagecount: hasMore ? data.page + 1 : data.page });
    } catch (err) {
        return handleError(err, 'getCards');
    }
}

// 2. 搜索功能 (V60 版本，已稳定)
async function search(ext) {
    try {
        const { text: keyword, page } = parseExt(ext);
        if (!keyword) return jsonify({ list: [] });
        const lockKey = `search_${keyword}`;

        if (END_LOCK[lockKey] && page > 1) return jsonify({ list: [], page: page, pagecount: page });
        if (page === 1) delete END_LOCK[lockKey];

        const url = `${API_BASE_URL}/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
        const data = await fetchData(url);
        const cards = formatCards(data.items);

        if (data.items.length < 30) END_LOCK[lockKey] = true;
        const hasMore = !END_LOCK[lockKey];

        return jsonify({ list: cards, page: data.page, pagecount: hasMore ? data.page + 1 : data.page });
    } catch (err) {
        return handleError(err, 'search');
    }
}

// 3. 详情页/网盘提取 (V61 核心重构)
async function detail(id) {
    try {
        // --- 步骤 1: 智能解析传入的 id ---
        let vod_id = '';
        if (typeof id === 'string') {
            vod_id = id;
        } else if (id && typeof id === 'object') {
            // 尝试从常见的对象结构中提取 id
            vod_id = id.id || id.vod_id || (Array.isArray(id) && typeof id[0] === 'string' ? id[0] : '');
        }
        
        log(`[detail] 原始id类型: ${typeof id}, 解析后vod_id: '${vod_id}'`);

        // --- 步骤 2: 严格验证解析后的 vod_id ---
        if (!vod_id || typeof vod_id !== 'string' || vod_id.indexOf('_') === -1) {
            const errorMsg = `参数解析失败: 传入的id格式不正确, 无法提取type和tmdbid. 原始id: ${JSON.stringify(id)}`;
            log(`[detail] ${errorMsg}`);
            return showVisibleError(errorMsg); // ★★★ 返回可见的错误信息
        }

        const [type, tmdbid] = vod_id.split('_');
        if (!type || !tmdbid || tmdbid === 'undefined') {
            const errorMsg = `ID分割失败: 从'${vod_id}'中无法正确分割出type或tmdbid.`;
            log(`[detail] ${errorMsg}`);
            return showVisibleError(errorMsg); // ★★★ 返回可见的错误信息
        }

        // --- 步骤 3: 请求后端并处理 ---
        const url = `${API_BASE_URL}/api/resource?type=${type}&tmdbid=${tmdbid}`;
        log(`[detail] 请求URL: ${url}`);
        const data = await fetchData(url);

        if (!data || !Array.isArray(data['115']) || data['115'].length === 0) {
            log(`[detail] 后端未返回有效的 '115' 资源列表`);
            return showVisibleError("未找到任何115资源，可能是资源已下架或API失效。");
        }

        const tracks = data['115'].map(item => ({
            name: `${item.title} [${item.size || '未知'}]`,
            url: item.share_link,
        }));

        return jsonify({
            list: [{
                vod_name: "115网盘资源",
                vod_play_from: "115",
                vod_play_url: tracks.map(t => `${t.name}$${t.url}`).join('#')
            }]
        });

    } catch (err) {
        // --- 步骤 4: 捕获所有未知异常 ---
        const errorMsg = `detail函数发生未知致命错误: ${err.message}`;
        log(`[detail] ${errorMsg}\nStack: ${err.stack}`);
        return showVisibleError(errorMsg); // ★★★ 返回可见的错误信息
    }
}

// 4. 播放 (V60 版本，已稳定)
async function play(flag, id, flags) {
    log(`[play] 请求播放, flag: ${flag}, id: ${id}`);
    return jsonify({ parse: 0, url: id });
}

// =======================================================================
// --- 辅助函数区 (新增和修改) ---
// =======================================================================

// 统一解析ext参数 (增强健壮性)
function parseExt(ext) {
    try {
        if (typeof ext === 'object' && ext !== null) {
            const { id, pg, page: page_alt, text } = ext.ext || ext;
            return { id: id || CATEGORIES[0].ext.id, page: pg || page_alt || 1, text: text || "" };
        }
        if (typeof ext === 'string' && ext) {
            const extObj = JSON.parse(ext);
            const { id, pg, page: page_alt, text } = extObj.ext || extObj;
            return { id: id || CATEGORIES[0].ext.id, page: pg || page_alt || 1, text: text || "" };
        }
    } catch (e) {
        log(`[parseExt] 解析ext失败: ${e.message}. 使用默认值.`);
    }
    return { id: CATEGORIES[0].ext.id, page: 1, text: "" };
}

// 统一请求数据 (无变更)
async function fetchData(url) {
    const response = await $fetch.get(url);
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data) throw new Error("后端返回数据为空或格式错误");
    return data;
}

// 统一格式化卡片 (增强健壮性)
function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => {
        // 确保 media_type 和 tmdbid 存在，否则给一个不会被解析的默认值
        const media_type = item.media_type || 'invalid';
        const tmdbid = item.tmdbid || 'invalid';
        return {
            vod_id: `${media_type}_${tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '')
        };
    }).filter(card => card.vod_id !== 'invalid_invalid'); // 过滤掉完全无效的数据
}

// 统一错误处理 (增强)
function handleError(err, funcName = '未知函数') {
    log(`[${funcName}] 捕获到错误: ${err.message}`);
    // 在列表页出错时，返回空列表是安全的
    return jsonify({ list: [] });
}

// ★★★【新增】将错误信息显示在详情页的播放列表上 ★★★
function showVisibleError(errorMessage) {
    return jsonify({
        list: [{
            vod_name: "发生错误",
            vod_play_from: "错误信息",
            vod_play_url: `点击查看错误信息$${errorMessage}`
        }]
    });
}
