/**
 * Nullbr 影视库前端插件 - V46.0 (V27成功原理终极版)
 *
 * 变更日志:
 * - V46.0 (2025-11-17):
 *   - [终极顿悟] 严格反推V27成功原理，确认问题在于JS对象在函数间传递时属性丢失。
 *   - [合并函数] 彻底废弃 getCards 函数，将其逻辑与 category 函数合并。
 *   - [单一函数原则] 在 category 函数内部完成ID解析、URL拼接、网络请求所有操作，避免跨函数传递变量。
 *   - [保留V27精华] 严格使用V27中被证明可行的模板字符串和查询参数URL格式。
 *   - 这是基于“意外成功”案例反推出的、最符合环境特性的最终解决方案。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V46.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

const NAME_LOOKUP = {
    'IMDB：热门电影': 2142788, 'IMDB：热门剧集': 2143362,
    'IMDB：高分电影': 2142753, 'IMDB：高分剧集': 2143363
};

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 46.0, title: 'Nullbr影视库 (V46)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★★★【这是本次的唯一核心：合并了getCards的终极category函数】★★★★★
async function category(tid, pg, filter, ext) {
    log("category() 开始执行，tid: " + JSON.stringify(tid));
    
    // --- 步骤1: 在本函数内完成所有ID解析 ---
    let categoryId = null;
    const page = pg || 1;

    if (typeof tid === "object" && tid !== null) {
        if (tid.id) categoryId = tid.id;
        else if (tid.ext && tid.ext.id) categoryId = tid.ext.id;
    } else if (typeof tid === "number") {
        categoryId = tid;
    }
    
    if (!categoryId && typeof tid === "string") {
        const trimmedTid = tid.trim();
        const n = parseInt(trimmedTid);
        if (!isNaN(n)) {
            categoryId = n;
        } else {
            let found = false;
            for (let i = 0; i < CATEGORIES.length; i++) {
                if (CATEGORIES[i].name === trimmedTid) {
                    categoryId = CATEGORIES[i].ext.id;
                    found = true;
                    break;
                }
            }
            if (!found && NAME_LOOKUP[trimmedTid]) {
                categoryId = NAME_LOOKUP[trimmedTid];
            }
        }
    }

    if (!categoryId) {
        log("category()：ID解析失败，回退到默认ID");
        categoryId = CATEGORIES[0].ext.id;
    }
    log(`category()：最终解析ID为: ${categoryId}`);

    // --- 步骤2: 在本函数内完成URL拼接 (严格使用V27的模板字符串) ---
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`category()：最终请求URL为: ${url}`);

    // --- 步骤3: 在本函数内完成网络请求和数据处理 ---
    try {
        const response = await $fetch.get(url);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));
        return jsonify({ list: cards, page: data.page, pagecount: data.total_page, limit: cards.length, total: data.total_items });
    } catch (err) {
        log(`category() 请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【废弃 getCards 函数，避免任何跨函数传参】★★★★★
async function getCards(ext) {
    log("getCards() 已被废弃，不应被调用");
    return jsonify({ list: [] });
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
