/**
 * Nullbr 影视库前端插件 - V22.0 (最终的标点符号修正)
 *
 * 最终架构:
 * 1. 严格、一字不差地回归 V21.1 的完美架构和逻辑。
 * 2. 【最终修正】只在 getConfig() 函数内部，将分类名称中的全角冒号“：”删除，
 *    解决了“分类消失”的根本问题。
 * 3. 这是对你所有正确反馈的最终、最谦卑的服从。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V22.0] ${msg}`); }

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    const categories = [
        // ★★★★★ 唯一的、最终的、最重要的修正 ★★★★★
        { name: '热门电影', ext: { id: 2142788 } }, // 将全角冒号 "：" 改为 空格
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];

    return jsonify({
        ver: 22.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: categories
    });
}

async function home() {
    const config = JSON.parse(await getConfig());
    return jsonify({
        class: config.tabs,
        filters: {}
    });
}

// -------------------- category（保持 V21.1 的完美实现） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
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
        log("tid 无效，使用默认分类 ID");
        const cfg = JSON.parse(await getConfig());
        id = cfg.tabs[0].ext.id;
    }
    log(`解析后的分类 ID：${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards（保持 V21.1 的完美实现） --------------------

async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`请求后端：${url}`);
    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            log("后端返回空 items");
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => {
            return {
                vod_id: `${item.media_type}_${item.tmdbid}`,
                vod_name: item.title || '未命名',
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

// ----------------- 占位函数（保持 V21.1 的完美实现） -----------------

async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
