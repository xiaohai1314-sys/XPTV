/**
 * Nullbr 影视库前端插件 - V58.0 (100%复刻观影分页最终版)
 *
 * 变更日志:
 * - V58.0 (2025-11-17):
 *   - [终极顿悟] 接受用户指引，确认分页问题在于未能100%复刻“观影网”从ext中提取页码的模式。
 *   - [100%复刻] getCards函数彻底放弃独立的pg参数，严格模仿“观影网”，只从唯一的ext参数中解构赋值来获取ID和页码。
 *   - [健壮解析] 使用最健壮的解构和默认值语法，确保即使ext结构不标准也能正常工作。
 *   - 这是对“观影网”成功模式最完整、最忠实的最终实现。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V58.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 58.0, title: 'Nullbr影视库 (V58)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★ 废弃的category函数 ★★★
async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，不应被调用！");
    return jsonify({ list: [] });
}

// ★★★★★【这是唯一的、100%复刻了“观影网”分页模式的终极 getCards 函数】★★★★★
// ★★★ 注意函数签名，我们只使用唯一的 ext 参数！ ★★★
async function getCards(ext) {
    log(`getCards() 作为唯一入口被调用，ext: ${JSON.stringify(ext)}`);
    
    // --- 步骤1: 严格模仿“观影网”，只从ext中提取所有信息 ---
    let placeholderId = null;
    let page = 1;

    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        
        // 核心：用解构赋值同时提取id和页码，并提供默认值
        // 我们假设App会把 { name: '...', ext: { id: '...', pg: 2 } } 整个对象作为ext传进来
        // 或者只把 ext 字段的内容 { id: '...', pg: 2 } 传进来
        // 我们同时兼容 pg 和 page 两种可能的页码字段名
        const { id, pg, page: page_alt } = extObj.ext || extObj || {};
        
        placeholderId = id || CATEGORIES[0].ext.id;
        page = pg || page_alt || 1;

        log(`解构赋值成功！占位符ID: ${placeholderId}, 页码: ${page}`);

    } catch (e) {
        log(`解析ext失败，回退到默认值。错误: ${e.message}`);
        placeholderId = CATEGORIES[0].ext.id;
        page = 1;
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

        // --- 步骤3: 标准化分页返回 ---
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
