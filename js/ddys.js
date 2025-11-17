/**
 * Nullbr 影视库前端插件 - V60.0 (功能完整最终版)
 *
 * 变更日志:
 * - V60.0 (2025-11-17):
 * - [功能实现] 新增 search 函数，并集成了“分页锁”机制，实现了完美的搜索分页。
 * - [功能实现] 新增 detail 函数，用于请求后端/api/resource接口，获取网盘资源列表。
 * - [功能实现] 新增 play 函数，用于直接返回115网盘链接给App。
 * - [代码重构] 统一了分页锁的逻辑，使其可以同时服务于分类和搜索。
 * - 这是集成了全部分析成果的、功能完整的最终版本。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60.0] ${msg}`);
}

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
    END_LOCK = {};
// 插件初始化时，清空所有锁
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 60.0, title: 'Nullbr影视库 (V60)', site: API_BASE_URL, tabs: CATEGORIES });
}
async function home() { return jsonify({ class: CATEGORIES, filters: {} });
}
async function category(tid, pg, filter, ext) { return jsonify({ list: [] });
} // 彻底废弃

// =======================================================================
// --- 核心功能区 ---
// =======================================================================

// 1. 分类列表 (V59的最终形态)
async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`; // 分类锁的键，加个前缀避免和搜索冲突
    
    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `${API_BASE_URL}/api/list?id=${id}&page=${page}`;
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

// 2. 搜索功能 (全新实现)
async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });
    const lockKey = `search_${keyword}`;
    // 搜索锁的键

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) { delete END_LOCK[lockKey]; }

    const url = `${API_BASE_URL}/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    log(`[search] 请求URL: ${url}`);

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items);

        const pageSize = 30; // 搜索结果也是每页30条
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

// 3. 详情页/网盘提取 (修复版)
async function detail(id) {
    log(`[detail] 请求详情, vod_id: ${id}`);
    if (!id || id.indexOf('_') === -1) return jsonify({ list: [] });

    const [type, tmdbid] = id.split('_');
    const url = `${API_BASE_URL}/api/resource?type=${type}&tmdbid=${tmdbid}`;
    log(`[detail] 请求URL: ${url}`);

    try {
        const data = await fetchData(url);
        
        // 准备播放列表字符串
        let playUrl = "";
        let displayTitle = "未知资源";

        // 安全地处理返回数据
        if (data && data['115'] && Array.isArray(data['115']) && data['115'].length > 0) {
            // 尝试用第一个文件的标题作为详情页标题
            displayTitle = data['115'][0].title || displayTitle;

            playUrl = data['115'].map(item => {
                const name = item.title || '未知文件名';
                const size = item.size ? `[${item.size}]` : '';
                const link = item.share_link;
                return `${name} ${size}$${link}`;
            }).join('#');
        }

        // ★★★ 关键修复：必须构建完整的vod对象 ★★★
        return jsonify({
            list: [{
                vod_id: id, // 【必须】原样返回ID，否则UI会转圈
                vod_name: displayTitle,
                vod_pic: "", // 接口未返回图片，留空使用默认或上一级缓存
                type_name: "115网盘",
                vod_year: "",
                vod_area: "",
                vod_remarks: data['115'] ? `共${data['115'].length}个文件` : "",
                vod_actor: "",
                vod_director: "",
                vod_content: "资源由Nullbr提供。请点击下方选集播放。若无法播放请检查115账号状态。",
                vod_play_from: "115",
                vod_play_url: playUrl
            }]
        });
    } catch (err) {
        // 出错时也要返回一个空的结构，避免死循环
        log(`[detail] 发生错误: ${err.message}`);
        return jsonify({
            list: [{
                vod_id: id,
                vod_name: "加载失败",
                vod_content: `加载错误: ${err.message}`,
                vod_play_from: "115",
                vod_play_url: ""
            }]
        });
    }
}

// 4. 播放 (全新实现)
async function play(flag, id, flags) {
    log(`[play] 请求播放, flag: ${flag}, id: ${id}`);
    // 直接将网盘链接返回给App
    return jsonify({
        parse: 0,
        url: id
    });
}

// =======================================================================
// --- 辅助函数区 ---
// =======================================================================

// 统一解析ext参数
function parseExt(ext) {
    try {
        const extObj = typeof ext === 'string' ?
        JSON.parse(ext) : ext;
        const { id, pg, page: page_alt, text } = extObj.ext || extObj || {};
        return {
            id: id ||
            (extObj.class && extObj.class.length > 0 ? extObj.class[0].ext.id : CATEGORIES[0].ext.id),
            page: pg ||
            page_alt || 1,
            text: text ||
            ""
        };
    } catch (e) {
        return { id: CATEGORIES[0].ext.id, page: 1, text: "" };
    }
}

// 统一请求数据
async function fetchData(url) {
    const response = await $fetch.get(url);
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!data) throw new Error("后端未返回有效数据");
    return data;
}

// 统一格式化卡片
function formatCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => ({
        vod_id: `${item.media_type}_${item.tmdbid}`,
        vod_name: item.title || '未命名',
        vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
        vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0, 4) : '')
    }));
}

// 统一错误处理
function handleError(err) {
    log(`请求失败: ${err.message}`);
    return jsonify({ list: [] });
}
