/**
 * Nullbr 影视库前端插件 - V9.0 (终极组合版)
 *
 * 最终架构:
 * 1. home() 函数严格、一字不差地回归到唯一能显示 Tab 的 V4.0 版本。
 *    - 绝对不请求网络。
 *    - 返回值必须同时包含 `class` 和一个空的 `list: []`。
 * 2. category() 函数使用 V8.1 中被验证过的、只返回 list 的正确实现。
 * 3. 这是对你所有正确反馈的最终组合，不再包含任何我个人的错误推断。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V9.0] ${message}`); }

// ★★★★★【核心：App 唯一认识的分类格式】★★★★★
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 9.0, title: 'Nullbr影视库', site: API_BASE_URL }); }

// ★★★★★【home() 函数 - 严格回归 V4.0】★★★★★
async function home() {
    log("home() 被调用，返回分类和空列表...");
    // 严格遵守 V4.0 的实现，这是唯一能显示 Tab 的方式
    return jsonify({
        'class': CATEGORIES,
        'list': [],
        'filters': {}
    });
}

// ★★★★★【category() 函数 - 严格使用 V8.1 的实现】★★★★★
async function category(tid, pg) {
    log(`category() 被调用: tid=${tid}, pg=${pg}`);
    
    const categoryId = tid || CATEGORIES[0].ext.id;
    const page = pg || 1;

    if (!categoryId) {
        log("错误: categoryId 为空。");
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

        // 严格遵守“观影网”的实现，只返回 list 和分页信息
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
