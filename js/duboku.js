/**
 * Nullbr 影视库前端插件 - V60.3 (仅修改 detail 的精准测试版)
 *
 * 变更日志:
 * - V60.3 (2025-11-18):
 *   - [严格修正] 基于用户提供的 V60.0 最终版代码进行修改。
 *   - [精准测试] 仅修改 detail 函数，使其返回固定的假数据，用于测试网络请求问题。
 *   - [保证] 所有其他函数 (category, search, getCards, 辅助函数等) 均保持用户原始版本，未做任何改动，确保入口和现有功能完好无损。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-18
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60.3 Test] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// ★★★★★【统一的分页锁，服务于分类和搜索】★★★★★
let END_LOCK = {};

// --- 入口函数 (保持原样) ---
async function init(ext) {
    END_LOCK = {}; // 插件初始化时，清空所有锁
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 60.3, title: 'Nullbr影视库 (V60.3 Test)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★★★【category 函数保持用户原始版本，未作任何修改】★★★★★
async function category(tid, pg, filter, ext) { 
    // 注意：根据你的V60.0版本，此函数已废弃，返回空列表。
    // 为了完全尊重你的代码，此处保持原样。
    // App可能是通过 getCards 或直接调用 category(tid, pg) 来加载列表的。
    // 无论哪种方式，我们都保持其原始逻辑。
    return jsonify({ list: [] }); 
}

// =======================================================================
// --- 核心功能区 ---
// =======================================================================

// ★★★★★【getCards 函数保持用户原始版本，未作任何修改】★★★★★
async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`; // 分类锁的键，加个前缀避免和搜索冲突
    
    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{id}&page=${page}`;
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

// ★★★★★【search 函数保持用户原始版本，未作任何修改】★★★★★
async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });
    const lockKey = `search_${keyword}`; // 搜索锁的键

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `<LaTex>${API_BASE_URL}/api/search?keyword=$</LaTex>{encodeURIComponent(keyword)}&page=${page}`;
    log(`[search] 请求URL: ${url}`);

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);

        const pageSize = 30; // 搜索结果也是每页30条
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

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// 3. 详情页/网盘提取 (唯一被修改的函数，用于精准测试)
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function detail(id) {
    log(`[detail] (精准测试版) 请求详情, vod_id: ${id}`);
    log('[detail] (精准测试版) 跳过网络请求，直接返回固定的假数据...');

    const fakeTracks = [
        { name: "测试链接-UC [10.5 GB]", url: "https://115.com/fake_uc_link" },
        { name: "测试链接-夸克 [20.8 GB]", url: "https://pan.quark.cn/fake_quark_link" }
    ];

    return jsonify({
        list: [{
            vod_name: "网盘资源 (测试数据)",
            vod_play_from: "115",
            vod_play_url: fakeTracks.map(t => `<LaTex>${t.name}$</LaTex>${t.url}`).join('#')
        }]
    });
}

// ★★★★★【play 函数保持用户原始版本，未作任何修改】★★★★★
async function play(flag, id, flags) {
    log(`[play] 请求播放, flag: <LaTex>${flag}, id: $</LaTex>{id}`);
    // 直接将网盘链接返回给App
    return jsonify({
        parse: 0,
        url: id
    });
}

// =======================================================================
// --- 辅助函数区 (保持原样) ---
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

async function fetchData(url) {
    const response = await $fetch.get(url);
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data) throw new Error("后端未返回有效数据");
    return data;
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
