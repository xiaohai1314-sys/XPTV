/**
 * Nullbr 影视库前端插件 - V51.0 (绝对字符串ID最终版)
 *
 * 变更日志:
 * - V51.0 (2025-11-17):
 *   - [终极顿悟] 严格遵循用户指引，确认问题的唯一根源是App的JS引擎无法处理数字类型变量。
 *   - [模仿观影网] 严格模仿“观影网”模式，将所有分类ID从定义开始就改为字符串类型。
 *   - [根除诅咒] 通过使用字符串ID，彻底避免了“数字诅咒”导致的变量丢失或变为undefined的问题。
 *   - [结构回归] 回归到V50被证明结构最合理的 category -> getCards 模式。
 *   - 这是我们模仿成功案例、解决根本性BUG的最终、最合理的版本。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V51.0] ${msg}`); }

// ★★★★★【这是本次修复的绝对核心：将所有ID定义为字符串！】★★★★★
const CATEGORIES = [
    { name: '热门电影', ext: { id: '2142788' } }, // ID是字符串
    { name: '热门剧集', ext: { id: '2143362' } }, // ID是字符串
    { name: '高分电影', ext: { id: '2142753' } }, // ID是字符串
    { name: '高分剧集', ext: { id: '2143363' } }, // ID是字符串
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 51.0, title: 'Nullbr影视库 (V51)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★ 使用V50中逻辑最清晰的category函数，它现在将处理字符串ID ★★★
async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    if (typeof tid === "object" && tid !== null) {
        if (tid.ext?.id) {
            id = tid.ext.id;
            log(`category()：从 tid.ext.id 获取成功，ID=${id}`);
        } else if (tid.id) {
            id = tid.id;
            log(`category()：从 tid.id 获取成功，ID=${id}`);
        }
    }

    if (!id && typeof tid === "string") {
        const name = tid.trim();
        const found = CATEGORIES.find(c => c.name === name);
        if (found) {
            id = found.ext.id;
            log(`category()：名称匹配成功，ID=${id}`);
        }
    }

    if (!id) {
        id = CATEGORIES[0].ext.id; // 回退时，获取的也是字符串ID
        log(`category()：所有解析失败，使用默认 ID=${id}`);
    }

    log(`category() 最终 ID=${id} (类型: ${typeof id})`);
    return getCards({ id, page: pg || 1 });
}

// ★★★ 使用V27的getCards函数，它现在将接收并拼接字符串ID ★★★
async function getCards(ext) {
    log(`getCards() 调用，ext 原始值：${JSON.stringify(ext)}`);
    
    let categoryId = null;
    if (typeof ext === "object" && ext !== null && ext.id) {
        categoryId = ext.id; // categoryId 现在是一个字符串
    }
    
    if (!categoryId) {
        categoryId = CATEGORIES[0].ext.id; // 回退时，获取的也是字符串ID
    }

    const page = (ext && ext.page) ? ext.page : 1;

    // 因为categoryId已经是字符串，所以拼接时不会再有类型转换的BUG
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
