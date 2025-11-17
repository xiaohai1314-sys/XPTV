/**
 * Nullbr 影视库前端插件 - V48.0 (V27原理直接利用版)
 *
 * 变更日志:
 * - V48.0 (2025-11-17):
 *   - [终极顿悟] 严格遵循用户指引，确认V27的成功原理是在一个函数内部完成ID赋值和URL拼接。
 *   - [单函数原则] 彻底废弃 getCards 函数。category 函数将成为唯一的逻辑入口，直接负责网络请求。
 *   - [直接利用原理] 在 category 函数内部，强制将ID赋值给一个局部变量，然后用这个变量拼接URL，完全复制V27的成功路径。
 *   - [放弃解析tid] 彻底放弃解析不可靠的 tid 参数，改为从 ext 参数中获取ID，这是App环境的标准做法。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V48.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 48.0, title: 'Nullbr影视库 (V48)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★★★【这是本次的唯一核心：直接利用V27原理的终极category函数】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 开始执行，ext: ${JSON.stringify(ext)}`);
    
    // --- 步骤1: ID解析 ---
    // 彻底放弃不可靠的tid，只相信ext参数
    let categoryId = null;
    const page = pg || 1;

    try {
        // App环境通常会将分类信息放在ext参数中
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        if (extObj && extObj.id) {
            categoryId = extObj.id;
        }
    } catch (e) {
        log("解析ext参数失败: " + e.message);
    }

    // 如果从ext中解析失败，则执行回退 (这保证了至少能发出一个请求)
    if (!categoryId) {
        log("从ext解析ID失败，回退到默认ID");
        categoryId = CATEGORIES[0].ext.id;
    }
    log(`最终解析ID为: ${categoryId}`);

    // --- 步骤2: URL拼接和网络请求 (完全复制V27的成功路径) ---
    // 在同一个函数作用域内，定义URL并请求，避免任何跨函数传参BUG
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`最终请求URL为: ${url}`);

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
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【废弃 getCards 函数，避免任何不必要的复杂性】★★★★★
async function getCards(ext) {
    log("getCards() 已被废弃，不应被调用");
    return jsonify({ list: [] });
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
