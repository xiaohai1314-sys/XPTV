/**
 * Nullbr 影视库前端插件 - V1.0
 *
 * 功能:
 * 1. 实现分类 Tab 展示 (热门/高分电影、热门/高分剧集)。
 * 2. 实现从后端加载并展示对应分类的影视列表。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 【重要】请将此地址替换为你的后端服务实际运行的 IP 和端口
const API_BASE_URL = 'http://192.168.1.7:3003';

// TMDB 图片服务器地址，用于拼接海报路径
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


// --- 辅助函数 ---

/**
 * 将 JavaScript 对象转换为 JSON 字符串。
 * @param {object} data - 需要转换的对象。
 * @returns {string} - JSON 字符串。
 */
function jsonify(data) {
    return JSON.stringify(data);
}

/**
 * 打印日志，方便调试。
 * @param {string} message - 要打印的信息。
 */
function log(message) {
    console.log(`[Nullbr插件] ${message}`);
}


// --- App 插件入口函数 ---

/**
 * App 启动时调用此函数，用于获取插件的基本信息和分类 Tab。
 * @returns {Promise<string>} - 返回包含配置信息的 JSON 字符串。
 */
async function getConfig() {
    log("初始化插件配置 (V1.0)...");

    // 根据你提供的 ID 和名称创建分类数组
    const categories = [
        { name: '热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];

    // 返回 App 需要的 JSON 格式
    return jsonify({
        ver: 1.0,                   // 插件版本号
        title: 'Nullbr影视库',      // 插件显示在顶部的名称
        site: API_BASE_URL,         // 关联的网站地址，这里指向我们的后端
        tabs: categories,           // App会根据这个数组生成底部的Tab按钮
    });
}

/**
 * App 在用户点击分类 Tab 或在列表末尾上滑翻页时调用此函数。
 * @param {object} ext - 从 getConfig 的 tabs 中传递过来的对象，例如 { id: 2142788, page: 1 }。
 * @returns {Promise<string>} - 返回包含影视列表的 JSON 字符串。
 */
async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page || 1; // App 翻页时会提供新的 page 值

    // 构造请求后端 /api/list 接口的完整 URL
    const requestUrl = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`正在请求分类数据: ${requestUrl}`);

    try {
        // 使用 App 环境提供的 $fetch 工具发起网络请求
        // 假设 $fetch 返回的对象中，响应体在 data 属性里
        const response = await $fetch.get(requestUrl);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            throw new Error("返回的数据格式不正确，缺少 items 数组。");
        }

        // 将后端返回的 items 数组，转换成 App 需要的卡片(vod)格式
        const cards = data.items.map(item => {
            // 构造一个唯一的 vod_id，格式为 "类型_tmdbid"，例如 "movie_1062722"
            // 这样做可以方便在详情页(detail)中解析出 type 和 tmdbid
            const vod_id = `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`;

            return {
                vod_id: vod_id,
                vod_name: item.title,
                vod_pic: `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}`,
                // 在卡片右上角显示的备注信息，优先显示评分，否则显示上映年份
                vod_remarks: item.vote_average > 0
                    ? `⭐ ${item.vote_average.toFixed(1)}`
                    : (item.release_date ? item.release_date.substring(0, 4) : '未知'),
            };
        });

        // 返回 App 需要的完整格式
        return jsonify({
            list: cards,
            page: data.page,            // 当前页码
            pagecount: data.total_page, // 总页数，用于告知 App 是否还有下一页
            limit: cards.length,        // 当前页返回的数量
            total: data.total_items,    // 总项目数
        });

    } catch (e) {
        log(`请求分类 <LaTex>${categoryId} 失败: $</LaTex>{e.message}`);
        // 如果发生错误，返回一个空列表，避免 App 崩溃
        return jsonify({ list: [] });
    }
}


// --- 兼容接口和未实现的功能 ---
// 这些是 App 可能调用的其他标准函数，我们先提供一个基本框架。

async function init(ext) {
    // init 通常只是调用 getConfig
    return getConfig();
}

async function home() {
    // home 接口通常用于提供分类和筛选数据
    const config = JSON.parse(await getConfig());
    return jsonify({
        class: config.tabs,
        filters: {} // 暂时没有筛选功能
    });
}

async function category(tid, pg, filter, ext) {
    // category 接口是 getCards 的另一种调用方式
    const id = (typeof tid === 'object') ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}

// 以下功能待实现
async function detail(id) {
    log(`[待实现] 请求详情页: ${id}`);
    return jsonify({ list: [] });
}

async function play(flag, id, flags) {
    log(`[待实现] 请求播放: ${id}`);
    return jsonify({ url: '' });
}

async function search(wd, quick) {
    log(`[待实现] 搜索: ${wd}`);
    return jsonify({ list: [] });
}
