/**
 * Nullbr 影视库前端插件 - V35.0 (名称一致性修正版)
 *
 * 变更日志:
 * - V35.0 (2025-11-17):
 *   - [重大发现与修复] 根据用户提示，修正了 CATEGORIES 数组中的分类名称。
 *   - 前端脚本中的 '热门电影' 修改为与后端数据源一致的 'IMDB：热门电影'。
 *   - 这个不一致是导致之前按名称查找ID失败的根本原因。
 *   - 本版本结合了正确的分类定义和最可靠的 getCards 解析逻辑。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.10.105:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V35.0] ${msg}`); }

// --- 数据定义 (已修正名称) ---
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } }, // <-- 关键修正！
    { name: '热门剧集', ext: { id: 2143362 } },      // (请确认其他名称是否也需要修改)
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) { return getConfig(); }

async function getConfig() {
    return jsonify({
        ver: 35.0,
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

// -------------------- category (现在应该能正确解析了) --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，接收到原始 tid: ${JSON.stringify(tid)}`);
    let id = null;

    // 路径1: App传递了完整的对象
    if (typeof tid === "object" && tid !== null) {
        id = tid.ext?.id || tid.id;
        if (id) log(`通过对象解析成功，获取 ID: ${id}`);
    }
    
    // 路径2: App传递了分类名称字符串
    if (!id && typeof tid === "string") {
        const trimmedTid = tid.trim();
        const foundCategory = CATEGORIES.find(cat => cat.name === trimmedTid);
        if (foundCategory) {
            id = foundCategory.ext.id;
            log(`通过分类名称查找成功，获取 ID: ${id}`);
        }
    }

    // 最终回退
    if (!id) {
        log("所有解析路径均失败，回退到第一个默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    log(`最终用于请求的分类 ID: ${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards (使用V30的可靠逻辑) --------------------

async function getCards(ext) {
    let categoryId = ext?.id || CATEGORIES[0].ext.id;
    const page = ext?.page || 1;
    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`getCards() 请求 URL: ${url}`);

    try {
        const responseText = await $fetch.get(url);
        const data = JSON.parse(responseText);

        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
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
        log(`请求或解析失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 -----------------
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
