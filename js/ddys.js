// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api"; 
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V7.2] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }


// ========== 核心列表获取 ==========
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
            log(`⚠️ 后端返回异常`);
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
            ext: { tmdbid: item.tmdbid, type: item.media_type }
        }));

        return jsonify({
            page: data.page || params.page || 1,
            pagecount: data.total_pages || data.total_page || 1,
            list: cards
        });

    } catch (e) {
        log(`❌ getCards 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}


// ========== APP 必需函数 ==========

// ① getConfig
async function getConfig() {
    log("初始化 V7.2");

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

// ② home
async function home() {
    const cfg = JSON.parse(await getConfig());
    return jsonify({ class: cfg.tabs, filters: {} });
}

// ③ category（核心修复点）
//    tid.ext.listId 才是正确的
async function category(tid, pg) {
    const listId = tid?.ext?.listId;  // ✅ 正确读取位置
    const page = pg || 1;

    log(`[category] listId=${listId} page=${page}`);
    if (!listId) return jsonify({ list: [] });

    return getCards({ listId, page });
}

// ④ search
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || "";
    const page = ext.page || 1;

    if (!text) return jsonify({ list: [] });

    log(`[search] keyword="${text}" page=${page}`);
    return getCards({ keyword: text, page });
}

// ⑤ detail
async function detail(id) {
    log(`[detail] id=${id}`);

    try {
        const { tmdbid, type } = JSON.parse(id);

        const url = `${MY_BACKEND_URL}/resource?tmdbid=${tmdbid}&type=${type}`;
        const { data } = await $fetch.get(url);

        if (!data || !Array.isArray(data['115'])) {
            return jsonify({ list: [] });
        }

        const tracks = data['115'].map(item => ({
            name: `[115] ${item.title} (${item.size})`,
            pan: item.share_link
        }));

        return jsonify({
            list: [{
                title: "115网盘资源",
                tracks
            }]
        });

    } catch (e) {
        log(`❌ detail error: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ⑥ play
async function play(flag, id) {
    return jsonify({ url: id });
}

// ⑦ init
async function init() {
    return getConfig();
}
