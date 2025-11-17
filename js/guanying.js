/**
 * Nullbr 影视库前端插件 - V55.0 (完美分页最终版)
 *
 * 变更日志:
 * - V55.0 (2025-11-17):
 *   - [分页修复] 解决了App无限加载第一页的BUG。
 *   - [信任pg参数] 彻底放弃从ext对象中解析页码，改为绝对信任函数签名中独立的`pg`参数，这是更标准的做法。
 *   - [标准化返回] 确保每次返回给App的JSON中，都包含正确且标准的`page`, `pagecount`, `limit`, `total`字段。
 *   - 这是在V54成功基础上，实现完整分页功能的最终版本。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V55.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 55.0, title: 'Nullbr影视库 (V55)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★ 废弃的category函数，现在也把pg参数传递给getCards ★★★
async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，将调用转发给 getCards...");
    // 即使这个函数被意外调用，它也会把正确的页码传递下去
    return getCards(ext, pg);
}

// ★★★★★【这是唯一的、增加了完美分页逻辑的终极 getCards 函数】★★★★★
// ★★★ 注意函数签名，我们现在正式使用第二个参数 pg ★★★
async function getCards(ext, pg) {
    log(`getCards() 作为唯一入口被调用，ext: ${JSON.stringify(ext)}, pg: ${pg}`);
    
    // --- 步骤1: ID解析 (保持V54的成功逻辑) ---
    let placeholderId = null;
    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id } = extObj.ext || extObj;
        placeholderId = id || CATEGORIES[0].ext.id;
    } catch (e) {
        placeholderId = CATEGORIES[0].ext.id;
    }
    log(`占位符ID为: ${placeholderId}`);

    // --- 步骤2: 页码解析 (核心修复！) ---
    // 绝对信任函数签名中独立的 pg 参数。如果它不存在或为0，则默认为1。
    const page = pg > 0 ? pg : 1;
    log(`最终请求页码为: ${page}`);

    // --- 步骤3: 拼接URL并请求 ---
    const url = `${API_BASE_URL}/api/list?id=${placeholderId}&page=${page}`;
    log(`最终请求URL为: ${url}`);

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

        // --- 步骤4: 标准化分页返回 (核心修复！) ---
        // 确保返回给App完整且正确的分页信息
        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
            limit: data.items.length,
            total: data.total_items
        });

    } catch (err) {
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
