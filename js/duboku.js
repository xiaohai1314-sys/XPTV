/**
 * Nullbr 影视库前端插件 - V64.0 (终极诊断版)
 *
 * 变更日志:
 * - V64.0 (2025-11-17):
 *   - [终极诊断] 将 `detail` 函数替换为一个极度简化的、无网络请求的同步函数。
 *   - [诊断目的] 此举旨在最终确定问题根源：
 *     - 如果详情页能显示“诊断信息”，说明问题出在插件的异步/网络请求上。
 *     - 如果详情页依然“无限转圈”，则100%证明App在调用插件的detail函数前就已崩溃。
 *   - [完整性] 保持了 getCards, search 等所有其他函数的完整性，确保插件能被正常加载和测试。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003'; // 虽然诊断版用不到，但为保持完整性而保留
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V64.0] ${msg}`); }

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
async function getConfig() { return jsonify({ ver: 64.0, title: 'Nullbr影视库 (V64-诊断版)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 (仅 detail 函数被修改) ---
// =======================================================================

// 1. 分类列表 (保持稳定版本)
async function getCards(ext) {
    try {
        const { id, page } = parseExt(ext);
        const lockKey = `cat_${id}`;
        if (END_LOCK[lockKey] && page > 1) return jsonify({ list: [], page: page, pagecount: page });
        if (page === 1) delete END_LOCK[lockKey];
        const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{id}&page=${page}`;
        const data = await fetchData(url);
        const cards = formatCards(data.items);
        if (data.items.length < 30) END_LOCK[lockKey] = true;
        const hasMore = !END_LOCK[lockKey];
        return jsonify({ list: cards, page: data.page, pagecount: hasMore ? data.page + 1 : data.page });
    } catch (err) { return handleError(err, 'getCards'); }
}

// 2. 搜索功能 (保持稳定版本)
async function search(ext) {
    try {
        const { text: keyword, page } = parseExt(ext);
        if (!keyword) return jsonify({ list: [] });
        const lockKey = `search_${keyword}`;
        if (END_LOCK[lockKey] && page > 1) return jsonify({ list: [], page: page, pagecount: page });
        if (page === 1) delete END_LOCK[lockKey];
        const url = `<LaTex>${API_BASE_URL}/api/search?keyword=$</LaTex>{encodeURIComponent(keyword)}&page=${page}`;
        const data = await fetchData(url);
        const cards = formatCards(data.items);
        if (data.items.length < 30) END_LOCK[lockKey] = true;
        const hasMore = !END_LOCK[lockKey];
        return jsonify({ list: cards, page: data.page, pagecount: hasMore ? data.page + 1 : data.page });
    } catch (err) { return handleError(err, 'search'); }
}

// 3. 详情页 (V64 终极诊断版)
function detail(id) {
    // 这个函数不依赖任何外部变量，不执行任何网络请求。
    // 它只有一个目的：如果App成功调用了它，就立刻返回一个明确的结果。
    // 它100%不会出错，100%会同步返回一个JSON字符串。
    
    const message = `[诊断V64] detail函数被成功调用了！收到的id是: <LaTex>${JSON.stringify(id)}, 类型是: $</LaTex>{typeof id}`;
    log(message); // 在插件日志中也打印一份

    return jsonify({
        list: [{
            vod_name: "诊断信息",
            vod_play_from: "来自插件",
            vod_play_url: `点击查看诊断结果<LaTex>$${message.replace(/\$</LaTex>/g, ' ')}`
        }]
    });
}

// 4. 播放 (保持稳定版本)
async function play(flag, id, flags) {
    // 在诊断版中，如果点击了诊断信息，id就是那段message
    log(`[play] 请求播放, flag: <LaTex>${flag}, id: $</LaTex>{id}`);
    return jsonify({ parse: 0, url: id });
}

// =======================================================================
// --- 辅助函数区 (保持稳定版本) ---
// =======================================================================

function parseExt(ext) { try { if (typeof ext === 'object' && ext !== null) { const { id, pg, page: page_alt, text } = ext.ext || ext; return { id: id || CATEGORIES[0].ext.id, page: pg || page_alt || 1, text: text || "" }; } if (typeof ext === 'string' && ext) { const extObj = JSON.parse(ext); const { id, pg, page: page_alt, text } = extObj.ext || extObj; return { id: id || CATEGORIES[0].ext.id, page: pg || page_alt || 1, text: text || "" }; } } catch (e) { log(`[parseExt] 解析ext失败: ${e.message}. 使用默认值.`); } return { id: CATEGORIES[0].ext.id, page: 1, text: "" }; }
async function fetchData(url) { const response = await $fetch.get(url); const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data; if (!data) throw new Error("后端返回数据为空或格式错误"); return data; }
function formatCards(items) { if (!items || !Array.isArray(items)) return []; return items.map(item => { const media_type = item.media_type || 'invalid'; const tmdbid = item.tmdbid || 'invalid'; return { vod_id: `<LaTex>${media_type}_$</LaTex>{tmdbid}`, vod_name: item.title || '未命名', vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "", vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '') }; }).filter(card => card.vod_id !== 'invalid_invalid'); }
function handleError(err, funcName = '未知函数') { log(`[<LaTex>${funcName}] 捕获到错误: $</LaTex>{err.message}`); return jsonify({ list: [] }); }
function showVisibleError(errorMessage) { return jsonify({ list: [{ vod_name: "发生错误", vod_play_from: "错误信息", vod_play_url: `点击查看错误信息<LaTex>$${errorMessage.replace(/\$</LaTex>/g, ' ')}` }] }); }
