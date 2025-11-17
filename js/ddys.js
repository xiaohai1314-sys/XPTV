/**
 * Nullbr 影视库前端插件 - V60.1 (修复版)
 *
 * 变更日志:
 * - V60.1 (2025-11-17):
 *   - [修复] 解决了详情页因数据解析问题导致无法加载、一直转圈的BUG。
 *   - [增强] 重写了 fetchData 辅助函数，使其能够兼容不同App环境下 $fetch 返回的多种数据结构（字符串、带data属性的对象、或数据对象本身）。
 *   - [增强] 为 detail 函数增加了更详细的日志输出，便于未来调试。
 *   - [保留] 分类(getCards)和搜索(search)功能代码保持不变，确保原有功能稳定。
 *
 * 作者: Manus
 * 日期: 2025-11-17
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

// ★★★★★【统一的分页锁，服务于分类和搜索】★★★★★
let END_LOCK = {};

// --- 入口函数 ---
async function init(ext) {
    END_LOCK = {}; // 插件初始化时，清空所有锁
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 60.1, title: 'Nullbr影视库 (V60.1)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return jsonify({ list: [] }); } // 彻底废弃

// =======================================================================
// --- 核心功能区 ---
// =======================================================================

// 1. 分类列表 (原封不动)
async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`;
    
    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{id}&page=${page}`;
    log(`[getCards] 请求URL: ${url}`);

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

// 2. 搜索功能 (原封不动)
async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });
    const lockKey = `search_${keyword}`;

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `<LaTex>${API_BASE_URL}/api/search?keyword=$</LaTex>{encodeURIComponent(keyword)}&page=${page}`;
    log(`[search] 请求URL: ${url}`);

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

// 3. 详情页/网盘提取 (微调日志)
async function detail(id) {
    log(`[detail] 开始处理详情页, vod_id: ${id}`);
    if (!id || id.indexOf('_') === -1) {
        log(`[detail] 错误: vod_id格式不正确: ${id}`);
        return jsonify({ list: [] });
    }

    const [type, tmdbid] = id.split('_');
    const url = `<LaTex>${API_BASE_URL}/api/resource?type=$</LaTex>{type}&tmdbid=${tmdbid}`;
    log(`[detail] 准备请求URL: ${url}`);

    try {
        const data = await fetchData(url); // 使用新的 fetchData
        
        if (!data || !Array.isArray(data['115']) || data['115'].length === 0) {
            log(`[detail] 错误: 响应数据中没有找到有效的 '115' 数组。收到的数据: ${JSON.stringify(data)}`);
            return jsonify({ list: [] });
        }

        log(`[detail] 成功获取到 ${data['115'].length} 个115资源，开始格式化...`);

        const tracks = data['115'].map(item => {
            if (!item || !item.share_link) return null;
            const name = `<LaTex>${item.title || '未知标题'} [$</LaTex>{item.size || '未知大小'}]`;
            return `<LaTex>${name}$</LaTex>${item.share_link}`;
        }).filter(Boolean);

        if (tracks.length === 0) {
            log('[detail] 格式化后没有可用的播放链接。');
            return jsonify({ list: [] });
        }
        
        const playUrlString = tracks.join('#');
        log(`[detail] 成功生成播放字符串 (共${tracks.length}条)`);

        return jsonify({
            list: [{
                vod_name: "115网盘资源",
                vod_play_from: "115",
                vod_play_url: playUrlString
            }]
        });
    } catch (err) {
        return handleError(err);
    }
}

// 4. 播放 (原封不动)
async function play(flag, id, flags) {
    log(`[play] 请求播放, flag: <LaTex>${flag}, id: $</LaTex>{id}`);
    return jsonify({
        parse: 0,
        url: id
    });
}

// =======================================================================
// --- 辅助函数区 ---
// =======================================================================

// 统一解析ext参数 (原封不动)
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

// ★★★ 统一请求数据 (V2 - 兼容性增强版) ★★★
async function fetchData(url) {
    log(`[fetchData] 请求URL: ${url}`);
    const response = await $fetch.get(url);
    log(`[fetchData] 收到原始响应，类型为: ${typeof response}`);

    let data;
    if (typeof response === 'string' && response.length > 0) {
        log('[fetchData] 响应是字符串，尝试JSON解析...');
        try {
            data = JSON.parse(response);
        } catch (e) {
            log(`[fetchData] JSON解析失败: ${e.message}`);
            throw new Error(`响应为字符串但JSON解析失败: ${response}`);
        }
    } else if (typeof response === 'object' && response !== null) {
        log('[fetchData] 响应是对象...');
        if (Object.keys(response).length === 0) {
             throw new Error("收到了一个空对象");
        }
        // 检查是否是包含 'data' 属性的包装对象
        if (response.data && typeof response.data === 'string') {
            log('[fetchData] ...对象内有string类型的data属性，解析它');
            data = JSON.parse(response.data);
        } else if (response.data && typeof response.data === 'object') {
            log('[fetchData] ...对象内有object类型的data属性，使用它');
            data = response.data;
        } else {
            log('[fetchData] ...对象无有效data属性，视其本身为数据');
            data = response;
        }
    } else {
        throw new Error(`收到了无法处理的响应类型: ${typeof response}`);
    }

    if (!data) {
        throw new Error("解析后未获得有效数据");
    }
    
    log('[fetchData] 成功解析数据。');
    return data;
}

// 统一格式化卡片 (原封不动)
function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => ({
        vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
        vod_name: item.title || '未命名',
        vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
        vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '')
    }));
}

// 统一错误处理 (原封不动)
function handleError(err) {
    log(`请求失败: ${err.message}`);
    return jsonify({ list: [] });
}
