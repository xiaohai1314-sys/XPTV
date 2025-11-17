/**
 * Nullbr 影视库前端插件 - V62.0 (终极兼容与诊断版)
 *
 * 变更日志:
 * - V62.0 (2025-11-17):
 *   - [终极重构] 彻底重写 `detail` 函数，放弃 `async/await`，改用纯粹的 `Promise.then().catch()` 链式调用，以应对可能存在的JS引擎兼容性问题。
 *   - [绝对返回] 确保 `detail` 函数在任何代码路径（同步、异步、成功、失败）下都有一个确定的 `return` 语句，从根本上防止“无限等待/转圈”。
 *   - [诊断前置] 将错误诊断逻辑提前到函数入口，即使第一行代码就出错也能生成可见的错误报告。
 *   - [兼容性] 这是为了解决“无限转圈”问题的终极尝试，最大化了代码的兼容性和健壮性。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V62.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

let END_LOCK = {};

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 62.0, title: 'Nullbr影视库 (V62)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 (detail 函数终极重构) ---
// =======================================================================

// 1. 分类列表 (稳定)
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
    } catch (err) { return handleError(err, 'getCards'); }
}

// 2. 搜索功能 (稳定)
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
    } catch (err) { return handleError(err, 'search'); }
}

// 3. 详情页/网盘提取 (V62 终极重构 - 纯Promise链)
function detail(id) {
    // --- 步骤 1: 同步执行的入口和参数检查 ---
    // 无论发生什么，先准备好一个错误信息，以防万一
    let initialError = null;
    let vod_id = '';

    try {
        log(`[detail] 函数入口。原始id类型: ${typeof id}`);
        if (typeof id === 'string') {
            vod_id = id;
        } else if (id && typeof id === 'object') {
            vod_id = id.id || id.vod_id || (Array.isArray(id) && typeof id[0] === 'string' ? id[0] : '');
        }

        if (!vod_id || typeof vod_id !== 'string' || vod_id.indexOf('_') === -1) {
            initialError = `参数解析失败: 传入的id格式不正确. 解析后vod_id: '${vod_id}', 原始id: ${JSON.stringify(id)}`;
        }
    } catch (e) {
        initialError = `detail函数入口发生同步错误: ${e.message}`;
    }

    // --- 步骤 2: 如果入口已出错，立即返回一个包含错误信息的Promise ---
    if (initialError) {
        log(`[detail] ${initialError}`);
        return Promise.resolve(showVisibleError(initialError));
    }

    // --- 步骤 3: 构建并返回一个完整的Promise链 ---
    const [type, tmdbid] = vod_id.split('_');
    const url = `${API_BASE_URL}/api/resource?type=${type}&tmdbid=${tmdbid}`;
    log(`[detail] 准备请求URL: ${url}`);

    return $fetch.get(url)
        .then(response => {
            log('[detail] 成功接收到后端响应');
            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

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
        })
        .catch(err => {
            // 捕获 $fetch.get() 或 .then() 内部的任何错误
            const errorMsg = `detail函数Promise链发生错误: ${err.message}`;
            log(`[detail] ${errorMsg}`);
            return showVisibleError(errorMsg);
        });
}

// 4. 播放 (稳定)
async function play(flag, id, flags) {
    return jsonify({ parse: 0, url: id });
}

// =======================================================================
// --- 辅助函数区 (保持V61的健壮性) ---
// =======================================================================

// 统一请求数据 (为Promise链服务)
function fetchData(url) {
    return $fetch.get(url).then(response => {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data) throw new Error("后端返回数据为空或格式错误");
        return data;
    });
}

// 其他辅助函数 (无变更)
function parseExt(ext) { try { if (typeof ext === 'object' && ext !== null) { const { id, pg, page: page_alt, text } = ext.ext || ext; return { id: id || CATEGORIES[0].ext.id, page: pg || page_alt || 1, text: text || "" }; } if (typeof ext === 'string' && ext) { const extObj = JSON.parse(ext); const { id, pg, page: page_alt, text } = extObj.ext || extObj; return { id: id || CATEGORIES[0].ext.id, page: pg || page_alt || 1, text: text || "" }; } } catch (e) { log(`[parseExt] 解析ext失败: ${e.message}. 使用默认值.`); } return { id: CATEGORIES[0].ext.id, page: 1, text: "" }; }
function formatCards(items) { if (!items || !Array.isArray(items)) return []; return items.map(item => { const media_type = item.media_type || 'invalid'; const tmdbid = item.tmdbid || 'invalid'; return { vod_id: `${media_type}_${tmdbid}`, vod_name: item.title || '未命名', vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "", vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '') }; }).filter(card => card.vod_id !== 'invalid_invalid'); }
function handleError(err, funcName = '未知函数') { log(`[${funcName}] 捕获到错误: ${err.message}`); return jsonify({ list: [] }); }
function showVisibleError(errorMessage) { return jsonify({ list: [{ vod_name: "发生错误", vod_play_from: "错误信息", vod_play_url: `点击查看错误信息$${errorMessage.replace(/\$/g, ' ')}` }] }); }
