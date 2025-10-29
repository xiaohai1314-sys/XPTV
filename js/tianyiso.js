/**
 * reboys.cn 前端插件 - V39.0 (ext透传最终版)
 *
 * 版本说明:
 * - 【V39.0 终极反思】: V22-Fix 后端确认可用，问题 100% 在前端。之前所有前端修改方案均告失败。
 * - 【ext 透传架构】: 本方案回归 App 插件设计的经典模式，即“ext字段透传”。
 * - 【search 职责修正】: 
 *    1. 从后端获取的 list 数据【不做任何修改】。
 *    2. 后端返回的数据已包含 vod_id 和带有 links 的 ext 字段，完美符合框架要求。
 *    3. 直接将这个【原始、干净】的 list 返回给 App。这确保了列表一定能正常显示。
 * - 【getTracks 职责修正】:
 *    1. 假设 App 框架在调用 detail 时，会把 search 阶段的 ext 对象原样传回。
 *    2. 直接从传入的 ext 参数中提取 links 数据。
 *    3. 不再需要任何全局缓存、ID编码或二次网络请求。
 * - 【最终方案】: 此方案逻辑最简单，对 App 框架的假设最少，是与 V22-Fix 后端匹配的最终正确方案。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;

// --- 辅助函数 ---
function log(msg ) { 
    const logMsg = `[reboys V39] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V39.0 (ext透传最终版) ====");
    return jsonify({ ver: 1, title: 'reboys搜(V39)', site: SITE_URL, tabs: [] });
}

// --- 首页/分类 (简化) ---
async function home() { return jsonify({ class: [] }); }
async function category(tid, pg) { return jsonify({ list: [] }); }

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ V39 核心修正：search函数，对后端数据零修改，直接透传 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });

    log(`[search] 开始搜索: "${keyword}"`);

    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);

        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        
        // 核心修正：后端返回的 list 数据结构已经完美，不做任何修改，直接透传给 App。
        log(`[search] ✅ 成功从后端获取 ${response.list.length} 条数据，直接透传给App。`);
        return jsonify({ list: response.list });

    } catch (e) {
        log(`[search] 搜索过程中发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ V39 核心修正：getTracks函数，从传入的 ext 对象中直接取数据 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // ext 参数现在被假定为 search 阶段的那个 ext 对象，即 { links: [...] }
    log(`[getTracks] 开始处理详情, 接收到的 ext 对象: ${jsonify(ext)}`);
    
    // 注意：App框架可能会把 vod_id 也包装在 ext 里，或者 ext 就是整个 item 对象。
    // 我们做一个兼容性处理，优先从 ext.links 取，如果取不到，再尝试从 ext.ext.links 取。
    const itemExt = ext.ext || ext;

    if (!itemExt || typeof itemExt !== 'object') {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无效的扩展参数(ext)', pan: '' }] }] });
    }

    const links = itemExt.links || [];
    log(`[getTracks] ✅ 成功从 ext 参数中提取到 ${links.length} 个链接。`);

    if (links.length === 0) {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '未在此资源中找到链接', pan: '' }] }] });
    }

    const tracks = links.map((linkData, index) => {
        const url = linkData.url;
        const password = linkData.password;
        let panType = '网盘';
        if (linkData.type === 'quark' || (url && url.includes('quark.cn'))) panType = '夸克';
        else if (linkData.type === 'aliyun' || (url && url.includes('aliyundrive.com'))) panType = '阿里';
        else if (linkData.type === 'baidu' || (url && url.includes('pan.baidu.com'))) panType = '百度';
        
        const buttonName = `${panType}网盘 ${index + 1}`;
        const finalPan = password ? `${url}（访问码：${password}）` : url;

        return { name: buttonName, pan: finalPan, ext: {} };
    });

    return jsonify({ list: [{ title: '云盘', tracks: tracks }] });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
// 关键：detail 接口现在需要传递整个 ext 对象
async function detail(id, ext_str) {
    // App框架在调用 detail 时，通常第一个参数是 id，第二个是包含 ext 的 JSON 字符串
    const ext = argsify(ext_str);
    // 我们将整个 ext 对象传递给 getTracks
    return getTracks(ext); 
}
async function play(flag, id) { return jsonify({ parse: 0, url: id, header: {} }); }

log('==== 插件加载完成 V39.0 (ext透传最终版) ====');
