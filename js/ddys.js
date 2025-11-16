// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api"; // 【重要】请确认这是您新后端的地址
// 强制使用 HTTPS 基础 URL
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
// 替代图片 URL (用于数据中缺少 poster 字段时)
const FALLBACK_PIC = 'https://placehold.co/500x750/3498db/ffffff?text=No+Poster'; 
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V6.9] ${msg}`); }

// 强化解析函数，处理字符串、对象或 null/undefined
function argsify(ext) { 
    if (typeof ext === 'string' && ext.trim().startsWith('{')) {
        try {
            return JSON.parse(ext) || {};
        } catch (e) {
            log(`[argsify] ❌ JSON解析失败: ${e.message}`);
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
    let context; 

    if (params.listId) { 
        context = 'Category';
        requestUrl = `${MY_BACKEND_URL}/list?id=${params.listId}&page=${params.page || 1}`;
    } else if (params.keyword) { 
        context = 'Search';
        requestUrl = `${MY_BACKEND_URL}/search?keyword=${encodeURIComponent(params.keyword)}`;
    } else {
        return jsonify({ list: [] });
    }

    log(`[${context}] 正在请求后端: ${requestUrl}`);
    try {
        const response = await $fetch.get(requestUrl);
        const data = response.data || response; 

        if (!data.items || !Array.isArray(data.items)) {
            throw new Error(`后端返回的数据中缺少 items 数组或结构错误: ${JSON.stringify(data)}`);
        }
        
        log(`[${context}] ✅ 从后端接收到 ${data.items.length} 个项目`);

        const cards = data.items.map(item => {
            // 1. 严格处理 ID
            const tmdbid = String(item.tmdbid || ''); 
            const media_type = item.media_type || 'movie'; 
            
            // 2. 严格处理 vod_remarks: 采用最安全的格式
            let remarks = String(item.media_type || '类型');
            if (item.vote_average && typeof item.vote_average === 'number') {
                remarks = `⭐️ ${item.vote_average.toFixed(1)} / ${remarks}`;
            }

            // 3. 严格处理 vod_pic (海报)：保留图片拼接逻辑
            const posterPath = item.poster || ''; 
            
            // 4. 严格处理 vod_name (标题)
            const title = String(item.title || '未知标题').trim(); 
            
            // 只有当 tmdbid 有效时才返回卡片
            if (!tmdbid) {
                 return null;
            } 
            
            const card = {
                // vod_id: 必须是字符串，打包关键信息
                vod_id: jsonify({ tmdbid: tmdbid, type: media_type }),
                vod_name: title,
                // 恢复图片拼接：使用 POSTER_BASE_URL
                vod_pic: (posterPath && typeof posterPath === 'string') ? `${POSTER_BASE_URL}${posterPath}` : FALLBACK_PIC,
                vod_remarks: remarks,
                ext: { tmdbid: tmdbid, type: media_type }
            };
            return card;

        }).filter(card => card !== null); // 过滤掉无效卡片

        log(`[${context}] ✓ 最终向 APP 返回 ${cards.length} 个有效卡片`);
        return jsonify({ list: cards });

    } catch (e) {
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
    log("==== 插件初始化 V6.9 (修复分类Tab不显示问题) ====");
    // 分类在这里写死
    // 修复点: 确保 ext 字段是 JSON 字符串，以兼容更多 APP 插件加载器
    const CATEGORIES = [
        { name: 'IMDb-热门电影', ext: jsonify({ listId: 2142788 }) },
        { name: 'IMDb-热门剧集', ext: jsonify({ listId: 2143362 }) },
        { name: 'IMDb-高分电影', ext: jsonify({ listId: 2142753 }) },
        { name: 'IMDb-高分剧集', ext: jsonify({ listId: 2143363 }) }
    ];
    return jsonify({
        ver: 6.9,
        title: '影视聚合(API)',
        site: MY_BACKEND_URL,
        tabs: CATEGORIES,
    });
}

// 规范函数2: home (APP调用以获取分类)
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

// 规范函数3: category (APP调用以获取分类下的内容)
async function category(tid, pg) {
    // 这里的 argsify(tid) 会把 getConfig 中 stringified 的 ext 重新解析回对象
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
    log(`[detail] APP请求详情, vod_id: ${id}`);
    try {
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
            name: `[115] ${item.title || '未知资源'} (${item.size || '未知大小'})`,
            pan: item.share_link, 
            ext: {}
        }));

        log(`[detail] ✓ 成功解析出 ${tracks.length} 个115网盘链接`);
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
    log(`[play] APP请求播放, URL: ${id}`);
    return jsonify({ url: id });
}

// 规范函数7: init (兼容旧版APP的初始化入口)
async function init() {
    return getConfig();
}
