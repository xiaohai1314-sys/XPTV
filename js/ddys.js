// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V7.1-修复版] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// --- 核心数据抓取 ---
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

    try {
        const { data } = await $fetch.get(requestUrl);

        if (!data || !Array.isArray(data.items)) return jsonify({ list: [] });

        const cards = data.items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
            ext: { tmdbid: item.tmdbid, type: item.media_type }
        }));

        return jsonify({
            page: data.page || params.page || 1,
            pagecount: data.total_page || data.total_pages || 1,
            list: cards
        });

    } catch (e) {
        return jsonify({ list: [] });
    }
}

// --- getConfig：保持你原来的 tabs/ext 结构 ---
async function getConfig() {
    const TABS = [
        { name: 'IMDb-热门电影', ext: { listId: 2142788 } },
        { name: 'IMDb-热门剧集', ext: { listId: 2143362 } },
        { name: 'IMDb-高分电影', ext: { listId: 2142753 } },
        { name: 'IMDb-高分剧集', ext: { listId: 2143363 } }
    ];

    return jsonify({
        ver: 7.1,
        title: '影视聚合(API)',
        site: MY_BACKEND_URL,
        tabs: TABS    // ★ 不动你的结构
    });
}

// --- home：按你的旧结构返回 class = tabs ---
async function home() {
    const cfg = JSON.parse(await getConfig());
    return jsonify({
        class: cfg.tabs,   // ★ APP 就是需要这个
        filters: {}
    });
}

// --- 分类 ---
async function category(ext, pg) {
    ext = argsify(ext);
    const listId = ext.listId;

    return getCards({ listId: listId, page: pg || 1 });
}

// --- 搜索 ---
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!searchText) return jsonify({ list: [] });

    return getCards({ keyword: searchText, page: page });
}

// --- detail ---
async function detail(id) {
    try {
        const { tmdbid, type } = JSON.parse(id);

        const { data } = await $fetch.get(
            `${MY_BACKEND_URL}/resource?tmdbid=${tmdbid}&type=${type}`
        );

        if (!data || !Array.isArray(data["115"])) return jsonify({ list: [] });

        const tracks = data["115"].map(item => ({
            name: `[115] ${item.title} (${item.size})`,
            pan: item.share_link,
            ext: {}
        }));

        return jsonify({
            list: [{
                title: "115网盘资源",
                tracks: tracks
            }]
        });

    } catch (e) {
        return jsonify({ list: [] });
    }
}

// --- play ---
async function play(flag, id) {
    return jsonify({ url: id });
}

async function init() {
    return getConfig();
}
