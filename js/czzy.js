/**
 * 侦察兵插件 - V1.0
 * 目的：捕获并显示 detail(id) 函数接收到的真实 id 值。
 */

// --- 配置区 (保持和原来一样) ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";

// --- 辅助函数 ---
function log(msg) { try { $log(`[侦察兵] ${msg}`); } catch (_) { console.log(msg); } }
function jsonify(obj) { return JSON.stringify(obj); }

// --- 核心函数 ---

// search 函数保持原样，确保能显示列表
async function search(ext) {
    // ext 可能是字符串，也可能是对象，这里做一下兼容处理
    let extObj = {};
    try {
        extObj = JSON.parse(ext);
    } catch (e) {
        // 如果不是JSON字符串，就当作空对象处理
    }
    const keyword = extObj.text || '';
    if (!keyword) return jsonify({ list: [] });
    log(`搜索: "${keyword}"`);
    try {
        // 假设后端返回的是一个轻量列表，且包含了 vod_id
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url);
        
        // 确保返回给APP的列表是可用的，这里直接返回后端给的轻量列表
        // 注意：这里没有进行 ID 拼接，目的是为了看 APP 默认传什么
        return fetchResult.data; 
    } catch (e) {
        log(`搜索异常: ${e.message}`);
        // 返回一个空列表，防止APP崩溃
        return jsonify({ code: 0, message: '搜索失败', list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 侦察核心：改造 detail 和 getTracks 函数 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // ext 就是 detail 传过来的 id
    // 我们要看看这个 id 到底是什么
    let id_type = typeof ext;
    let id_content = '';

    if (id_type === 'string') {
        id_content = ext;
    } else if (id_type === 'object') {
        try {
            id_content = JSON.stringify(ext, null, 2); // 格式化输出，方便查看
        } catch (e) {
            id_content = '一个无法字符串化的对象';
        }
    } else {
        id_content = String(ext);
    }

    const message = `侦察结果：收到的ID类型是 [${id_type}], 内容是: ${id_content}`;
    log(message);

    // 把侦察结果显示在APP的按钮上
    return jsonify({
        list: [{
            title: '侦察报告',
            tracks: [{
                name: message,
                pan: ''
            }]
        }]
    });
}

// detail 函数直接把收到的 id 交给 getTracks
async function detail(id) {
    log(`detail函数被调用，收到的原始id是: ${JSON.stringify(id)}`);
    return getTracks(id);
}


// --- 其他兼容接口 (保持最简化) ---
async function getConfig() {
    return jsonify({ ver: 1, title: '侦察兵', site: SITE_URL, tabs: [] });
}
async function init() { return getConfig(); }
async function home() { return jsonify({ class: [] }); }
async function category(tid, pg) { return jsonify({ list: [] }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 侦察兵插件加载完成 ====');
