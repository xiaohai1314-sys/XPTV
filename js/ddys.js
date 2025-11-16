/**
 * Nullbr 影视库前端插件 - V10.0 (圣经的唯一修正版)
 *
 * 最终架构:
 * 1. getConfig(), home(), category() 函数【一字不差】地回归到 V1.0 的原始实现。
 * 2. 【唯一修正】只在最深层的 getCards() 函数内部，增加对 ext 参数的容错处理，
 *    以解决 id=undefined 的唯一已知问题。
 * 3. 这是对你所有正确反馈的最终、最谦卑的服从。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V10.0] ${message}`); }

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
        ver: 10.0,
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
    const id = (typeof tid === 'object') ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}


// ★★★★★【getCards() 函数 - 唯一的、最小化的修正点】★★★★★
async function getCards(ext) {
    log(`getCards() 被调用: ext 的原始值是 ${JSON.stringify(ext)}`);

    let categoryId;
    // 增加最强的容错逻辑，应对任何可能的 ext 格式
    if (typeof ext === 'object' && ext !== null && ext.id) {
        categoryId = ext.id;
    } else if (typeof ext === 'string' || typeof ext === 'number') {
        // 增加对 ext 本身就是 ID 的情况的兼容
        categoryId = ext;
    } else {
        log("警告: ext 格式未知或为空，使用默认分类 ID。");
        const config = JSON.parse(await getConfig());
        categoryId = config.tabs[0].ext.id;
    }

    const page = (typeof ext === 'object' && ext !== null && ext.page) ? ext.page : 1;
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
