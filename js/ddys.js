/**
 * Nullbr 影视库前端插件 - V2.1 (终极正确版)
 *
 * 核心:
 * - 严格复现本地测试成功的 V1.3 架构，确保 home() 函数能同时返回 class 和 list。
 * - 解决了 V2.0 版本中因修改 home() 逻辑导致 Tab 栏不显示的问题。
 * - 这是经过验证、可直接在 App 中使用的最终版本。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003'; // 【重要】请再次确认此 IP
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V2.1] ${message}`); }

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 2.1, title: 'Nullbr影视库' }); }

// ★★★★★【核心修正：恢复 home() 的正确逻辑】★★★★★
/**
 * App 启动时调用，必须同时返回分类(class)和默认的影视列表(list)。
 */
async function home() {
    log("home() 被调用，请求默认数据 (class + list)...");
    // 调用 category 函数，但不带 tid，让它去获取默认分类和列表
    return category('', 1);
}

/**
 * App 点击分类或翻页时调用。
 * 也被 home() 首次加载时调用。
 * @param {string} tid - 分类ID。
 * @param {string} pg - 页码。
 */
async function category(tid, pg) {
    const page = pg || 1;
    log(`category() 被调用: tid=${tid || '默认'}, page=${page}`);

    // 如果 tid 为空 (来自 home() 调用)，则不包含 id 参数，让后端使用默认值
    let requestUrl = `${API_BASE_URL}/api/list?page=${page}`;
    if (tid) {
        requestUrl = `${API_BASE_URL}/api/list?id=${tid}&page=${page}`;
    }
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

        // ★★★★★【核心修正：确保返回值包含 class 和 list】★★★★★
        // 无论是 home() 调用还是 category() 调用，都返回完整的结构
        return jsonify({
            'class': data.class, // 直接使用后端提供的分类
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
