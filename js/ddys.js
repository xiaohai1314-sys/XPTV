/**
 * Nullbr 影视库前端插件 - V5.1 (终极格式修正版)
 *
 * 最终架构:
 * 1. home() 只负责同步返回数据，绝不进行网络请求。
 * 2. category() 负责网络请求，并同时返回 class 和 list。
 * 3. 【最终修正】class 数组的格式被严格修正为 App 唯一认识的 `[{ name: ..., ext: { id: ... } }]` 格式。
 * 4. 这是对 App 真实行为最精确模拟的、格式完全正确的最终版本。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V5.1] ${message}`); }

// ★★★★★【核心修正：使用 App 唯一认识的分类格式】★★★★★
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 5.1, title: 'Nullbr影视库', site: API_BASE_URL }); }

// home() 函数现在只返回同步数据
async function home() {
    log("home() 被调用，返回分类和一个空列表...");
    return jsonify({
        'class': CATEGORIES, // 直接使用 App 认识的正确格式
        'list': [],
        'filters': {}
    });
}

// category() 函数现在也返回正确格式的 class
async function category(tid, pg, filter, ext) {
    log(`category() 被调用: tid=${tid}, pg=${pg}`);
    
    // App 首次加载列表时，会自动用第一个分类的 ID 调用此函数
    const categoryId = tid || CATEGORIES[0].ext.id;
    const page = pg || 1;

    if (!categoryId) {
        log("警告: category() 收到的 tid 为空。");
        return jsonify({ 'class': CATEGORIES, list: [] });
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
            'class': CATEGORIES, // 确保返回的也是正确格式
            'list': cards,
            'page': data.page,
            'pagecount': data.total_page,
        });

    } catch (e) {
        log(`请求数据失败: ${e.message}`);
        return jsonify({ 'class': CATEGORIES, list: [] });
    }
}

// --- 未实现的功能 ---
async function detail(id) { log(`[待实现] 详情页: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`[待实现] 播放: ${id}`); return jsonify({ url: '' }); }
async function search(wd, quick) { log(`[待实现] 搜索: ${wd}`); return jsonify({ list: [] }); }
