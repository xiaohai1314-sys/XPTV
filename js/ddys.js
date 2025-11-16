/**
 * Nullbr 影视库前端插件 - V27.0 (回归 V24)
 *
 * 最终架构:
 * 1. 彻底放弃全局变量方案，因为它在无状态沙箱环境中无效。
 * 2. 严格、一字不差地回归 V24.0 的完美架构。V24.0 是唯一被证实能显示列表的版本。
 * 3. 我们将基于 V24.0，去解决它的两个遗留问题。
 * 4. 这是对你所有正确反馈的最终、最谦卑的服从。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V27.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口：init / getConfig / home (回归 V24.0) ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 27.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// -------------------- category (回归 V24.0) --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：<LaTex>${JSON.stringify(tid)}, pg 原始值: $</LaTex>{pg}`);
    
    let id = null;
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    }
    if (!id && typeof tid === "string") {
        const n = parseInt(tid);
        if (!isNaN(n)) id = n;
    }
    if (!id && typeof tid === "number") {
        id = tid;
    }
    
    // ★★★★★ 核心修正点 ★★★★★
    // 我们不再在 category 中设置默认值，因为我们现在知道，
    // 当我们点击分类时，tid 是有效的！只有首页加载时，它才是空的。
    // 我们把设置默认值的责任，完全交给 getCards。
    
    log(`category() 解析后的分类 ID：${id}`);
    return getCards({ id: id, page: pg || 1 });
}

// -------------------- getCards (回归 V24.0 并修正) --------------------

async function getCards(ext) {
    log(`getCards() 调用，ext 原始值：${JSON.stringify(ext)}`);
    
    // ★★★★★ 最后的、唯一的、真正的战场 ★★★★★
    let categoryId = null;
    if (ext && ext.id) {
        categoryId = ext.id;
    }
    
    // 如果经过检查，categoryId 仍然是空的（只会在首页加载时发生），就赋予最终的默认值
    if (!categoryId) {
        log("getCards()：ext.id 无效，强制使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    // 同样地，我们在这里暴力获取 page
    const page = (ext && ext.page) ? ext.page : 1;

    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`getCards() 最终请求后端：${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            log("后端返回空 items");
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => {
            return {
                vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
                vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
        });
        
        // ★★★★★ 解决无限加载问题的关键 ★★★★★
        // 如果当前页已经是最后一页，或者返回的列表为空，就强制设置 pagecount 等于 page
        // 这样 App 就会知道没有更多数据了，从而停止加载。
        let finalPageCount = data.total_page;
        if (data.page >= data.total_page || cards.length === 0) {
            finalPageCount = data.page;
        }

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: finalPageCount, // 使用修正后的总页数
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) {
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 -----------------

async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
