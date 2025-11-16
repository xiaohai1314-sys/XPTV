// ============================================
// 影视聚合插件 - 调试版
// 版本: v6.4.0
// 基于您原来可用的代码结构
// ============================================

const PLUGIN_VERSION = "6.4.0";
const MY_BACKEND_URL = "http://192.168.1.7:3003/api";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 调试日志收集器 ---
const debugLogs = [];
function log(msg) { 
    if (DEBUG) {
        const logMsg = `[v${PLUGIN_VERSION}][${new Date().toLocaleTimeString()}] ${msg}`;
        console.log(logMsg);
        debugLogs.push(logMsg);
        if (debugLogs.length > 50) debugLogs.shift();
    }
}

function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// --- 核心数据获取与格式化函数 ---

// 生成调试卡片列表
function getDebugCards() {
    log('[Debug] 生成调试卡片');
    const cards = [];
    
    cards.push({
        vod_id: 'test_category',
        vod_name: '📋 测试：加载分类数据',
        vod_pic: FALLBACK_PIC,
        vod_remarks: '点击测试',
    });
    
    cards.push({
        vod_id: 'test_search',
        vod_name: '🔍 测试：搜索"黄飞鸿"',
        vod_pic: FALLBACK_PIC,
        vod_remarks: '点击测试',
    });
    
    debugLogs.forEach((logMsg, index) => {
        cards.push({
            vod_id: `debug_${index}`,
            vod_name: logMsg,
            vod_pic: FALLBACK_PIC,
            vod_remarks: '',
        });
    });
    
    return jsonify({ list: cards });
}

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
        log('[getCards] 参数错误');
        return jsonify({ list: [] });
    }

    log(`[${context}] 请求: ${requestUrl}`);
    try {
        const response = await $fetch.get(requestUrl);
        log(`[${context}] 响应类型: ${typeof response}, keys: ${Object.keys(response).join(',')}`);
        
        // 关键修复：处理response的不同结构
        let data;
        if (response.data && response.data.items) {
            data = response.data;
            log(`[${context}] 使用 response.data`);
        } else if (response.items) {
            data = response;
            log(`[${context}] 使用 response 本身`);
        } else {
            log(`[${context}] ❌ 找不到items, 完整响应: ${JSON.stringify(response).substring(0, 300)}`);
            return jsonify({ list: [] });
        }
        
        if (!Array.isArray(data.items)) {
            log(`[${context}] ❌ items不是数组: ${typeof data.items}`);
            return jsonify({ list: [] });
        }

        log(`[${context}] 找到 ${data.items.length} 条数据`);

        const cards = data.items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
        }));

        log(`[${context}] ✓ 返回 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[${context}] ❌ 异常: ${e.message}`);
        log(`[${context}] ❌ Stack: ${e.stack}`);
        return jsonify({ list: [] });
    }
}

// --- APP 插件入口函数 (严格遵循规范) ---

// 规范函数1: getConfig (用于初始化)
async function getConfig() {
    log("==== getConfig 被调用 ====");
    // 分类在这里写死
    const CATEGORIES = [
        { name: 'IMDb-热门电影', ext: { listId: 2142788 } },
        { name: 'IMDb-热门剧集', ext: { listId: 2143362 } },
        { name: 'IMDb-高分电影', ext: { listId: 2142753 } },
        { name: 'IMDb-高分剧集', ext: { listId: 2143363 } },
        { name: '🐛调试日志', ext: { debug: true } }
    ];
    
    log(`getConfig 返回 ${CATEGORIES.length} 个分类`);
    
    return jsonify({
        ver: PLUGIN_VERSION,
        title: `影视聚合v${PLUGIN_VERSION}`,
        site: MY_BACKEND_URL,
        tabs: CATEGORIES,
    });
}

// 规范函数2: home (APP调用以获取分类)
async function home() {
    log("==== home 被调用 ====");
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

// 规范函数3: category (APP调用以获取分类下的内容)
async function category(tid, pg) {
    log(`[category] tid=${JSON.stringify(tid)}, pg=${pg}`);
    
    // tid 就是 getConfig 中定义的 ext 对象
    const ext = argsify(tid);
    
    // 调试分类
    if (ext.debug) {
        log('[category] 返回调试日志');
        return getDebugCards();
    }
    
    const listId = ext.listId;
    log(`[category] listId: ${listId}, page: ${pg || 1}`);
    return getCards({ listId: listId, page: pg || 1 });
}

// 规范函数4: search (APP调用以获取搜索结果)
async function search(ext) {
    log(`[search] 收到参数: ${JSON.stringify(ext)}`);
    
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    // nullbr 的搜索API似乎不支持分页，只响应第一页
    if (page > 1) {
        log(`[search] 页码 > 1，返回空列表以停止。`);
        return jsonify({ list: [] });
    }
    if (!searchText) return jsonify({ list: [] });

    log(`[search] 搜索关键词: "${searchText}"`);
    return getCards({ keyword: searchText });
}

// 规范函数5: detail (APP调用以获取详情和播放列表)
async function detail(id) {
    log(`[detail] vod_id: ${id}`);
    
    // 处理测试按钮
    if (id === 'test_category') {
        log('[Test] 执行分类测试');
        await getCards({ listId: 2142788, page: 1 });
        return jsonify({
            list: [{ title: '测试完成，返回查看调试日志', tracks: [] }]
        });
    }
    
    if (id === 'test_search') {
        log('[Test] 执行搜索测试');
        await getCards({ keyword: '黄飞鸿' });
        return jsonify({
            list: [{ title: '测试完成，返回查看调试日志', tracks: [] }]
        });
    }
    
    // 处理调试日志条目
    if (String(id).startsWith('debug_')) {
        return jsonify({
            list: [{ title: '调试信息', tracks: [] }]
        });
    }
    
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
            pan: item.share_link,
            ext: {}
        }));

        log(`[detail] ✓ 成功解析出 ${tracks.length} 个115网盘链接`);
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
    log(`[play] URL: ${id}`);
    return jsonify({ url: id });
}

// 规范函数7: init (兼容旧版APP的初始化入口)
async function init() {
    log(`========== 插件初始化 v${PLUGIN_VERSION} ==========`);
    return getConfig();
}
