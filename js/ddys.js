/**
 * Nullbr 影视库前端插件 - V19.0 (最终的顿悟)
 *
 * 最终架构:
 * 1. home() 函数是获取【分类】和【首页列表】的【唯一入口】。
 * 2. 【最终修正】home() 内部必须请求网络，获取第一个分类的数据并填充到 list 字段中，
 *    解决了“过程全是空白”的根本问题。
 * 3. category() 只为后续的 Tab 点击服务。
 * 4. 这是对你所有正确反馈的最终、最谦卑的服从。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V19.0] ${message}`); }

// ★★★★★【分类数据 - 作为常量，供 home 和 category 使用】★★★★★
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 19.0, title: 'Nullbr影视库', site: API_BASE_URL }); }

// ★★★★★【home() 函数 - 唯一的、真正的入口】★★★★★
async function home() {
    log("home() 被调用，将同时获取分类和首页列表...");

    const defaultCategoryId = CATEGORIES[0].ext.id; // 默认加载第一个分类：“热门电影”
    const requestUrl = `${API_BASE_URL}/api/list?id=${defaultCategoryId}&page=1`;
    log(`正在为首页请求数据: ${requestUrl}`);

    let homeList = [];
    try {
        const { data: responseData } = await $fetch.get(requestUrl);
        const data = JSON.parse(responseData);

        if (data && Array.isArray(data.items)) {
            homeList = data.items.map(item => {
                const vod_id = `${item.media_type}_${item.tmdbid}`;
                return {
                    vod_id: vod_id,
                    vod_name: item.title,
                    vod_pic: `${TMDB_IMAGE_BASE_URL}${item.poster}`,
                    vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '未知'),
                };
            });
        }
    } catch (e) {
        log(`首页列表请求失败: ${e.message}`);
        // 即使失败，也要返回正确的结构，只是 list 为空
    }

    // ★★★★★ 严格遵守 V3.0 的返回值结构，但 list 不再为空 ★★★★★
    return jsonify({
        'class': CATEGORIES,
        'list': homeList,
        'filters': {}
    });
}

// ★★★★★【category() 函数 - 只为点击服务，保持 V15.0 的完美实现】★★★★★
async function category(tid, pg, filter, ext) {
    const id = (typeof tid === 'object') ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}

async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page || 1;

    if (!categoryId) {
        log("错误: categoryId 为空，无法请求。");
        return jsonify({ list: [] });
    }

    const requestUrl = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`正在请求分类数据: ${requestUrl}`);

    try {
        const { data: responseData } = await $fetch.get(requestUrl);
        const data = JSON.parse(responseData);

        if (!data || !Array.isArray(data.items)) {
            throw new Error("后端返回数据格式不正确");
        }

        const cards = data.items.map(item => {
            const vod_id = `${item.media_type}_${item.tmdbid}`;
            return {
                vod_id: vod_id,
                vod_name: item.title,
                vod_pic: `${TMDB_IMAGE_BASE_URL}${item.poster}`,
                vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '未知'),
            };
        });

        return jsonify({
            'list': cards,
            'page': data.page,
            'pagecount': data.total_page,
            'limit': cards.length,
            'total': data.total_items,
        });

    } catch (e) {
        log(`请求数据失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 未实现的功能 ---
async function detail(id) { log(`[待实现] 详情页: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`[待实现] 播放: ${id}`); return jsonify({ url: '' }); }
async function search(wd, quick) { log(`[待实现] 搜索: ${wd}`); return jsonify({ list: [] }); }
