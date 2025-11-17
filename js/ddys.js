/**
 * Nullbr 影视库前端插件 - V50.0 (用户核心最终版)
 *
 * 变更日志:
 * - V50.0 (2025-11-17):
 *   - [最终顿悟] 完全采纳用户提供的、逻辑完美的category函数，它揭示了所有问题的根源。
 *   - [核心替换] 将用户提供的category函数作为本版本的绝对核心。
 *   - [结构回归] 回归到V27被证明可行的 category -> getCards 的函数分离结构。
 *   - [忠实执行] getCards函数完全沿用V27的实现，因为它本身没有错误。
 *   - 这份代码是对用户正确思想的最终、最忠实的执行。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V50.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 50.0, title: 'Nullbr影视库 (V50)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★★★【这是你提供的、完全正确的、作为本版本核心的 category 函数】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    // --- 1. 如果是对象且带 ext.id (最关键的正确路径)
    if (typeof tid === "object" && tid !== null) {
        if (tid.ext?.id) {
            id = tid.ext.id;
            log(`category()：从 tid.ext.id 获取成功，ID=${id}`);
        } else if (tid.id) {
            id = tid.id;
            log(`category()：从 tid.id 获取成功，ID=${id}`);
        }
    }

    // --- 2. 字符串：处理非标准情况
    if (!id && typeof tid === "string") {
        const name = tid.trim();
        log(`category()：接收到字符串，清理后为="${name}"`);

        const n = parseInt(name);
        if (!isNaN(n)) {
            id = n;
            log(`category()：字符串为数字，命中 ID=${id}`);
        } else {
            const found = CATEGORIES.find(c => c.name === name);
            if (found) {
                id = found.ext.id;
                log(`category()：名称匹配成功，ID=${id}`);
            }
        }
    }

    // --- 3. 兜底：确保ID不为空
    if (!id) {
        id = CATEGORIES[0].ext.id;
        log(`category()：所有解析失败，使用默认 ID=${id}`);
    }

    log(`category() 最终 ID=${id}`);
    return getCards({ id, page: pg || 1 });
}

// ★★★★★【完全沿用V27中被证明本身没有错误的 getCards 函数】★★★★★
async function getCards(ext) {
    log(`getCards() 调用，ext 原始值：${JSON.stringify(ext)}`);
    
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id;
    }
    
    if (!categoryId) {
        log("getCards()：ext.id 无效，强制使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = (ext && ext.page) ? ext.page : 1;

    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`getCards() 最终请求后端：${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));
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

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
