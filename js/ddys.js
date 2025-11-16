// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api"; // 【重要】请确认这是您新后端的地址
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V6.0] ${msg}`); }
// 确保 argsify 能处理各种 ext 格式
function argsify(ext) { 
    if (typeof ext === 'string') {
        try {
            return JSON.parse(ext) || {};
        } catch (e) {
            return {};
        }
    }
    return ext || {}; 
}
function jsonify(data) { return JSON.stringify(data); }

// --- 核心数据获取与格式化函数 ---

// 内部函数：获取卡片列表（被 category 和 search 调用）
async function getCards(params) {
    let requestUrl;
    let context; // 用于日志

    if (params.listId) { // 分类模式
        context = 'Category';
        requestUrl = `${MY_BACKEND_URL}/list?id=${params.listId}&page=${params.page || 1}`;
    } else if (params.keyword) { // 搜索模式
        context = 'Search';
        requestUrl = `${MY_BACKEND_URL}/search?keyword=${encodeURIComponent(params.keyword)}`;
    } else {
        return jsonify({ list: [] });
    }

    log(`[${context}] 正在请求后端: ${requestUrl}`);
    try {
        // 使用 $fetch.get 获取数据
        const response = await $fetch.get(requestUrl);
        // 🚨 关键修正: 确保 response 是一个对象，并且其 data 属性存在
        const data = response.data || response; 

        if (!data.items || !Array.isArray(data.items)) {
            // 后端返回成功，但数据结构不正确 (如果返回的是空列表，也应该是一个包含空 items 数组的对象)
            throw new Error(`后端返回的数据中缺少 items 数组或结构错误: ${JSON.stringify(data)}`);
        }

        const cards = data.items.map(item => ({
            // vod_id 必须是字符串，我们将关键信息打包成JSON字符串
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
            // ext 也存储一份，方便某些APP直接读取
            ext: { tmdbid: item.tmdbid, type: item.media_type }
        }));

        log(`[${context}] ✓ 成功格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        // 改进的错误日志，尝试提取 HTTP 状态码和数据
        let errorMessage = e.message;
        if (e.response && e.response.status) {
            errorMessage = `HTTP 错误 ${e.response.status}. 响应内容: ${JSON.stringify(e.response.data)}`;
        } else {
            errorMessage = `网络连接或解析错误: ${e.message}. 请检查后端地址 ${MY_BACKEND_URL} 是否可访问.`;
        }
        
        log(`[${context}] ❌ 请求或处理数据时发生异常: ${errorMessage}`);
        return jsonify({ list: [] });
    }
}

// --- APP 插件入口函数 (严格遵循规范) ---

// 规范函数1: getConfig (用于初始化)
async function getConfig() {
    log("==== 插件初始化 V6.0 (遵循APP规范) ====");
    // 分类在这里写死
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
        tabs: CATEGORIES,
    });
}

// 规范函数2: home (APP调用以获取分类)
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    // 严格返回 { class: ..., filters: ... } 结构
    return jsonify({ class: config.tabs, filters: {} });
}

// 规范函数3: category (APP调用以获取分类下的内容)
async function category(tid, pg) {
    // 🚨 修复分类无通信连接问题: 确保 tid 被解析为对象
    const ext = argsify(tid);
    
    const listId = ext.listId;
    
    if (!listId) {
        log(`[category] ❌ 无法从 ext/tid 中获取 listId。tid=${JSON.stringify(tid)}`);
        return jsonify({ list: [] });
    }

    log(`[category] APP请求分类, listId: ${listId}, page: ${pg}`);
    return getCards({ listId: listId, page: pg || 1 });
}

// 规范函数4: search (APP调用以获取搜索结果)
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    // nullbr 的搜索API似乎不支持分页，或分页逻辑未知，为避免无限加载，只响应第一页
    if (page > 1) {
        log(`[search] 页码 > 1，返回空列表以停止。`);
        return jsonify({ list: [] });
    }
    if (!searchText) return jsonify({ list: [] });

    log(`[search] APP请求搜索, keyword: "${searchText}"`);
    return getCards({ keyword: searchText });
}

// 规范函数5: detail (APP调用以获取详情和播放列表)
async function detail(id) {
    // id 是 vod_id, 即 '{"tmdbid":123,"type":"movie"}'
    log(`[detail] APP请求详情, vod_id: ${id}`);
    try {
        // 严格解析 vod_id
        const { tmdbid, type } = JSON.parse(id);
        if (!tmdbid || !type) throw new Error("vod_id 格式不正确");

        const requestUrl = `${MY_BACKEND_URL}/resource?tmdbid=${tmdbid}&type=${type}`;
        log(`[detail] 正在请求后端: ${requestUrl}`);
        
        const response = await $fetch.get(requestUrl);
        const data = response.data || response;

        if (!data['115'] || !Array.isArray(data['115'])) {
            throw new Error(`后端未返回有效的115资源列表或结构错误: ${JSON.stringify(data)}`);
        }

        const tracks = data['115'].map(item => ({
            name: `[115] ${item.title} (${item.size})`,
            pan: item.share_link, // 这是最终的网盘链接
            ext: {}
        }));

        log(`[detail] ✓ 成功解析出 ${tracks.length} 个115网盘链接`);
        // 严格返回 { list: [{ title: ..., tracks: [...] }] } 结构
        return jsonify({
            list: [{ title: '115网盘资源', tracks: tracks }]
        });

    } catch (e) {
        let errorMessage = e.message;
        if (e.response && e.response.status) {
            errorMessage = `HTTP 错误 ${e.response.status}. 响应内容: ${JSON.stringify(e.response.data)}`;
        } else {
             errorMessage = `网络连接或解析错误: ${e.message}. 请检查后端地址 ${MY_BACKEND_URL} 是否可访问.`;
        }
        log(`[detail] ❌ 获取详情时发生异常: ${errorMessage}`);
        return jsonify({ list: [] });
    }
}

// 规范函数6: play (APP调用以播放)
async function play(flag, id) {
    // 在我们的设计中，id 就是网盘链接
    log(`[play] APP请求播放, URL: ${id}`);
    return jsonify({ url: id });
}

// 规范函数7: init (兼容旧版APP的初始化入口)
async function init() {
    return getConfig();
}
