/**
 * Nullbr 影视库前端插件 - V4.0 (最终正确版)
 *
 * 最终架构:
 * 1. home() 的职责：返回【分类(class)】和【一个空的列表(list)】。
 *    - 返回 class 是为了让 App 渲染 Tab。
 *    - 返回空的 list 是为了满足 App 对 home() 返回值的结构要求。
 *    - home() 绝不进行任何网络请求。
 * 2. category() 的职责：根据 App 传递的 tid 获取真实的影视列表。
 *    - App 在渲染完 Tab 后，会立即自动调用 category() 来填充首页列表。
 *    - 用户点击 Tab 或翻页时，也会调用 category()。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003'; // 【重要】请再次确认此 IP
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V4.0] ${message}`); }

// --- 分类定义 (V3.0 的正确格式) ---
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 4.0, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES }); }

// ★★★★★【最终修正的 home() 函数】★★★★★
async function home() {
    log("home() 被调用，返回分类和一个空列表...");
    
    // 1. 准备分类数据 (使用 App 需要的正确结构)
    const classData = CATEGORIES.map(c => ({
        "cate_id": c.ext.id.toString(),
        "cate_name": c.name
    }));

    // 2. 返回 class 和一个空的 list
    return jsonify({
        'class': classData,
        'list': [], // 返回一个空列表！
        'filters': {}
    });
}

// ★★★★★【最终修正的 category() 函数】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 被调用: tid=${tid}, pg=${pg}`);
    
    // App 首次加载列表时，会自动用第一个分类的 ID 调用此函数
    const categoryId = tid;
    const page = pg || 1;

    if (!categoryId) {
        log("警告: category() 收到的 tid 为空，这不应该发生在 V4.0 架构中。返回空列表。");
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
async function detail(id) { log(`[待实现] 详情页: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`[待实现] 播放: ${id}`); return jsonify({ url: '' }); }
async function search(wd, quick) { log(`[待实现] 搜索: ${wd}`); return jsonify({ list: [] }); }
