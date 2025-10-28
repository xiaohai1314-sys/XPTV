/**
 * reboys.cn 前端插件 - V14 (诊断专用版)
 * 
 * 诊断目的:
 * 1. [核心诊断] search: 绕过所有JSON解析，将从后端收到的原始响应体直接作为结果返回。
 *    - 如果前端能显示一个标题很长的结果，说明数据成功到达前端。
 *    - 如果前端依然空白，说明数据在传输过程中丢失。
 * 2. [辅助] 增加大量、明确的日志，跟踪每一步。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[reboys诊断V14] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 插件入口 (保持不变) ---
async function getConfig() {
    log("==== 插件初始化 V14 (诊断专用版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V14-Diag)', site: SITE_URL, tabs: CATEGORIES });
}
async function getCards(ext) { return jsonify({ list: [] }); } // 诊断期间，首页功能暂时禁用

// ★★★★★【核心诊断代码】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    if (!text) return jsonify({ list: [] });
    log(`[search] 开始诊断搜索功能，关键词: "${text}"`);

    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(text)}&page=1`;
        log(`[search] 准备请求后端URL: ${url}`);
        
        // 使用 $fetch.get 获取数据，但这次我们获取的是原始文本
        const rawResponse = await $fetch.get(url, { parse: 'text' });
        log(`[search] ✓ 成功从后端获取到原始响应!`);
        log(`[search] 原始响应内容 (前500字符): ${rawResponse.substring(0, 500)}`);

        // 核心诊断步骤：不解析JSON，直接把原始字符串作为结果返回
        const diagnosticResult = {
            vod_id: 'diagnostic_id',
            vod_name: `[诊断结果] ${rawResponse}`, // 将完整响应作为标题
            vod_pic: FALLBACK_PIC,
            vod_remarks: '请将此标题截图发给我'
        };
        
        log(`[search] 准备返回诊断结果...`);
        return jsonify({ list: [diagnosticResult] });

    } catch (e) {
        log(`❌ [search] 诊断过程中发生严重错误: ${e.message}`);
        log(`❌ 错误堆栈: ${e.stack}`);
        
        // 如果出错，也返回一个错误信息
        const errorResult = {
            vod_id: 'error_id',
            vod_name: `[诊断失败] 错误: ${e.message}`,
            vod_pic: FALLBACK_PIC,
            vod_remarks: '请求后端时发生异常'
        };
        return jsonify({ list: [errorResult] });
    }
}

// ★★★★★【详情 - 诊断版】★★★★★
async function getTracks(ext) {
    log(`[getTracks] 诊断模式，直接返回固定信息`);
    return jsonify({ list: [{ title: '诊断模式', tracks: [{ name: '此为诊断插件，无播放功能', pan: '' }] }] });
}


// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
