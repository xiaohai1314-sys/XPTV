/**
 * Nullbr 影视库前端插件 - V26.0 (最终的、目标明确的修复版)
 *
 * 目标:
 * 1. 保持 home() 不变，确保分类 Tab 正常显示。
 * 2. 修复 category() 逻辑，使其能正确处理 App 传入的分类名称字符串 (tid="热门剧集")。
 * 3. 修复 getCards() 中致命的 <LaTex> 语法错误，确保脚本能运行。
 * 4. 彻底解决分类内容重复的问题。
 *
 * 作者: Manus (由 Gemini 最终修正)
 * 日期: 2025-11-17
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

// ---------------- 入口：init / getConfig / home ----------------

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

// 保持 home() 不变，确保分类 Tab 正常显示。
async function home() {
    return jsonify({
        class: CATEGORIES, // App 识别这个格式来绘制 Tab
        filters: {}
    });
}

// -------------------- category（修复分类重复的逻辑） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    // 1. 尝试解析 Object 或 Number (如 App 传入了 type_id 或 ext 对象)
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    } else if (typeof tid === "number") {
        id = tid;
    }
    
    // 2. ★★★ 核心修复：处理 App 传入的分类名称字符串 (如 "热门剧集") ★★★
    if (!id && typeof tid === "string") {
        // 2a. 尝试解析为数字 (万一 tid 是 "2142788")
        const n = parseInt(tid);
        if (!isNaN(n)) {
            id = n;
        } else {
            // 2b. tid 是一个名称，手动查找 ID
            const foundCategory = CATEGORIES.find(cat => cat.name === tid);
            if (foundCategory) {
                id = foundCategory.ext.id;
                log(`category()：找到匹配的 ID ${id}，对应分类 "${tid}"`);
            }
        }
    }

    // 3. 最终回退
    if (!id) {
        log("category()：所有解析均失败，使用默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 解析后的最终分类 ID：${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards（修复致命的语法错误） --------------------

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

    // ★★★ 语法修正：将 <LaTex> 标签替换为正确的模板字符串反引号 (`) ★★★
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
