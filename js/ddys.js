/**
 * Nullbr 影视库前端插件 - V32.0 (列表显示调试版)
 *
 * 变更日志:
 * - V32.0 (2025-11-17):
 *   - [全新调试策略] 放弃 throw Error()，因为它不会产生弹窗。
 *   - 改造 category() 函数，使其直接返回一个包含调试信息的“假”列表。
 *   - 将 tid 的类型和内容，分别显示在第一个列表项的标题和备注中。
 *   - 这样，只要列表能显示，我们就能在屏幕上看到 tid 的原始信息。
 *
 * 使用方法:
 * 1. 替换插件代码为此版本。
 * 2. 重新加载插件。
 * 3. 点击任意一个分类Tab。
 * 4. 查看屏幕上显示的第一个“电影”卡片，它的标题和简介就是我们要的调试信息。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

// --- 常量和辅助函数 (保持不变) ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V32.0-Debug] ${msg}`); }
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- 入口函数 (保持不变) ---
async function init(ext) { return getConfig(); }
async function getConfig() { return jsonify({ ver: 32.0, title: 'Nullbr影视库 (调试版)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// -------------------- category (调试核心) --------------------

async function category(tid, pg, filter, ext) {
    // ★★★ 调试核心：构造一个假的列表项来显示 tid 信息 ★★★

    const tid_type = typeof tid;
    let tid_string;
    try {
        tid_string = JSON.stringify(tid);
    } catch (e) {
        tid_string = "无法JSON序列化";
    }

    // 构造一个假的“电影”卡片
    const debugCard = {
        // 标题显示 tid 的类型
        vod_name: `[调试] tid 类型: ${tid_type}`,
        
        // 备注/简介显示 tid 的内容
        vod_remarks: `内容: ${tid_string}`,
        
        // 给一个占位ID和图片，确保卡片能显示
        vod_id: 'debug_info_001',
        vod_pic: 'https://img.zcool.cn/community/01a3815ab95212a8012060c839df75.png@1280w_1l_2o_100sh.png' // 一个放大镜图标
    };

    // 构造一个完整的列表返回给App
    const debugList = {
        list: [
            debugCard,
            // 你也可以在这里加一些正常的卡片，如果需要的话
            { vod_name: '--- 以上是调试信息 ---', vod_id: 'sep_1' }
        ],
        page: 1,
        pagecount: 1,
        limit: 1,
        total: 1
    };

    // 直接返回这个包含调试信息的假列表
    return jsonify(debugList);
}


// ----------------- 其他函数 (保持占位) -----------------

async function getCards(ext) { 
    // 在这个调试版本中，getCards 不会被调用，但我们还是保留它
    return jsonify({ list: [] }); 
}
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
