/**
 * Nullbr 影视库前端插件 - V2.0 (App 最终版)
 *
 * 功能:
 * - 经过本地 Console 环境完整测试，功能稳定。
 * - 采用稳定的 home/category 分离架构，确保分类 Tab 正常显示。
 * - 修正了 home() 调用 category() 时的 URL 构造问题。
 * - 兼容 App 环境的 $fetch。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003'; // 【重要】请再次确认此 IP 在 App 环境中可以访问到
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V2.0] ${message}`); }

// --- 分类定义 ---
const CATEGORIES = [
    { "cate_id": "2142788", "cate_name": "热门电影" },
    { "cate_id": "2143362", "cate_name": "热门剧集" },
    { "cate_id": "2142753", "cate_name": "高分电影" },
    { "cate_id": "2143363", "cate_name": "高分剧集" },
];

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 2.0, title: 'Nullbr影视库' }); }

/**
 * App 启动后调用此函数来获取首页的分类和筛选信息。
 */
async function home() {
    log("home() 被调用，返回固定分类...");
    // 直接返回固定的分类数据，确保 Tab 能稳定显示
    return jsonify({
        'class': CATEGORIES,
        'filters': {}
    });
}

/**
 * App 点击分类或翻页时调用。
 * 也被 home() 首次加载时调用 (此时 tid 为空)。
 * @param {string} tid - 分类ID。
 * @param {string} pg - 页码。
 */
async function category(tid, pg) {
    // 如果是 App 首次加载 (tid为空)，则使用第一个分类的 ID 作为默认值
    const categoryId = tid || CATEGORIES[0].cate_id;
    const page = pg || 1;
    log(`category() 被调用: id=${categoryId}, page=${page}`);

    const requestUrl = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`正在请求后端: ${requestUrl}`);

    try {
        // 使用 App 环境提供的 $fetch
        const response = await $fetch.get(requestUrl);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;

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

        // 注意：category 接口只返回 list，不返回 class
        return jsonify({
            'list': cards,
            'page': data.page,
            'pagecount': data.total_page,
        });

    } catch (e) {
        log(`请求数据失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 未实现的功能 ---
async function detail(id) { log(`[待实现] 详情: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`[待实现] 播放: ${id}`); return jsonify({ url: '' }); }
async function search(wd, quick) { log(`[待实现] 搜索: ${wd}`); return jsonify({ list: [] }); }
