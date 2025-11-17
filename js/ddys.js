/**
 * Nullbr 影视库前端插件 - V60.1 (调试版)
 * 将详情页数据通过卡片显示出来，用于调试
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60.1] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

let END_LOCK = {};
let DEBUG_INFO = {}; // 存储调试信息

async function init(ext) {
    END_LOCK = {};
    DEBUG_INFO = {};
    return jsonify({});
}

async function getConfig() { 
    return jsonify({ 
        ver: 60.1, 
        title: 'Nullbr影视库 (调试版)', 
        site: API_BASE_URL, 
        tabs: CATEGORIES 
    }); 
}

async function home() { 
    return jsonify({ class: CATEGORIES, filters: {} }); 
}

async function category(tid, pg, filter, ext) { 
    return jsonify({ list: [] }); 
}

// 1. 分类列表
async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`;
    
    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `${API_BASE_URL}/api/list?id=${id}&page=${page}`;

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);
        
        const pageSize = 30;
        if (data.items.length < pageSize) {
            END_LOCK[lockKey] = true;
        }
        const hasMore = !END_LOCK[lockKey];

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) {
        return handleError(err);
    }
}

// 2. 搜索功能
async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });
    const lockKey = `search_${keyword}`;

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `${API_BASE_URL}/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);

        const pageSize = 30;
        if (data.items.length < pageSize) {
            END_LOCK[lockKey] = true;
        }
        const hasMore = !END_LOCK[lockKey];

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
            limit: cards.length,
            total: data.total_results
        });
    } catch (err) {
        return handleError(err);
    }
}

// 3. 详情页 (调试版 - 将错误信息存储起来)
async function detail(id) {
    DEBUG_INFO[id] = { step: '开始', error: null };
    
    if (!id || id.indexOf('_') === -1) {
        DEBUG_INFO[id] = { step: 'ID格式错误', id: id };
        return jsonify({ list: [] });
    }

    const [type, tmdbid] = id.split('_');
    DEBUG_INFO[id] = { step: '解析ID', type: type, tmdbid: tmdbid };
    
    const url = `${API_BASE_URL}/api/resource?type=${type}&tmdbid=${tmdbid}`;

    try {
        const response = await $fetch.get(url);
        DEBUG_INFO[id] = { step: '收到响应', status: 'ok', hasData: !!response.data };
        
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        DEBUG_INFO[id].dataKeys = data ? Object.keys(data).join(',') : 'null';
        
        if (!data) {
            DEBUG_INFO[id].step = '数据为空';
            return jsonify({ list: [] });
        }
        
        if (!data['115']) {
            DEBUG_INFO[id].step = '无115字段';
            return jsonify({ list: [] });
        }
        
        if (!Array.isArray(data['115'])) {
            DEBUG_INFO[id].step = '115不是数组';
            DEBUG_INFO[id].type115 = typeof data['115'];
            return jsonify({ list: [] });
        }

        const resourceCount = data['115'].length;
        DEBUG_INFO[id] = { step: '成功', count: resourceCount };

        // 构建播放列表
        const tracks = data['115'].map((item, index) => {
            const title = item.title || `资源${index + 1}`;
            const size = item.size || '未知';
            const resolution = item.resolution || '';
            const quality = item.quality || '';
            
            let displayName = title;
            if (resolution || quality) {
                displayName += ` [${[resolution, quality].filter(x => x).join(' ')}]`;
            }
            displayName += ` [${size}]`;
            
            return {
                name: displayName,
                url: item.share_link
            };
        });

        return jsonify({
            list: [{
                vod_id: id,
                vod_name: "115网盘资源",
                vod_pic: "",
                vod_remarks: `共${resourceCount}个资源`,
                vod_play_from: "115网盘",
                vod_play_url: tracks.map(t => `${t.name}$${t.url}`).join('#')
            }]
        });
        
    } catch (err) {
        DEBUG_INFO[id] = { 
            step: '异常', 
            error: err.message,
            stack: err.stack ? err.stack.substring(0, 100) : 'no stack'
        };
        return jsonify({ list: [] });
    }
}

// 4. 播放
async function play(flag, id, flags) {
    return jsonify({
        parse: 0,
        url: id
    });
}

// 5. 🔍 新增：调试信息查询接口
async function getDebugInfo(ext) {
    const cards = Object.keys(DEBUG_INFO).map(id => ({
        vod_id: id,
        vod_name: `调试: ${id}`,
        vod_pic: "",
        vod_remarks: JSON.stringify(DEBUG_INFO[id])
    }));
    
    return jsonify({
        list: cards,
        page: 1,
        pagecount: 1
    });
}

// =======================================================================
// --- 辅助函数区 ---
// =======================================================================

function parseExt(ext) {
    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id, pg, page: page_alt, text } = extObj.ext || extObj || {};
        return {
            id: id || (extObj.class && extObj.class.length > 0 ? extObj.class[0].ext.id : CATEGORIES[0].ext.id),
            page: pg || page_alt || 1,
            text: text || ""
        };
    } catch (e) {
        return { id: CATEGORIES[0].ext.id, page: 1, text: "" };
    }
}

async function fetchData(url) {
    const response = await $fetch.get(url);
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data) throw new Error("后端未返回有效数据");
    return data;
}

function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => {
        const vodId = `${item.media_type}_${item.tmdbid}`;
        
        // 🔍 在卡片备注中显示调试信息
        let remarks = item.overview || (item.release_date ? item.release_date.substring(0, 4) : '');
        
        // 如果这个ID有调试信息，追加到备注中
        if (DEBUG_INFO[vodId]) {
            remarks += ` [调试:${JSON.stringify(DEBUG_INFO[vodId])}]`;
        }
        
        return {
            vod_id: vodId,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: remarks
        };
    });
}

function handleError(err) {
    return jsonify({ list: [] });
}
