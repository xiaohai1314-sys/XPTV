/**
 * Nullbr 影视库前端插件 - V53.0 (绝对信任ext终极版)
 *
 * 变更日志:
 * - V53.0 (2025-11-17):
 *   - [终极顿悟] 接受用户反馈，确认V52的category函数ID解析依然失败。
 *   - [放弃tid] 彻底放弃解析不可靠的tid参数，将所有希望寄托在App环境标准的ext参数上。
 *   - [简化category] category函数的核心逻辑简化为只从ext参数中提取占位符ID。
 *   - 这是我们能做的、最符合插件开发规范的、最后的、最合理的尝试。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V53.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 53.0, title: 'Nullbr影视库 (V53)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★★★【这是本次修复的绝对核心：一个只信任ext参数的category函数】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 调用，ext 原始值：${JSON.stringify(ext)}`);
    let id = null;

    // 核心逻辑：只相信 ext 参数，并从中解析ID
    try {
        // ext 可能是字符串，也可能是对象，做健壮性处理
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        
        // App通常会把 { name: '...', ext: { id: '...' } } 整个对象作为ext传进来
        if (extObj && extObj.ext && extObj.ext.id) {
            id = extObj.ext.id;
            log(`从 ext.ext.id 中成功解析出占位符ID: ${id}`);
        } 
        // 某些App可能只把 ext 字段的内容传进来
        else if (extObj && extObj.id) {
            id = extObj.id;
            log(`从 ext.id 中成功解析出占位符ID: ${id}`);
        }
    } catch (e) {
        log(`解析ext参数失败: ${e.message}`);
    }

    // 如果从ext中解析失败，则执行回退
    if (!id) {
        id = CATEGORIES[0].ext.id;
        log(`从ext解析ID失败，回退到默认占位符ID: ${id}`);
    }

    // 调用我们那个本身没有问题的getCards函数
    return getCards({ id, page: pg || 1 });
}

// ★★★ getCards函数保持不变，它只负责接收一个占位符ID并发起请求 ★★★
async function getCards(ext) {
    let categoryId = (ext && ext.id) ? ext.id : CATEGORIES[0].ext.id;
    const page = (ext && ext.page) ? ext.page : 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`getCards() 最终请求后端：${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) { return jsonify({ list: [] }); }
        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));
        return jsonify({ list: cards, page: data.page, pagecount: data.total_page, limit: cards.length, total: data.total_items });
    } catch (err) {
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
