// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api"; // 【重要】请确认这是您新后端的地址
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V6.0] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// --- 核心数据获取与格式化函数 ---

// 内部函数：获取卡片列表（被 category 和 search 调用）
async function getCards(params) {
    let requestUrl;
    let context; // 用于日志

    if (params.listId) { // 分类模式
        context = 'Category';
        // 分类 URL 构造是正确的
        requestUrl = `${MY_BACKEND_URL}/list?id=${params.listId}&page=${params.page || 1}`;
    } else if (params.keyword) { // 搜索模式
        context = 'Search';
        // 【修正 1】：搜索 URL 必须包含 page 参数
        requestUrl = `${MY_BACKEND_URL}/search?keyword=${encodeURIComponent(params.keyword)}&page=${params.page || 1}`;
    } else {
        return jsonify({ list: [] });
    }

    log(`[${context}] 正在请求后端: ${requestUrl}`);

    try {
        const { data } = await $fetch.get(requestUrl);

        // 【修正 2】：放宽数据结构校验。如果后端返回的数据不是预期的列表结构，不抛出异常，直接返回空列表。
        if (!data || !Array.isArray(data.items)) {
             // 检查是否是后端代理返回的错误 JSON（如 message 字段）
             if (data && data.message) {
                 log(`[${context}] ⚠️ 后端返回了错误信息: ${data.message}`);
             } else {
                 log(`[${context}] ⚠️ 后端返回的数据不是预期的列表结构，或缺少 items 数组。`);
             }
             // 避免因非列表数据结构或错误信息而抛出异常
             return jsonify({ list: [] });
        }

        log(`[${context}] ✓ 成功解析出 ${data.items.length} 个项目`);

        // 【修正 3】：适配分类和搜索的字段名
        // 分类使用 total_items / total_page，搜索使用 total_results / total_pages
        const totalItems = data.total_items || data.total_results;
        const totalPages = data.total_page || data.total_pages;

        return jsonify({
            list: data.items.map(item => ({
                title: item.title,
                img: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
                desc: `评分: ${item.vote_average || 'N/A'} / ${item.release_date || 'N/A'}`,
                ext: { vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }) }
            })),
            // 使用适配后的字段，避免因 undefined 导致运行时异常
            total: totalItems,
            total_page: totalPages
        });

    } catch (e) {
        log(`[${context}] ❌ 请求或处理数据时发生异常: ${e.message}`);
        // 确保在异常时返回符合规范的空列表
        return jsonify({ list: [] });
    }
}

// 规范函数1: category (APP调用以获取分类列表)
async function category(id) {
    const params = argsify(id);
    log(`[category] APP请求分类, listId: ${params.listId || 'N/A'}, page: ${params.page || 1}`);
    if (params.listId) {
        return getCards(params);
    }
    // 假设您只关注内容页的列表
    return jsonify({ list: [] });
}

// 规范函数2: search (APP调用以获取搜索结果)
async function search(id) {
    const ext = argsify(id);
    const searchText = ext.keyword;
    if (!searchText) return jsonify({ list: [] });

    log(`[search] APP请求搜索, keyword: "${searchText}"`);
    // 注意：getCards 已经修复了分页参数 page 的传递
    return getCards({ keyword: searchText, page: ext.page || 1 });
}

// 规范函数5: detail (APP调用以获取详情和播放列表)
async function detail(id) {
    // id 是 vod_id, 即 '{\"tmdbid\":123,\"type\":\"movie\"}'
    log(`[detail] APP请求详情, vod_id: ${id}`);
    try {
        const { tmdbid, type } = JSON.parse(id);
        if (!tmdbid || !type) throw new Error("vod_id 格式不正确");

        const requestUrl = `${MY_BACKEND_URL}/resource?tmdbid=${tmdbid}&type=${type}`;
        log(`[detail] 正在请求后端: ${requestUrl}`);

        const { data } = await $fetch.get(requestUrl);
        if (!data['115'] || !Array.isArray(data['115'])) {
            throw new Error("后端未返回有效的115资源列表");
        }

        const tracks = data['115'].map(item => ({
            name: `[115] ${item.title} (${item.size})`,
            pan: item.share_link, // 这是最终的网盘链接
            ext: {}
        }));

        log(`[detail] ✓ 成功解析出 ${tracks.length} 个115网盘链接`);
        // 严格返回 { list: [{ title: ..., tracks: [...] }] } 结构
        return jsonify({
            list: [{ title: '115网盘', tracks: tracks }]
        });
    } catch (e) {
        log(`[detail] ❌ 获取详情或网盘链接时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}
