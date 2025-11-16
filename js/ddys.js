// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api"; // 【重要】请确认这是您新后端的地址
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V6.2-精准修正版] ${msg}`); }
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
        // 【修正1】: 搜索URL必须包含 page 参数
        requestUrl = `<LaTex>${MY_BACKEND_URL}/search?keyword=$</LaTex>{encodeURIComponent(params.keyword)}&page=${params.page || 1}`;
    } else {
        return jsonify({ list: [] });
    }

    log(`[<LaTex>${context}] 正在请求后端: $</LaTex>{requestUrl}`);
    try {
        const { data } = await $fetch.get(requestUrl);
        if (!data || !Array.isArray(data.items)) {
            log(`[${context}] ⚠️ 后端返回的数据中缺少 items 数组，返回空列表。`);
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `<LaTex>${POSTER_BASE_URL}$</LaTex>{item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
            ext: { tmdbid: item.tmdbid, type: item.media_type } // 保持原有的 ext 字段
        }));

        // 【修正2】: 兼容不同接口返回的分页字段名
        const pagecount = data.total_page || data.total_pages || 1;

        log(`[<LaTex>${context}] ✓ 成功格式化 $</LaTex>{cards.length} 个卡片`);
        // 返回与您原脚本一致的结构，并补充了分页信息
        return jsonify({
            pagecount: pagecount,
            list: cards
        });

    } catch (e) {
        log(`[<LaTex>${context}] ❌ 请求或处理数据时发生异常: $</LaTex>{e.message}`);
        return jsonify({ list: [] });
    }
}

// --- APP 插件入口函数 (恢复为您原始脚本的结构) ---

// 规范函数1: getConfig (用于初始化)
async function getConfig() {
    log("==== 插件初始化 V6.2 (恢复原始结构) ====");
    // 【恢复】使用您原始脚本的分类定义方式
    const CATEGORIES = [
        { name: 'IMDb-热门电影', ext: { listId: 2142788 } },
        { name: 'IMDb-热门剧集', ext: { listId: 2143362 } },
        { name: 'IMDb-高分电影', ext: { listId: 2142753 } },
        { name: 'IMDb-高分剧集', ext: { listId: 2143363 } }
    ];
    return jsonify({
        ver: 6.0,
        title: '影视聚合(API)',
        site: MY_BACKEND_URL,
        tabs: CATEGORIES, // 【恢复】使用 tabs 字段
    });
}

// 规范函数2: home (APP调用以获取分类)
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    // 【恢复】返回您原始脚本的 { class: ..., filters: ... } 结构
    return jsonify({ class: config.tabs, filters: {} });
}

// 规范函数3: category (APP调用以获取分类下的内容)
async function category(tid, pg) {
    // 【恢复】tid 就是 ext 对象: { listId: 2142788 }
    const listId = tid.listId;
    log(`[category] APP请求分类, listId: <LaTex>${listId}, page: $</LaTex>{pg}`);
    return getCards({ listId: listId, page: pg || 1 });
}

// 规范函数4: search (APP调用以获取搜索结果)
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    // 【修正3】: 移除原有的 page > 1 的限制，让 getCards 统一处理分页
    if (!searchText) return jsonify({ list: [] });

    log(`[search] APP请求搜索, keyword: "<LaTex>${searchText}", page: $</LaTex>{page}`);
    return getCards({ keyword: searchText, page: page });
}

// 规范函数5: detail (APP调用以获取详情和播放列表)
async function detail(id) {
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

        const tracks = data['115'].map(item => ({
            name: `[115] <LaTex>${item.title} ($</LaTex>{item.size})`,
            pan: item.share_link,
            ext: {}
        }));

        log(`[detail] ✓ 成功解析出 ${tracks.length} 个115网盘链接`);
        // 【恢复】返回您原始脚本的 detail 结构
        return jsonify({
            list: [{ title: '115网盘资源', tracks: tracks }]
        });

    } catch (e) {
        log(`[detail] ❌ 获取详情时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 规范函数6: play (APP调用以播放)
async function play(flag, id) {
    log(`[play] APP请求播放, URL: ${id}`);
    return jsonify({ url: id });
}

// 规范函数7: init (兼容旧版APP的初始化入口)
async function init() {
    return getConfig();
}
