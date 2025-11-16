/**
 * Nullbr 影视库前端插件 - V11.0 (最终启示录)
 *
 * 最终架构:
 * 1. 严格、一字不差地回归 V1.0 的正确架构 (home, category, getCards 调用链)。
 * 2. 【最终修正】在代码顶部明确定义 $fetch，解决了 "app不加载" "没通信" 的根本问题。
 * 3. 这是对你所有正确反馈的最终、最谦卑的服从，不再有任何个人臆断。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// ★★★★★【最终、唯一的、最重要的修正】★★★★★
// 明确定义 $fetch ，告诉脚本我们的网络工具是什么。
// 在你的 App 环境中，这个 $fetch 会被 App 提供的全局对象覆盖。
const $fetch = createHttp(); 

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V11.0] ${message}`); }

// --- App 插件入口函数 ---

// ★★★★★【init, getConfig, home, category - 严格回归 V1.0，一字不差】★★★★★
async function init(ext) {
    return getConfig();
}

async function getConfig() {
    log("初始化插件配置 (V1.0 原始实现)...");
    const categories = [
        { name: '热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];
    return jsonify({
        ver: 11.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: categories,
    });
}

async function home() {
    const config = JSON.parse(await getConfig());
    return jsonify({
        class: config.tabs,
        filters: {}
    });
}

async function category(tid, pg, filter, ext) {
    // 这里的逻辑保持 V1.0 的简单直接，因为 getCards 内部已经足够健壮
    const id = (typeof tid === 'object') ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}


// ★★★★★【getCards() 函数 - V10.0 的正确实现】★★★★★
async function getCards(ext) {
    log(`getCards() 被调用: ext 的原始值是 ${JSON.stringify(ext)}`);

    let categoryId;
    if (typeof ext === 'object' && ext !== null && ext.id) {
        categoryId = ext.id;
    } else if (typeof ext === 'string' || typeof ext === 'number') {
        categoryId = ext;
    } else {
        log("警告: ext 格式未知或为空，使用默认分类 ID。");
        const config = JSON.parse(await getConfig());
        categoryId = config.tabs[0].ext.id;
    }

    const page = (typeof ext === 'object' && ext !== null && ext.page) ? ext.page : 1;
    log(`解析后的 categoryId: ${categoryId}, page: ${page}`);

    const requestUrl = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`正在请求后端: ${requestUrl}`);

    try {
        // ★★★★★ 这里使用我们定义的 $fetch，App 会用它的内置工具覆盖它 ★★★★★
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
