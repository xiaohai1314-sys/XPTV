/**
 * reboys.cn 前端插件 - V44.0 (三步流程最终正确版)
 *
 * 版本说明:
 * - 【V44.0 拨乱反正】: 彻底推翻之前所有错误的两步流程假设，严格遵循“夸父”脚本揭示的“search -> detail -> play”三步流程。
 * - 【search 职责】: 调用后端，获取数据。建立 vod_id -> links[] 的【内部缓存】。返回【干净列表】给App，确保UI正常。
 * - 【detail/getTracks 职责】: 接收 vod_id，从缓存中查找 links[] 数组。将此数组包装成【待选按钮列表】的复杂JSON返回给App，用于渲染详情页的链接按钮。
 * - 【play 职责】: 接收App传递来的【纯链接】(用户点击按钮后，App从按钮的'pan'字段获取)，并将其包装在 {url: id} 中返回，作为最终指令。
 * - 【最终方案】: 此方案完美复刻了成功范例的完整逻辑链，是与 V22-Fix 后端匹配的唯一正确方案。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const DEBUG = true;

// --- 辅助函数 ---
function log(msg ) { try { $log(`[reboys V44] ${msg}`); } catch (_) { if (DEBUG) console.log(msg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(obj) { return JSON.stringify(obj); }

// ★★★ V44 核心：链接缓存，在 search 和 detail 之间传递数据 ★★★
let linkCache = {};

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V44.0 (三步流程最终正确版) ====");
    return jsonify({ ver: 1, title: 'reboys搜(V44)', site: '', tabs: [] });
}

async function home() { return jsonify({ class: [] }); }
async function category(tid, pg) { return jsonify({ list: [] }); }

// ★★★ 第1步：search函数，获取列表，建立缓存 ★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });

    log(`[search] 新搜索: "${keyword}", 清空缓存。`);
    linkCache = {}; 

    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);

        if (response.code !== 0) throw new Error(response.message);
        
        response.list.forEach(item => {
            if (item.vod_id) {
                // 缓存 vod_id 到 完整的 links 数组的映射
                linkCache[item.vod_id] = item.ext.links || [];
            }
        });
        log(`[search] ✅ 缓存建立成功，共 ${Object.keys(linkCache).length} 条。`);

        log(`[search] ✅ 返回 ${response.list.length} 条干净列表给App。`);
        return jsonify({ list: response.list });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★ 第2步：detail函数，从缓存获取链接，返回【按钮列表JSON】 ★★★
async function detail(id) {
    // id 是App传来的简单 vod_id, 如 "0", "1"
    if (!id) {
        return jsonify({ list: [] });
    }
    log(`[detail] 接收到ID: "${id}", 从缓存查找链接...`);
    
    // 从缓存中查找对应的 links 数组
    const links = linkCache[id];
    
    if (!links || links.length === 0) {
        log(`[detail] ❌ 未找到ID "${id}" 对应的链接或链接为空。`);
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '未找到有效链接', pan: '' }] }] });
    }

    log(`[detail] ✅ 找到 ${links.length} 个链接，正在包装成按钮列表...`);

    // 模仿“夸父”的 getTracks，将 links 数组包装成 App 需要的按钮列表格式
    const tracks = links.map((linkInfo, index) => {
        const url = linkInfo.url;
        const password = linkInfo.password;
        let panType = '网盘';
        if (linkInfo.type === 'quark') panType = '夸克';
        else if (linkInfo.type === 'aliyun') panType = '阿里';
        else if (linkInfo.type === 'baidu') panType = '百度';
        
        const buttonName = `${panType} ${index + 1}`;
        // ★ 关键: pan 字段里存放的是【纯链接】
        const finalPan = password ? `${url}（码：${password}）` : url;

        return { 
            name: buttonName, 
            // App点击这个按钮时，会把 pan 字段里的纯链接传给 play 函数
            pan: url, 
            // ext 里可以放一些额外信息，比如带密码的完整链接，用于显示或复制
            ext: { full: finalPan } 
        };
    });

    // 返回一个符合App规范的、用于渲染按钮的复杂JSON
    return jsonify({ list: [{ title: '云盘', tracks: tracks }] });
}

// ★★★ 第3步：play函数，接收【纯链接】，返回最终指令 ★★★
async function play(flag, id) {
    // 这里的 id，就是用户点击按钮后，App从按钮的 "pan" 字段里取出的【纯链接】
    log(`[play] 接收到最终播放/下载链接: ${id}`);
    
    // 直接将这个纯链接包装在 {url: ...} 结构中返回
    return jsonify({
        parse: 0, // 0表示不使用webview解析，直接取url
        url: id,
        header: {}
    });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }

log('==== 插件加载完成 V44.0 (三步流程最终正确版) ====');
