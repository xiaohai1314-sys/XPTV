// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V7.2修复版] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// --- 核心数据获取 ---
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

    log(`[${context}] 请求: ${requestUrl}`);

    try {
        const { data } = await $fetch.get(requestUrl);
        if (!data) return jsonify({ list: [] });

        // ★ 兼容你后端字段
        const items = data.items || data.result || data.list || [];
        if (!Array.isArray(items)) return jsonify({ list: [] });

        const cards = items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title || item.name,
            vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
            ext: { tmdbid: item.tmdbid, type: item.media_type }
        }));

        const page = data.page || params.page || 1;
        const pagecount =
            data.total_pages ||
            data.total_page ||
            data.pages ||
            1;

        log(`[${context}] ✓ ${cards.length} 条 (第${page}页/共${pagecount}页)`);

        return jsonify({
            page,
            pagecount,
            list: cards
        });

    } catch (e) {
        log(`[${context}] ❌ 错误：${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getConfig：保持原样 ---
async function getConfig() {
    log("==== 插件初始化 V7.1 ====");
    const CATEGORIES = [
        { name: 'IMDb-热门电影', ext: { listId: 2142788 } },
        { name: 'IMDb-热门剧集', ext: { listId: 2143362 } },
        { name: 'IMDb-高分电影', ext: { listId: 2142753 } },
        { name: 'IMDb-高分剧集', ext: { listId: 2143363 } }
    ];
    return jsonify({
        ver: 7.2,
        title: '影视聚合(API)',
        site: MY_BACKEND_URL,
        tabs: CATEGORIES
    });
}

// --- home：必须保持 class = tabs ---
async function home() {
    const cfg = JSON.parse(await getConfig());
    return jsonify({
        class: cfg.tabs,
        filters: {}
    });
}

// --- 分类 ---
async function category(tid, pg) {
    const listId = tid.listId;
    const page = pg || 1;

    log(`[category] 分类请求 listId=${listId} page=${page}`);

    return getCards({ listId, page });
}

// --- 搜索 ---
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!searchText) return jsonify({ list: [] });

    log(`[search] keyword="${searchText}" page=${page}`);

    return getCards({ keyword: searchText, page });
}

// --- detail ---（更安全，不崩溃）
async function detail(id) {
    try {
        const { tmdbid, type } = JSON.parse(id);

        const { data } = await $fetch.get(
            `${MY_BACKEND_URL}/resource?tmdbid=${tmdbid}&type=${type}`
        );

        const list115 = data?.["115"] || [];

        const tracks = list115.map(item => ({
            name: `[115] ${item.title} (${item.size})`,
            pan: item.share_link,
            ext: {}
        }));

        return jsonify({
            list: [{
                title: '115网盘资源',
                tracks
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
