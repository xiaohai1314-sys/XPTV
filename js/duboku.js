/**
 * Nullbr 影视库前端插件 - V60.1 (详情页网络请求测试版)
 *
 * 变更日志:
 * - V60.1 (2025-11-18):
 *   - [调试] 修改 detail 函数，使其返回一个固定的、不依赖网络的假数据。
 *   - [目的] 用于验证 App 详情页的“转圈”问题是否由 `$fetch` 网络请求被环境（如App安全策略）阻止引起。
 *   - 如果此版本能正常显示详情页的按钮，则证明问题在于网络请求；否则问题在其他地方。
 *
 * 作者: Manus
 * 日期: 2025-11-18
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60.1 Test] ${msg}`); }

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
async function getConfig() { return jsonify({ ver: 60.1, title: 'Nullbr影视库 (V60.1 Test)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); }

// =======================================================================
// --- 核心功能区 ---
// =======================================================================

// 1. 分类列表 (保持不变)
async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`;
    
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

// 2. 搜索功能 (保持不变)
async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });
    const lockKey = `search_${keyword}`;

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `<LaTex>${API_BASE_URL}/api/search?keyword=$</LaTex>{encodeURIComponent(keyword)}&page=${page}`;
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

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// 3. 详情页/网盘提取 (已修改为返回固定假数据，用于测试)
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function detail(id) {
    log(`[detail] (测试版) 请求详情, vod_id: ${id}`);
    log('[detail] (测试版) 跳过网络请求，直接返回固定的假数据...');

    // 直接返回一个写死的、格式正确的JSON，完全不发起网络请求
    const fakeTracks = [
        { name: "测试链接-UC [10.5 GB]", url: "https://115.com/fake_uc_link" },
        { name: "测试链接-夸克 [20.8 GB]", url: "https://pan.quark.cn/fake_quark_link" },
        { name: "无大小信息的链接", url: "https://115.com/another_fake_link" }
    ];

    return jsonify({
        list: [{
            vod_name: "网盘资源 (测试数据)",
            vod_play_from: "115", // 这个 "from" 字段可以保持不变
            vod_play_url: fakeTracks.map(t => `<LaTex>${t.name}$</LaTex>${t.url}`).join('#')
        }]
    });
}

// 4. 播放 (保持不变)
async function play(flag, id, flags) {
    log(`[play] 请求播放, flag: <LaTex>${flag}, id: $</LaTex>{id}`);
    return jsonify({
        parse: 0,
        url: id
    });
}

// =======================================================================
// --- 辅助函数区 (保持不变) ---
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
