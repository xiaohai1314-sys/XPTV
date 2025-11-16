// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api"; 
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V7.1修正版] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// --- 核心函数 ---
async function getCards(params) {
    let requestUrl;
    let context;

    if (params.listId) {
        context = 'Category';
        requestUrl = `${MY_BACKEND_URL}/list?id=${params.listId}&page=${params.page || 1}`;
    } else if (params.keyword) {
        context = 'Search';
        requestUrl = `${MY_BACKEND_URL}/search?keyword=${encodeURIComponent(params.keyword)}&page=${params.page || 1}`;
    } else {
        return jsonify({ list: [] });
    }

    log(`[${context}] 请求后端: ${requestUrl}`);
    try {
        const { data } = await $fetch.get(requestUrl);
        if (!data || !Array.isArray(data.items)) {
            log(`[${context}] ⚠️ 数据结构错误`);
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
        }));

        const pagecount = data.total_page || data.total_pages || 1;
        const page = data.page || params.page || 1;

        return jsonify({
            page: page,
            pagecount: pagecount,
            list: cards
        });

    } catch (e) {
        log(`[${context}] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getConfig ---
async function getConfig() {
    log("==== 插件初始化 V7.1 ====");
    const CATEGORIES = [
        { name: 'IMDb-热门电影', ext: { listId: 2142788 } },
        { name: 'IMDb-热门剧集', ext: { listId: 2143362 } },
        { name: 'IMDb-高分电影', ext: { listId: 2142753 } },
        { name: 'IMDb-高分剧集', ext: { listId: 2143363 } }
    ];
    return jsonify({ ver: 7.1, title: '影视聚合(API)', site: MY_BACKEND_URL, tabs: CATEGORIES });
}

// --- home ---
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

// --- category（核心修复）---
async function category(tid, pg) {
    const listId = tid?.ext?.listId;   // ← 修复：正确读取 ext.listId
    const page = pg || 1;
    log(`[category] listId=${listId}, page=${page}`);
    if (!listId) return jsonify({ list: [] });
    return getCards({ listId: listId, page: page });
}

// --- search（核心修复）---
async function search(ext) {
    ext = argsify(ext);

    // 兼容所有字段
    const searchText = ext.text || ext.q || ext.wd || ext.keyword || '';
    const page = parseInt(ext.page || 1, 10);

    if (!searchText) return jsonify({ list: [] });

    log(`[search] keyword="${searchText}", page=${page}`);
    return getCards({ keyword: searchText, page: page });
}

// --- detail ---
async function detail(id) {
    log(`[detail] id=${id}`);
    try {
        const { tmdbid, type } = JSON.parse(id);
        const requestUrl = `${MY_BACKEND_URL}/resource?tmdbid=${tmdbid}&type=${type}`;
        const { data } = await $fetch.get(requestUrl);

        if (!data || !data['115']) return jsonify({ list: [] });

        const tracks = data['115'].map(item => ({
            name: `[115] ${item.title} (${item.size})`,
            pan: item.share_link,
            ext: {}
        }));

        return jsonify({
            list: [{ title: '115网盘资源', tracks: tracks }]
        });

    } catch (e) {
        log(`[detail] ❌ ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- play ---
async function play(flag, id) {
    return jsonify({ url: id });
}

// --- init ---
async function init() {
    return getConfig();
}
