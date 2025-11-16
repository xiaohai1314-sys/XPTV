/**
 * Nullbr 影视库前端插件 - V26.0 (全局变量安全版)
 *
 * 最终架构:
 * 1. 严格捍卫 init/getConfig/home 的纯洁性，确保 Tab 显示。
 * 2. category() 负责解析参数并【更新】全局变量。
 * 3. getCards() 负责从全局变量【读取】数值并发起请求。
 * 4. 这是对抗 App 环境“黑魔法”的最终、最安全、也最可靠的方案。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V26.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ★★★★★【全局变量 - 对抗黑魔法的唯一武器】★★★★★
let currentCategoryId = null;
let currentPage = 1;

// ---------------- 入口：init / getConfig / home (誓死捍卫其纯洁性) ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 26.0,
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

// -------------------- category（唯一的“脏活”执行者） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：<LaTex>${JSON.stringify(tid)}, pg 原始值：$</LaTex>{pg}`);

    // ★★★★★ 使命一：解析参数 ★★★★★
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
    if (!id) {
        log("category()：tid 无效，使用默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    // ★★★★★ 使命二：更新全局变量 ★★★★★
    currentCategoryId = id;
    currentPage = pg || 1;

    log(`已更新全局变量：id=<LaTex>${currentCategoryId}, page=$</LaTex>{currentPage}`);
    
    // 调用 getCards，不传递任何参数
    return getCards();
}

// -------------------- getCards（绝对忠诚的执行者） --------------------

async function getCards(ext) { // ext 参数将被完全忽略
    log(`getCards() 调用，将使用全局变量发起请求`);
    
    // ★★★★★ getCards 的唯一信条：从全局变量取值 ★★★★★
    const categoryId = currentCategoryId;
    const page = currentPage;

    // 最后的保险，防止全局变量在某种极端情况下也是 null
    if (!categoryId) {
        log("getCards() 错误：全局变量 currentCategoryId 为空！");
        return jsonify({ list: [] });
    }

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
        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
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
