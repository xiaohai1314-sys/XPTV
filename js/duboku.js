/**
 * Nullbr 影视库前端插件 - V31.0 (调试专用版)
 *
 * 目标:
 * - 利用抛出错误的方式，强制App以醒目的方式（通常是红色弹窗）
 *   显示传入 category() 的 tid 的原始值和类型。
 * - 这是最可靠的调试方法，可以看清App到底传递了什么。
 *
 * 使用方法:
 * 1. 替换插件代码为此版本。
 * 2. 重新加载插件。
 * 3. 点击任意一个分类Tab。
 * 4. 观察屏幕上弹出的红色错误信息，它将包含我们需要的内容。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

// --- 常量和辅助函数 (保持不变) ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V31.0-Debug] ${msg}`); }
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- 入口函数 (保持不变) ---
async function init(ext) { return getConfig(); }
async function getConfig() { return jsonify({ ver: 31.0, title: 'Nullbr影视库 (调试版)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// -------------------- category (调试核心) --------------------

async function category(tid, pg, filter, ext) {
    // ★★★ 调试核心：主动抛出错误来显示 tid 的信息 ★★★

    const tid_type = typeof tid;
    const tid_string = JSON.stringify(tid);

    // 创建一个包含详细信息的错误消息
    const errorMessage = `
    >>> 调试信息 <<<
    ------------------------
    分类ID (tid) 的类型是:
    ${tid_type}
    ------------------------
    分类ID (tid) 的内容是:
    ${tid_string}
    ------------------------
    (请截图此信息)
    `;

    // 抛出错误，App会用红色弹窗显示它
    throw new Error(errorMessage);

    // 下面的代码不会被执行，因为错误已经抛出
    // return jsonify({ list: [] }); 
}


// ----------------- 其他函数 (保持占位) -----------------

async function getCards(ext) { return jsonify({ list: [] }); }
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
