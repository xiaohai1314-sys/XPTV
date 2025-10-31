/**
 * reboys.cn 前端插件 - 最终版 V3 (全局关键词配合)
 * 
 * 架构说明:
 * - search: **全局存储**搜索关键词。将资源的完整标题作为 vod_id 传递给APP。
 * - detail/getTracks: 从**全局变量**中获取关键词，从 ext.vod_id 中获取标题，然后请求后端 /get_links。
 * - 此方案解决了“标题唯一性”和“关键词缺失”的问题，是最简洁的实现。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.107:3000"; // ★★★ 请务必修改为您的后端服务器地址 ★★★
const SITE_URL = "https://reboys.cn";
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// ★★★ 核心改动：全局变量存储搜索关键词 ★★★
let currentKeyword = ""; 

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys Final V3] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 Final V3 (全局关键词配合) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(Final V3)', site: SITE_URL, tabs: CATEGORIES });
}

// --- search函数：存储关键词，并使用标题作为 vod_id ---
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });
    
    // ★★★ 核心改动 ①：存储关键词到全局变量 ★★★
    currentKeyword = keyword;
    log(`[search] 搜索: "${keyword}", 关键词已存入全局变量`);
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);
        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        
        // ★ 核心逻辑：后端已经将 vod_id 设置为资源的完整标题。前端直接返回。
        log(`[search] ✅ 后端返回 ${response.list.length} 条结果`);
        return jsonify({ list: response.list });
    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks函数：从全局变量中获取关键词 ---
async function getTracks(ext) {
    // 接收到的 ext.vod_id 就是资源的完整标题
    const title = ext.vod_id || ''; 
    
    // ★★★ 核心改动 ②：从全局变量中获取关键词 ★★★
    const keyword = currentKeyword; 
    
    log(`[getTracks] 开始请求详情, 标题=${title}, 关键词=${keyword}`);

    if (!title || !keyword) {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: `参数错误：标题或关键词缺失 (T:${title}, K:${keyword})`, pan: '' }] }] });
    }

    try {
        // 1. 请求后端接口，传递标题和关键词
        const url = `${BACKEND_URL}/get_links?id=${encodeURIComponent(title)}&keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 60000 }); // 延长超时时间应对 Puppeteer 启动
        const response = argsify(fetchResult.data || fetchResult);

        if (!response.success || !response.links) {
            throw new Error(`后端/get_links接口错误: ${response.message || '未知错误'}`);
        }

        const links = response.links;
        log(`[getTracks] ✅ 成功从后端获取到 ${links.length} 个链接`);

        if (links.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
        }

        // 2. 生成按钮 (逻辑与之前保持一致)
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

        // 3. 返回标准 list/tracks 结构
        return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        // 返回更明确的错误信息
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: `获取链接失败: ${e.message}`, pan: '' }] }] });
    }
}

// --- 兼容接口 (保持不变) ---
async function init() { return getConfig(); }
async function home() { return jsonify({ class: [] }); } // 简化首页
async function category(tid, pg) { return jsonify({ list: [] }); } // 简化分类
async function detail(id) { return getTracks({ vod_id: id }); } // 确保将 id 传递给 getTracks

log('==== 插件加载完成 Final V3 ====');
