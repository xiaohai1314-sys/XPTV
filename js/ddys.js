/**
 * Nullbr 影视库前端插件 - V60.3 (兼容性增强 · 原版结构保留)
 *
 * 说明：
 * - 完整保留你原版的大部分结构与字段（tabs/class/搜索/分页锁等）
 * - 对 category() 做了鲁棒处理：兼容 tid 为 string / object / array 三种情况
 * - detail() 仍然返回 Null 前端可识别的 urls 格式（115 网盘）
 * - 增加更多日志，方便你在 App 控制台快速定位问题
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60.3] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// 分页锁
let END_LOCK = {};

// --- 入口 ---
async function init(ext) {
    END_LOCK = {};
    return jsonify({});
}

// getConfig: 返回 tabs（保留）
async function getConfig() {
    return jsonify({
        ver: 60.3,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// home: 返回 class（保留）
async function home() {
    return jsonify({ class: CATEGORIES, filters: {} });
}

/*
  category() 必须严格兼容三种常见调用方式：
  1) category(tidString, pg, filter, ext)          -> tidString = 'hot_movie'
  2) category(extObject, pg, filter, ext)         -> extObject = { ext: { id: 'hot_movie', page: 1 } }
  3) category([{...}], pg, filter, ext) (数组)    -> sometimes tabs传数组
  返回值必须和 getCards() 一致：{ list: [...], page, pagecount, limit?, total? }
*/
async function category(tid, pg, filter, ext) {
    log(`[category] called with tid=${JSON.stringify(tid)}, pg=${pg}`);
    // 先尝试从 tid 中解析出 id 和 page
    try {
        let id = null;
        let page = 1;

        // 情形 A: tid 是字符串 id
        if (typeof tid === 'string' && tid.trim().length > 0) {
            id = tid;
            page = pg || 1;
        }

        // 情形 B: tid 是对象，可能包含 ext 或 class 字段
        else if (typeof tid === 'object' && tid !== null) {
            // tid 可能为 { ext: { id:, page: } } 或 { class: [...] }
            if (Array.isArray(tid)) {
                // 传进来的是数组，取第一个元素的 ext.id
                const first = tid[0] || {};
                if (first.ext && first.ext.id) id = first.ext.id;
            } else {
                if (tid.ext && (tid.ext.id || tid.ext.page)) {
                    id = tid.ext.id || (tid.ext.class && tid.ext.class[0] && tid.ext.class[0].ext && tid.ext.class[0].ext.id);
                    page = tid.ext.pg || tid.ext.page || pg || 1;
                }
                // 有时直接传 { class: [...] }
                if (!id && tid.class && Array.isArray(tid.class) && tid.class.length > 0) {
                    id = tid.class[0].ext && tid.class[0].ext.id;
                }
                // 有时 tid 本身是一个 tab 对象 { name, ext: {id}}
                if (!id && tid.ext && tid.ext.id) {
                    id = tid.ext.id;
                    page = pg || 1;
                }
            }
        }

        // 情形 C: ext 参数里可能包含目标（作为备选）
        if (!id && ext) {
            try {
                const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
                if (extObj && extObj.ext && extObj.ext.id) {
                    id = extObj.ext.id;
                    page = extObj.ext.pg || extObj.ext.page || page;
                }
            } catch (e) {
                // ignore
            }
        }

        // 最后兜底：使用默认分类
        if (!id) {
            id = CATEGORIES[0].ext.id;
            page = pg || 1;
            log(`[category] 未能解析 id，使用默认 id=${id}`);
        }

        // 调用 getCards 获取实际数据
        return await getCards({ ext: { id: id, pg: page } });
    } catch (e) {
        log(`[category] 解析异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// =======================================================================
// getCards（分类/列表真实请求）
async function getCards(ext) {
    const { id, page } = parseExt(ext);
    const lockKey = `cat_${id}`;

    if (END_LOCK[lockKey] && page > 1) {
        return jsonify({ list: [], page, pagecount: page });
    }
    if (page === 1) delete END_LOCK[lockKey];

    const url = `${API_BASE_URL}/api/list?id=${id}&page=${page}`;
    log(`[getCards] URL=${url}`);

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items || []);

        if ((data.items || []).length < 30) END_LOCK[lockKey] = true;

        return jsonify({
            list: cards,
            page: data.page || page,
            pagecount: END_LOCK[lockKey] ? (data.page || page) : ((data.page || page) + 1),
            limit: cards.length,
            total: data.total_items || 0
        });
    } catch (err) {
        return handleError(err);
    }
}

// 搜索（保持原版逻辑）
async function search(ext) {
    const { text: keyword, page } = parseExt(ext);
    if (!keyword) return jsonify({ list: [] });

    const lockKey = `search_${keyword}`;
    if (END_LOCK[lockKey] && page > 1) return jsonify({ list: [], page, pagecount: page });
    if (page === 1) delete END_LOCK[lockKey];

    const url = `${API_BASE_URL}/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    log(`[search] URL=${url}`);

    try {
        const data = await fetchData(url);
        const cards = formatCards(data.items || []);
        if ((data.items || []).length < 30) END_LOCK[lockKey] = true;

        return jsonify({
            list: cards,
            page: data.page || page,
            pagecount: END_LOCK[lockKey] ? (data.page || page) : ((data.page || page) + 1),
            limit: cards.length,
            total: data.total_results || 0
        });
    } catch (err) {
        return handleError(err);
    }
}

// detail()：返回 Null 前端能识别的 urls 格式
async function detail(id) {
    log(`[detail] id=${id}`);
    if (!id || id.indexOf('_') === -1) return jsonify({ list: [] });

    const [type, tmdbid] = id.split('_');
    const url = `${API_BASE_URL}/api/resource?type=${type}&tmdbid=${tmdbid}`;
    log(`[detail] URL=${url}`);

    try {
        const data = await fetchData(url);
        if (!data || !Array.isArray(data['115'])) return jsonify({ list: [] });

        const urls = data['115'].map(item => ({
            name: `${item.title} (${item.size || '未知'})`,
            url: item.share_link
        }));

        return jsonify({
            list: [
                {
                    name: "115网盘",
                    flag: "115",
                    urls: urls
                }
            ]
        });
    } catch (err) {
        return handleError(err);
    }
}

// play(): 直接返回 id（通常是 share link）
async function play(flag, id, flags) {
    log(`[play] flag=${flag} id=${id}`);
    return jsonify({ parse: 0, url: id });
}

// -------------------- 辅助 --------------------
function parseExt(ext) {
    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id, pg, page: page_alt, text } = (extObj && (extObj.ext || extObj)) || {};
        return {
            id: id || (extObj && extObj.class && extObj.class.length > 0 ? extObj.class[0].ext.id : CATEGORIES[0].ext.id),
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
    return items.map(item => ({
        vod_id: `${item.media_type}_${item.tmdbid}`,
        vod_name: item.title || '未命名',
        vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
        vod_remarks: item.overview || (item.release_date ? item.release_date.substring(0,4) : '')
    }));
}

function handleError(err) {
    log(`请求失败: ${err && err.message ? err.message : JSON.stringify(err)}`);
    return jsonify({ list: [] });
}
