/**
 * Nullbr 影视库前端插件 - V54.0 (100%复刻观影模式最终版)
 *
 * 变更日志:
 * - V54.0 (2025-11-17):
 *   - [终极顿悟] 彻底放弃所有自创逻辑，100%复刻“观影网”的成功模式。
 *   - [废弃category] 确认category函数是所有问题的根源，将其废弃。
 *   - [getCards为唯一入口] getCards成为唯一的列表函数，直接接收App传递的ext参数。
 *   - [绝对信任ext] 在getCards内部，严格模仿“观影网”，使用解构赋值从ext中提取占位符ID。
 *   - 这是对成功案例最忠实、最谦卑的模仿，也是我们最后的希望。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V54.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 54.0, title: 'Nullbr影视库 (V54)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★★★【废弃 category 函数，让 App 直接调用 getCards】★★★★★
async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，不应被调用！");
    return jsonify({ list: [] });
}

// ★★★★★【这是唯一的、100%复刻了“观影网”模式的终极 getCards 函数】★★★★★
async function getCards(ext) {
    log(`getCards() 作为唯一入口被调用，ext: ${JSON.stringify(ext)}`);
    
    // --- 步骤1: 严格模仿“观影网”，从ext中提取ID和页码 ---
    // 我们假设App会将 { name: '...', ext: { id: '...' } } 整个对象作为ext传进来
    // 或者只把 ext 字段的内容 { id: '...' } 传进来
    let placeholderId = null;
    let page = 1;

    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        
        // 使用解构赋值，并提供默认值，这是最健壮的方式
        const { id, pg } = extObj.ext || extObj;
        
        placeholderId = id || CATEGORIES[0].ext.id;
        page = pg || ext.page || 1;

        log(`解构赋值成功！占位符ID: ${placeholderId}, 页码: ${page}`);

    } catch (e) {
        log(`解析ext失败，回退到默认ID。错误: ${e.message}`);
        placeholderId = CATEGORIES[0].ext.id;
    }

    // --- 步骤2: 拼接URL并请求 (后端V2.8负责置换) ---
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
        return jsonify({ list: cards, page: data.page, pagecount: data.total_page, limit: cards.length, total: data.total_items });
    } catch (err) {
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
