/**
 * reboys.cn 前端插件 - V38-Final-Architecture (最终架构版)
 * 
 * 核心修复：
 * - 采用前后端分离架构，前端只负责传递ID，后端负责解析ID和获取链接，彻底规避APP框架的ID传递问题。
 * - getTracks 函数逻辑极大简化，不再解析ID，而是调用后端的 /resolve_id 接口。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.107:3000"; // 确保这是您后端服务的正确地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V38] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V38-Final-Architecture ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V38)', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页/分类 (改造) ---
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    try {
        if (!homeCache) {
            log(`[getCards] 获取首页缓存`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
        }
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        if (targetBlock.length === 0) return jsonify({ list: [] });
        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            if (detailPath && title) {
                cards.push({
                    // ★★★ 改造 ★★★
                    // 使用一个简单的、无害的字符串作为ID
                    vod_id: "home_item",
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '首页推荐'
                });
            }
        });
        return jsonify({ list: cards });
    } catch (e) {
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// --- 搜索函数 (保持不变) ---
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 搜索: "${keyword}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);
        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        
        log(`[search] ✅ 后端返回 ${response.list.length} 条结果`);
        return jsonify({ list: response.list });
    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ getTracks函数 - 最终架构：前端只做信使，调用后端解析 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    const compositeId = ext.vod_id || '';
    log(`[getTracks] 收到ID: "${compositeId}"`);

    // 1. 检查是否为首页UI项
    if (compositeId === 'home_item') {
        log(`[getTracks] 拦截到首页UI项点击，不执行操作。`);
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '此为UI展示项，请使用搜索功能获取内容', pan: '' }] }] });
    }
    
    if (!compositeId) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: 'ID为空，无法获取链接', pan: '' }] }] });
    }

    // 2. 将ID原封不动地发送给后端进行解析
    log(`[getTracks] 将ID发送给后端 /resolve_id 接口进行解析`);
    try {
        const url = `${BACKEND_URL}/resolve_id?id=${encodeURIComponent(compositeId)}`;
        const fetchResult = await $fetch.get(url);
        const response = argsify(fetchResult.data || fetchResult);

        if (!response.success || !response.links) {
            throw new Error(`后端解析失败: ${response.message || '未知错误'}`);
        }

        const links = response.links;
        log(`[getTracks] ✅ 成功从后端获取到 ${links.length} 个链接`);

        if (links.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
        }

        // 3. 渲染从后端获取到的链接 (此部分逻辑不变)
        const tracks = links.map((linkData, index) => {
            const url = linkData.url || '';
            const password = linkData.password || '';
            
            let panType = '网盘';
            if (linkData.type === 'quark' || url.includes('quark.cn')) panType = '夸克';
            else if (linkData.type === 'aliyun' || url.includes('aliyundrive.com')) panType = '阿里';
            else if (linkData.type === 'baidu' || url.includes('pan.baidu.com')) panType = '百度';
            
            const buttonName = `${panType}网盘 ${index + 1}`;
            const finalUrl = url;
            const nameWithPassword = password ? `${buttonName}（密码:${password}）` : buttonName;

            return { 
                name: nameWithPassword, 
                pan: finalUrl,
                ext: {} 
            };
        });

        log(`[getTracks] ✅ 渲染 ${tracks.length} 个链接按钮`);
        return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `获取链接失败: ${e.message}`, pan: '' }] }] });
    }
}

// --- 播放函数 (备用) ---
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    if (id && (id.startsWith('http' ) || id.startsWith('//'))) {
        return jsonify({ parse: 0, url: id, header: {} });
    }
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }

log('==== 插件加载完成 V38-Final-Architecture ====');
