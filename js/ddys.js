// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api"; // 【重要】请确认这是您新后端的地址
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V6.1-修正版] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// --- 核心数据获取与格式化函数 (已修正) ---
async function getCards(params) {
    let requestUrl;
    let context; // 用于日志

    if (params.listId) { // 分类模式
        context = 'Category';
        requestUrl = `<LaTex>${MY_BACKEND_URL}/list?id=$</LaTex>{params.listId}&page=${params.page || 1}`;
    } else if (params.keyword) { // 搜索模式
        context = 'Search';
        // 【修正 1】: 搜索URL必须包含 page 参数，否则后端可能不返回数据
        requestUrl = `<LaTex>${MY_BACKEND_URL}/search?keyword=$</LaTex>{encodeURIComponent(params.keyword)}&page=${params.page || 1}`;
    } else {
        return jsonify({ list: [] });
    }

    log(`[<LaTex>${context}] 正在请求后端: $</LaTex>{requestUrl}`);
    try {
        const { data } = await $fetch.get(requestUrl);
        // 【修正 2】: 增强数据校验，如果后端返回的数据结构不符合预期，直接返回空列表，防止插件崩溃
        if (!data || !Array.isArray(data.items)) {
            log(`[${context}] ⚠️ 后端返回的数据中缺少 items 数组或数据格式不正确，返回空列表。`);
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `<LaTex>${POSTER_BASE_URL}$</LaTex>{item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
        }));

        // 【修正 3】: 兼容不同接口返回的分页字段名
        const page = data.page || params.page || 1;
        const pagecount = data.total_page || data.total_pages || 1;
        const total = data.total_items || data.total_results || 0;

        log(`[<LaTex>${context}] ✓ 成功格式化 $</LaTex>{cards.length} 个卡片 (第<LaTex>${page}页/共$</LaTex>{pagecount}页)`);
        return jsonify({
            page: page,
            pagecount: pagecount,
            total: total,
            list: cards
        });

    } catch (e) {
        log(`[<LaTex>${context}] ❌ 请求或处理数据时发生异常: $</LaTex>{e.message}`);
        return jsonify({ list: [] }); // 发生任何错误都返回空列表
    }
}

// --- APP 插件入口函数 (严格遵循规范) ---

// 规范函数1: getConfig (用于初始化)
async function getConfig() {
    log("==== 插件初始化 V6.1 (遵循APP规范) ====");
    const CATEGORIES = [
        { "type_id": JSON.stringify({ listId: 2142788 }), "type_name": 'IMDb-热门电影' },
        { "type_id": JSON.stringify({ listId: 2143362 }), "type_name": 'IMDb-热门剧集' },
        { "type_id": JSON.stringify({ listId: 2142753 }), "type_name": 'IMDb-高分电影' },
        { "type_id": JSON.stringify({ listId: 2143363 }), "type_name": 'IMDb-高分剧集' }
    ];
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// 规范函数2: home (APP调用以获取分类)
async function home() {
    return getConfig();
}

// 规范函数3: category (APP调用以获取分类下的内容)
async function category(tid, pg, filter, ext) {
    // tid 在新版APP中是JSON字符串，如 '{"listId":2142788}'
    const params = argsify(tid);
    log(`[category] APP请求分类, listId: <LaTex>${params.listId}, page: $</LaTex>{pg}`);
    return getCards({ listId: params.listId, page: pg || 1 });
}

// 规范函数4: search (APP调用以获取搜索结果)
async function search(wd, quick, pg) {
    // wd 是搜索关键词
    log(`[search] APP请求搜索, keyword: "<LaTex>${wd}", page: $</LaTex>{pg}`);
    if (!wd) return jsonify({ list: [] });
    return getCards({ keyword: wd, page: pg || 1 });
}

// 规范函数5: detail (APP调用以获取详情和播放列表)
async function detail(id) {
    // id 是 vod_id, 即 '{"tmdbid":123,"type":"movie"}'
    log(`[detail] APP请求详情, vod_id: ${id}`);
    try {
        const { tmdbid, type } = JSON.parse(id);
        if (!tmdbid || !type) throw new Error("vod_id 格式不正确");

        const requestUrl = `<LaTex>${MY_BACKEND_URL}/resource?tmdbid=$</LaTex>{tmdbid}&type=${type}`;
        log(`[detail] 正在请求后端: ${requestUrl}`);
        
        const { data } = await $fetch.get(requestUrl);
        if (!data || !Array.isArray(data['115'])) {
            throw new Error("后端未返回有效的115资源列表");
        }

        const tracks = data['115'].map(item => `<LaTex>${item.title} ($</LaTex>{item.size})$${item.share_link}`);

        log(`[detail] ✓ 成功解析出 ${tracks.length} 个115网盘链接`);
        return jsonify({
            vod_play_from: '115网盘',
            vod_play_url: tracks.join('#')
        });

    } catch (e) {
        log(`[detail] ❌ 获取详情时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 规范函数6: play (APP调用以播放)
async function play(flag, id, flags) {
    // id 就是网盘链接
    log(`[play] APP请求播放, URL: ${id}`);
    return jsonify({ parse: 0, url: id });
}

// 规范函数7: init (兼容旧版APP的初始化入口)
async function init(ext) {
    return getConfig();
}
