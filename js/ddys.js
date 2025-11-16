/**
 * Nullbr 影视库前端插件 - V33.0 (Toast 终极调试版)
 *
 * 变更日志:
 * - V33.0 (2025-11-17):
 *   - [终极调试策略] 既然 return 任何数据都无效，我们怀疑 category 的返回值被忽略。
 *   - 现在的目标是确认 category 函数是否被成功执行。
 *   - 我们将尝试调用多种常见的、由App注入的 Toast 函数 (showToast, toast, print)。
 *   - 只要其中一个成功，屏幕上就会出现一个短暂的提示，证明函数被调用。
 *
 * 使用方法:
 * 1. 替换插件代码为此版本。
 * 2. 重新加载插件。
 * 3. 点击任意一个分类Tab。
 * 4. **仔细观察屏幕**，看是否有一闪而过的提示文字，比如 "Toast OK!"。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

// --- 常量和辅助函数 (保持不变) ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V33.0-Debug] ${msg}`); }
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- 入口函数 (保持不变) ---
async function init(ext) { return getConfig(); }
async function getConfig() { return jsonify({ ver: 33.0, title: 'Nullbr影视库 (调试版)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// -------------------- category (调试核心) --------------------

async function category(tid, pg, filter, ext) {
    // ★★★ 调试核心：广撒网尝试调用各种可能的 Toast 函数 ★★★

    const tid_type = typeof tid;
    const tid_string = JSON.stringify(tid);
    const debug_message = `[V33] 类型: <LaTex>${tid_type}, 内容: $</LaTex>{tid_string}`;

    // 1. 尝试调用 showToast()
    try {
        if (typeof showToast === 'function') {
            showToast("showToast OK! " + debug_message);
            log("成功调用 showToast()");
        }
    } catch (e) { log("showToast 不存在或调用失败"); }

    // 2. 尝试调用 toast()
    try {
        if (typeof toast === 'function') {
            toast("toast OK! " + debug_message);
            log("成功调用 toast()");
        }
    } catch (e) { log("toast 不存在或调用失败"); }

    // 3. 尝试调用 print() (在某些环境中 print 就是 toast)
    try {
        if (typeof print === 'function') {
            print("print OK! " + debug_message);
            log("成功调用 print()");
        }
    } catch (e) { log("print 不存在或调用失败"); }

    // 4. 尝试调用一个不存在的函数，看看App的错误处理机制
    try {
        // 这可能会触发一个你能看到的错误日志
        log("准备调用一个不存在的函数来触发错误日志...");
        nonExistentFunctionForDebug();
    } catch(e) {
        log(`调用不存在的函数失败，错误: ${e.message}`);
    }
    
    // 在这个版本中，我们不关心返回值，因为之前的测试表明它可能被忽略了。
    // 我们只关心上面的尝试是否能在屏幕上产生任何可见的反馈。
    return jsonify({ list: [] });
}


// ----------------- 其他函数 (保持占位) -----------------
async function getCards(ext) { return jsonify({ list: [] }); }
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
