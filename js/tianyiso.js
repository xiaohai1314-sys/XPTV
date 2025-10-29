/**
 * reboys.cn 前端插件 - V34.0 (100%完整最终分隔符版)
 * 
 * 最终正确架构:
 * - search: 请求/search，获取轻量列表，vod_id是【纯净ID@@@keyword】的安全字符串。
 * - detail: 接收到安全字符串后，用 split('@@@') 拆分出【纯净ID】和【keyword】。
 * - getTracks: 用纯净ID和keyword请求/get_links，获取【完整的links数组】后进行map循环。
 * - 此架构是唯一经过所有失败验证后，得出的最稳健、最正确的方案。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V34] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V34 (完整最终分隔符版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V34)', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页/分类 (保留原有逻辑) ---
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
                    vod_id: jsonify({ type: 'home', path: detailPath }),
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

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 核心修正：search函数，使用安全分隔符拼接vod_id ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
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
        
        // ★ 核心：使用安全分隔符拼接ID和keyword
        const listWithSafeId = response.list.map(item => {
            item.vod_id = `${item.vod_id}@@@${keyword}`; // "simple_id@@@keyword"
            return item;
        });
        
        log(`[search] ✅ 后端返回 ${listWithSafeId.length} 条轻量结果`);
        return jsonify({ list: listWithSafeId });
    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 核心修正：getTracks函数，使用split拆分安全字符串 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // ext.vod_id 是一个安全字符串: "simple_id@@@keyword"
    const safeId = ext.vod_id || '';
    const parts = safeId.split('@@@');
    
    if (parts.length !== 2) {
        log(`[getTracks] 接收到的vod_id格式错误: ${safeId}`);
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '参数错误，无法解析', pan: '' }] }] });
    }

    const simpleId = parts[0];
    const keyword = parts[1];
    
    log(`[getTracks] 开始请求详情, id=${simpleId}, keyword=${keyword}`);

    try {
        // 1. 用纯净ID和keyword去后端换取完整的links数组
        const url = `${BACKEND_URL}/get_links?id=${encodeURIComponent(simpleId)}&keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url);
        const response = argsify(fetchResult.data || fetchResult);

        if (!response.success || !response.links) {
            throw new Error(`后端/get_links接口错误: ${response.message}`);
        }

        const links = response.links;
        log(`[getTracks] ✅ 成功从后端获取到 ${links.length} 个链接`);

        if (links.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
        }

        // 2. 在前端进行map循环，生成按钮
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
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '获取链接失败', pan: '' }] }] });
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

log('==== 插件加载完成 V34 ====');
