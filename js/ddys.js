/**
 * Nullbr 影视库前端插件 - V29.0 (数据解析修正版)
 *
 * 变更日志:
 * - V29.0 (2025-11-17):
 *   - [核心修复] 修正 getCards() 中对后端返回数据的解析逻辑。
 *   - 后端 API 直接返回数据对象，而非包装在 .data 属性中。
 *   - 代码现在直接处理 $fetch.get() 的响应体，解决了列表为空的问题。
 * - V28.0:
 *   - 重构 category() 函数，正确处理 App 传入的分类对象。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V29.0] ${msg}`); }

// --- 数据定义 ---
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) {
    log("插件初始化...");
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 29.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    log("加载首页...");
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// -------------------- category (逻辑正确) --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，接收到原始 tid: ${JSON.stringify(tid)}`);
    let id = null;

    if (typeof tid === "object" && tid !== null) {
        id = tid.ext?.id || tid.id;
        if (id) log(`通过对象解析成功，获取 ID: ${id}`);
    }
    
    if (!id && typeof tid === "string") {
        log("对象解析失败，尝试作为字符串处理...");
        const trimmedTid = tid.trim();
        const n = parseInt(trimmedTid);
        if (!isNaN(n)) {
            id = n;
            log(`通过数字字符串解析成功，获取 ID: ${id}`);
        } else {
            const foundCategory = CATEGORIES.find(cat => cat.name === trimmedTid);
            if (foundCategory) {
                id = foundCategory.ext.id;
                log(`通过分类名称查找成功，获取 ID: ${id}`);
            }
        }
    }

    if (!id) {
        log("所有解析路径均失败，回退到第一个默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    log(`最终用于请求的分类 ID: ${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards (已修复数据解析逻辑) --------------------

async function getCards(ext) {
    log(`getCards() 调用，接收到 ext: ${JSON.stringify(ext)}`);
    
    let categoryId = ext?.id;
    if (!categoryId) {
        log("getCards()：ext.id 无效，强制使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = ext?.page || 1;
    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`getCards() 最终请求后端 URL: ${url}`);

    try {
        // 【核心修正】后端直接返回数据对象，我们直接使用它
        const data = await $fetch.get(url); 

        if (typeof data !== 'object' || data === null || !Array.isArray(data.items)) {
            log(`后端返回的数据格式不正确或 items 数组为空。收到的数据: ${JSON.stringify(data)}`);
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
        log(`请求后端 API 失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 (待实现) -----------------

async function detail(id) {
    log(`detail() 未实现，ID: ${id}`);
    return jsonify({ list: [] });
}

async function play(flag, id, flags) {
    log(`play() 未实现，ID: <LaTex>${id}, Flag: $</LaTex>{flag}`);
    return jsonify({ url: "" });
}

async function search(wd, quick) {
    log(`search() 未实现，关键词: ${wd}`);
    return jsonify({ list: [] });
}
