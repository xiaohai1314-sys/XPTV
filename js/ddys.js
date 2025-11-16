/**
 * Nullbr 影视库前端插件 - V3.1 (终极解耦修正版)
 *
 * 核心架构:
 * - home() 的唯一职责是【同步】返回固定的分类列表(class)，确保 Tab 栏稳定显示。
 * - category() 的唯一职责是根据 ID 获取影视列表(list)。
 * - 两个函数完全解耦，不再互相调用。由 App 负责调度。
 * - 修正了对 App 首次调用 category() 行为的理解。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003'; // 【重要】请再次确认此 IP
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V3.1] ${message}`); }

// --- 分类定义 (全局常量) ---
const CATEGORIES = [
    { "cate_id": "2142788", "cate_name": "热门电影" },
    { "cate_id": "2143362", "cate_name": "热门剧集" },
    { "cate_id": "2142753", "cate_name": "高分电影" },
    { "cate_id": "2143363", "cate_name": "高分剧集" },
];

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 3.1, title: 'Nullbr影视库' }); }

// ★★★★★【home() 只负责分类】★★★★★
async function home() {
    log("home() 被调用，返回固定分类...");
    return jsonify({
        'class': CATEGORIES,
        'filters': {}
    });
}

// ★★★★★【category() 只负责列表】★★★★★
async function category(tid, pg) {
    // App 会在启动时用第一个分类的 ID 调用它，点击时用对应的 ID 调用它
    const categoryId = tid;
    const page = pg || 1;
    log(`category() 被调用: id=${categoryId}, page=${page}`);

    // 加一个保护，防止 tid 意外为空
    if (!categoryId) {
        log("警告: category() 收到的 tid 为空，返回空列表。");
        return jsonify({ list: [] });
    }

    const requestUrl = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`正在请求后端: ${requestUrl}`);

    try {
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
