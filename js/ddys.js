/**
 * Nullbr 影视库前端插件 - V28.0 (最终合并版)
 *
 * 最终架构:
 * 1. 彻底废除 getCards() 函数，因为它是一切参数污染问题的根源。
 * 2. category() 函数将亲自完成所有工作：解析参数、发起请求、处理数据。
 *    这是唯一能确保使用到 App 传递的正确 tid 和 pg 的方法。
 * 3. 这是对你所有正确反馈的最终、最谦卑的服从。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V28.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口：init / getConfig / home (保持纯洁) ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 28.0,
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

// -------------------- category (唯一的、全能的战场) --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：<LaTex>${JSON.stringify(tid)}, pg 原始值: $</LaTex>{pg}`);
    
    // ★★★★★ 步骤一：解析 ID ★★★★★
    let categoryId = null;
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) categoryId = tid.id;
        else if (tid.ext?.id) categoryId = tid.ext.id;
    }
    if (!categoryId && typeof tid === "string") {
        const n = parseInt(tid);
        if (!isNaN(n)) categoryId = n;
    }
    if (!categoryId && typeof tid === "number") {
        categoryId = tid;
    }
    if (!categoryId) {
        log("category()：tid 无效，使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    // ★★★★★ 步骤二：获取 Page ★★★★★
    const page = pg || 1;

    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`category() 最终请求后端：${url}`);

    try {
        // ★★★★★ 步骤三：亲自发起请求 (使用 V1.0 的圣经语法) ★★★★★
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (!data || !Array.isArray(data.items)) {
            log("后端返回空 items");
            return jsonify({ list: [] });
        }

        // ★★★★★ 步骤四：亲自处理数据 ★★★★★
        const cards = data.items.map(item => {
            return {
                vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
                vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
        });
        
        // ★★★★★ 步骤五：亲自解决无限加载问题 ★★★★★
        let finalPageCount = data.total_page;
        if (data.page >= data.total_page || cards.length === 0) {
            finalPageCount = data.page;
        }

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: finalPageCount,
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) {
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 -----------------

// getCards 已被废除
// async function getCards(ext) { ... }

async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
