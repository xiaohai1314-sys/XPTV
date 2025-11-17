/**
 * Nullbr 影视库前端插件 - V47.0 (V27原理终极修复版)
 *
 * 变更日志:
 * - V47.0 (2025-11-17):
 *   - [最终顿悟] 严格遵循用户指引，确认V27的getCards()函数本身无错，问题仅在于category()的ID解析永远失败。
 *   - [欺骗性修复] 放弃解析不可靠的tid参数。在home()中，将ID预先嵌入到name字段。
 *   - [重写category] category()函数的核心逻辑改为从tid.name中用正则表达式提取ID，这是最可靠的方式。
 *   - [保留V27结构] 完全保留V27的函数结构和被证明可行的getCards()函数。
 *   - 这是利用V27“成功”原理，并将其扩展到所有分类的最终、最合理的方案。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V47.0] ${msg}`); }

// ★★★ 核心技巧1: 在定义时，就把ID藏在name里，用特殊标记包围 ★★★
const CATEGORIES = [
    { name: '热门电影#ID:2142788#', ext: { id: 2142788 } },
    { name: '热门剧集#ID:2143362#', ext: { id: 2143362 } },
    { name: '高分电影#ID:2142753#', ext: { id: 2142753 } },
    { name: '高分剧集#ID:2143363#', ext: { id: 2143363 } },
];

// ---------------- 入口函数 ----------------

async function init(ext) { return getConfig(); }

async function getConfig() {
    return jsonify({
        ver: 47.0,
        title: 'Nullbr影视库 (V47)',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    // App会显示完整的name，包括隐藏的ID，但这没关系，功能第一
    return jsonify({
        class: CATEGORIES, 
        filters: {}
    });
}

// ★★★★★【这是本次的唯一核心：一个只从name里提取ID的category函数】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 收到原始 tid: ${JSON.stringify(tid)}`);
    let id = null;

    // 核心逻辑：只相信 tid.name，并从中提取ID
    if (tid && typeof tid === 'object' && tid.name) {
        log(`尝试从 tid.name "${tid.name}" 中提取ID...`);
        const match = tid.name.match(/#ID:(\d+)#/);
        if (match && match[1]) {
            id = parseInt(match[1]);
            log(`ID提取成功 -> ${id}`);
        }
    }

    // 如果提取失败，执行V27的回退逻辑
    if (!id) {
        log("ID提取失败，回退到默认ID");
        id = CATEGORIES[0].ext.id;
    }

    // ★★★ 调用那个被证明本身没问题的 getCards 函数 ★★★
    return getCards({ id: id, page: pg || 1 });
}

// ★★★★★【完全使用V27中被证明可行的 getCards 函数，不做任何修改】★★★★★
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
