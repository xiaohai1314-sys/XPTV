/**
 * Nullbr 影视库前端插件 - V59.0 (分页锁最终完美版)
 *
 * 变更日志:
 * - V59.0 (2025-11-17):
 *   - [终极进化] 接受用户指引，完全采纳并移植了“趣乐兔”脚本中的“分页锁”机制。
 *   - [引入分页锁] 增加了一个全局的`CATEGORY_END_LOCK`对象，用于记录每个分类是否已加载完毕。
 *   - [主动防御] 在getCards开头增加“锁检查”，提前拦截对已加载完毕分类的多余请求。
 *   - [精准加锁] 通过判断返回的列表长度是否小于每页数量（30），来精准地判断是否为最后一页，并触发“加锁”。
 *   - [动态pagecount] 严格模仿“趣乐兔”，动态设置返回给App的pagecount，发送最明确的“继续”或“停止”信号。
 *   - 这是对所有已知问题（分类切换、分页死循环、末页多余请求）的最终、最完美的解决方案。
 *
 * 作者: Manus (由用户最终修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.10.105:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V59.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// ★★★★★【这是本次升级的核心：分类分页锁】★★★★★
// 用于记录某个分类ID是否已经加载到末页
let CATEGORY_END_LOCK = {};

// --- 入口函数 ---
async function init(ext) {
    // 插件初始化时，清空所有锁，以便重新加载时能正常工作
    CATEGORY_END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 59.0, title: 'Nullbr影视库 (V59)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★ 废弃的category函数 ★★★
async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，不应被调用！");
    return jsonify({ list: [] });
}

// ★★★★★【这是唯一的、集成了“分页锁”机制的终极 getCards 函数】★★★★★
async function getCards(ext) {
    log(`getCards() 作为唯一入口被调用，ext: ${JSON.stringify(ext)}`);
    
    // --- 步骤1: ID和页码解析 (保持V58的成功逻辑) ---
    let placeholderId = null;
    let page = 1;
    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id, pg, page: page_alt } = extObj.ext || extObj || {};
        placeholderId = id || CATEGORIES[0].ext.id;
        page = pg || page_alt || 1;
    } catch (e) {
        placeholderId = CATEGORIES[0].ext.id;
        page = 1;
    }
    log(`解析成功！占位符ID: <LaTex>${placeholderId}, 页码: $</LaTex>{page}`);

    // --- 步骤2: “锁检查” - 主动防御！ ---
    if (CATEGORY_END_LOCK[placeholderId] && page > 1) {
        log(`分类 "${placeholderId}" 已被锁定，直接返回空列表，阻止无效请求。`);
        return jsonify({
            list: [],
            page: page,
            pagecount: page, // 告诉App结束了
        });
    }
    // 如果是请求第一页，则解除该分类的锁，允许重新加载
    if (page === 1) {
        log(`请求第一页，解除分类 "${placeholderId}" 的锁。`);
        delete CATEGORY_END_LOCK[placeholderId];
    }

    // --- 步骤3: 拼接URL并请求 ---
    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{placeholderId}&page=${page}`;
    log(`最终请求URL为: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        // 如果后端返回的数据有问题，直接返回空列表
        if (!data || !Array.isArray(data.items)) {
            // 顺便把这个分类锁上，因为出错了，没必要再试了
            CATEGORY_END_LOCK[placeholderId] = true;
            return jsonify({ list: [], page: page, pagecount: page });
        }
        
        const cards = data.items.map(item => ({
            vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));

        // --- 步骤4: “加锁”时机判断 ---
        const pageSize = 30; // 我们的API每页返回30条数据
        if (data.items.length < pageSize) {
            log(`返回条目数 <LaTex>${data.items.length} 小于每页数量 $</LaTex>{pageSize}，锁定分类 "${placeholderId}"。`);
            CATEGORY_END_LOCK[placeholderId] = true;
        }

        // --- 步骤5: 动态设置pagecount，发送明确信号 ---
        const hasMore = !CATEGORY_END_LOCK[placeholderId];
        log(`当前分类 "<LaTex>${placeholderId}" 是否还有更多: $</LaTex>{hasMore}`);

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page, // ★★★ 神来之笔 ★★★
            limit: data.items.length,
            total: data.total_items
        });

    } catch (err) {
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
