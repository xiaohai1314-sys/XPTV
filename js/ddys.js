/**
 * Nullbr 影视库前端插件 - V25.0 (最终逻辑修正版)
 *
 * 架构:
 * 1. 保持 V24.0 的 home() 不变，这能确保分类 Tab 正常显示。
 * 2. 【修复分类重复】修改 category() 函数，使其能够正确处理
 * 当 App 传入字符串名称 (如 "热门剧集") 作为 tid 的情况。
 * 3. 【修复语法崩溃】修正 V24.0 在 getCards() 中引入的 <LaTex> 语法错误。
 *
 * 作者: Manus (由 Gemini 修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V25.0] ${msg}`); }

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
        ver: 25.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// 保持 V24.0 的 home() 不变！这能让你的分类 Tab 正常显示
async function home() {
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// -------------------- category（★★★ 核心修复点 ★★★） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    // 1. 尝试解析 Object (如果 App 传入了 ext)
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    }
    
    // 2. 尝试解析 Number (如果 App 传入了 type_id)
    if (!id && typeof tid === "number") {
        id = tid;
    }

    // 3. ★★★ 修复：当 App 传入字符串名称 (如 "热门剧集") ★★★
    if (!id && typeof tid === "string") {
        // 3a. 尝试解析为数字 (万一 tid 是 "2142788")
        const n = parseInt(tid);
        if (!isNaN(n)) {
            id = n;
        } else {
            // 3b. tid 是一个名称，我们必须手动查找 ID
            log(`category()：tid 是字符串 "${tid}"，正在查找匹配的 ID...`);
            const foundCategory = CATEGORIES.find(cat => cat.name === tid);
            if (foundCategory) {
                id = foundCategory.ext.id;
                log(`category()：找到 ID ${id}`);
            }
        }
    }

    // 4. 最终回退
    if (!id) {
        log("category()：所有解析均失败，使用默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 解析后的分类 ID：${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards（★★★ 语法崩溃修复 ★★★） --------------------

async function getCards(ext) {
    log(`getCards() 调用，ext 原始值：${JSON.stringify(ext)}`);
    
    // V24.0 的防御性检查 (保留)
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        log("getCards()：ext.id 无效，强制使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = (ext && ext.page) ? ext.page : 1;

    // ★★★ 语法修正：使用反引号 (`)，而不是 <LaTex> ★★★
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
                // ★★★ 语法修正 ★★★
                vod_id: `${item.media_type}_${item.tmdbid}`,
                vod_name: item.title || '未命名',
                // ★★★ 语法修正 ★★★
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
