/**
 * Nullbr 影视库前端插件 - V9.1 (V1.0 终极精简版)
 *
 * 最终架构:
 * 1. home() 函数严格、一字不差地回归到 V1.0 的正确实现。
 * 2. category() 函数被彻底简化，移除了 getCards 中间层，直接负责网络请求，
 *    并增加了最强的容错逻辑来处理任何可能的 tid 格式。
 * 3. 这是对 V1.0 的最终修正，旨在解决 `id=undefined` 的唯一问题。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V9.1] ${message}`); }

// --- App 插件入口函数 ---

// getConfig 和 init 保持 V1.0 的样子
async function init(ext) { return getConfig(); }
async function getConfig() {
    log("初始化插件配置...");
    const categories = [
        { name: '热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];
    return jsonify({
        ver: 9.1,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: categories,
    });
}

// home() 严格保持 V1.0 的样子
async function home() {
    log("home() 被调用，获取分类...");
    const config = JSON.parse(await getConfig());
    return jsonify({
        class: config.tabs,
        filters: {}
    });
}

// ★★★★★【category() 函数 - 终极简化与容错】★★★★★
async function category(tid, pg) {
    log(`category() 被调用: tid 的原始值是 <LaTex>${JSON.stringify(tid)}, 类型是 $</LaTex>{typeof tid}`);
    
    let categoryId;
    // 增加最强的容错逻辑，应对任何可能的 tid 格式
    if (typeof tid === 'object' && tid !== null && tid.id) {
        categoryId = tid.id; // 格式: { id: 2142788 }
    } else if (typeof tid === 'string' || typeof tid === 'number') {
        categoryId = tid; // 格式: 2142788 或 "2142788"
    } else {
        // 如果 tid 是 undefined, null, 或者其他意外格式，则使用默认值
        log("警告: tid 格式未知或为空，使用默认分类 ID。");
        const config = JSON.parse(await getConfig());
        categoryId = config.tabs[0].ext.id;
    }
    
    const page = pg || 1;
    log(`解析后的 categoryId: <LaTex>${categoryId}, page: $</LaTex>{page}`);

    const requestUrl = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`正在请求后端: ${requestUrl}`);

    try {
        const response = await $fetch.get(requestUrl);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            throw new Error("后端返回数据格式不正确");
        }

        const cards = data.items.map(item => {
            const vod_id = `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`;
            return {
                vod_id: vod_id,
                vod_name: item.title,
                vod_pic: `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}`,
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
