/**
 * reboys.cn 前端插件 - V37-JSON-ID (根本性修复版)
 * 
 * 核心修复：
 * 1. 全面采用 JSON 格式的 vod_id，以适应 APP 的底层框架，解决“参数错误”的根源问题。
 * 2. getTracks 函数重构，通过解析 vod_id 中的 type 属性来区分处理搜索结果和首页UI项。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.107:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V37] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V37-JSON-ID ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V37)', site: SITE_URL, tabs: CATEGORIES });
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
                    // 将 vod_id 设置为一个JSON字符串，表明这是一个不可操作的首页项
                    vod_id: jsonify({ type: 'home' }),
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
// ★★★ getTracks函数 - 根本性重构：全面采用 JSON ID 解析 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    const safeId = ext.vod_id || '';
    let idObject;

    try {
        idObject = argsify(safeId);
        if (!idObject || typeof idObject.type === 'undefined') {
            throw new Error('ID对象无效或缺少type属性');
        }
    } catch (e) {
        log(`[getTracks] 接收到的vod_id不是有效的JSON: ${safeId}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: 'ID格式无法识别', pan: '' }] }] });
    }

    // 根据ID类型进行分支处理
    if (idObject.type === 'home') {
        // 拦截首页UI项的点击
        log(`[getTracks] 拦截到首页UI项点击，不执行操作。`);
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '此为UI展示项，请使用搜索功能获取内容', pan: '' }] }] });

    } else if (idObject.type === 'search') {
        // 处理来自搜索的结果
        const { id: simpleId, keyword } = idObject;

        if (simpleId === undefined || !keyword) {
            log(`[getTracks] 搜索ID对象缺少id或keyword: ${safeId}`);
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '搜索参数不完整', pan: '' }] }] });
        }

        log(`[getTracks] 开始请求详情, id=${simpleId}, keyword=${keyword}`);
        try {
            const url = `${BACKEND_URL}/get_links?id=${encodeURIComponent(simpleId)}&keyword=${encodeURIComponent(keyword)}`;
            const fetchResult = await $fetch.get(url);
            const response = argsify(fetchResult.data || fetchResult);

            if (!response.success || !response.links) {
                throw new Error(`后端/get_links接口错误: ${response.message || '未知错误'}`);
            }

            const links = response.links;
            log(`[getTracks] ✅ 成功从后端获取到 ${links.length} 个链接`);

            if (links.length === 0) {
                return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
            }

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

            log(`[getTracks] ✅ 返回 ${tracks.length} 个纯净链接给APP`);
            return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

        } catch (e) {
            log(`[getTracks] 异常: ${e.message}`);
            const errorMessage = e.message.includes('缓存') ? e.message : '获取链接失败, 请尝试重新搜索';
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: errorMessage, pan: '' }] }] });
        }
    } else {
        // 处理未知的ID类型
        log(`[getTracks] 未知的ID类型: ${idObject.type}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '未知的ID类型', pan: '' }] }] });
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

log('==== 插件加载完成 V37-JSON-ID ====');
