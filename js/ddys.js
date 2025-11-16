/**
 * Nullbr 影视库前端插件 - V24.1 (真正修复版)
 *
 * 架构:
 * 1. 修正 V24.0 中引入的致命 <LaTex> 语法错误，改用正确的模板字符串 (``)。
 * 2. 修正 home() 函数，使其返回带有 "type_id" 和 "type_name" 的标准 class 数组。
 * 这从根本上解决了 "所有分类都一样" 的问题。
 * 3. 保留 V24.0 在 getCards() 中的防御性检查，尽管问题已在 home() 中修复。
 *
 * 作者: Manus (由 Gemini 修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V24.1] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 24.1,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    // ★★★★★ 真正的修复点 ★★★★★
    // 将 CATEGORIES 数组转换为框架可以理解的、带有 type_id 的标准格式。
    // 这是解决“分类重复”问题的唯一正确方法。
    const classes = CATEGORIES.map(item => {
        return {
            "type_id": item.ext.id, // 明确指定 type_id
            "type_name": item.name
        };
    });

    return jsonify({
        class: classes, // 使用这个新的、正确的 classes 数组
        filters: {}
    });
}

// -------------------- category（保持 V21.1 的完美实现） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;
    
    // 因为 home() 现在返回了正确的 type_id，tid 会直接是一个数字
    // (例如 2142788, 2143362)
    
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    }
    if (!id && typeof tid === "string") {
        const n = parseInt(tid);
        if (!isNaN(n)) id = n;
    }
    if (!id && typeof tid === "number") {
        id = tid; // ★★★ tid (例如 2143362) 会在这里被正确捕获 ★★★
    }
    
    // 下面的 if (!id) 回退逻辑现在只会在极特殊情况下触发
    if (!id) {
        log("category()：tid 无效，使用默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }
    log(`category() 解析后的分类 ID：${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards（已修复语法错误） --------------------

async function getCards(ext) {
    log(`getCards() 调用，ext 原始值：${JSON.stringify(ext)}`);
    
    // (V24.0 的防御性检查，保留它)
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        log("getCards()：ext.id 无效，强制使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = (ext && ext.page) ? ext.page : 1;

    // ★★★★★ 语法修正 ★★★★★
    // 使用反引号 (`) 来创建模板字符串
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
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
                // ★★★★★ 语法修正 ★★★★★
                vod_id: `${item.media_type}_${item.tmdbid}`,
                vod_name: item.title || '未命名',
                // ★★★★★ 语法修正 ★★★★★
                vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
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
