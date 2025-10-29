/**
 * reboys.cn 前端插件 - V34-Fix (与后端缓存完美协作版)
 * 
 * 架构说明:
 * - search: 请求后端的/search接口，获取一个“轻量”的结果列表（不含链接）。然后，将列表中的`vod_id`（索引）和`keyword`拼接成 "索引@@@关键词" 的安全字符串，以通过APP的窄通道传递。
 * - detail/getTracks: 接收到安全字符串后，用 split('@@@') 拆分出【索引】和【关键词】。然后用这两个参数去请求后端的/get_links接口。
 * - /get_links: 后端根据关键词从缓存中找到完整的搜索结果，再根据索引定位到具体条目，并返回其包含的【完整的links数组】。
 * - 此架构是为解决“APP只传vod_id”和“大包吃不下”两大核心矛盾而设计的最终方案。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio(  );

// --- 全局缓存 ---
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V34-Fix] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V34-Fix (后端缓存协作版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V34-Fix)', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页/分类 (保持不变) ---
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
// ★★★ search函数，恢复您V34版本的核心逻辑：拼接安全ID ★★★
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
        
        // ★ 核心逻辑：使用安全分隔符拼接ID(索引)和keyword
        const listWithSafeId = response.list.map(item => {
            // item.vod_id 是后端返回的索引 "0", "1", "2"...
            item.vod_id = `${item.vod_id}@@@${keyword}`; // "0@@@帝陵"
            return item;
        });
        
        log(`[search] ✅ 后端返回 ${listWithSafeId.length} 条轻量结果, 已拼接安全ID`);
        return jsonify({ list: listWithSafeId });
    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ getTracks函数，恢复您V34版本的核心逻辑：请求/get_links ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    const safeId = ext.vod_id || '';
    const parts = safeId.split('@@@');
    
    if (parts.length !== 2) {
        log(`[getTracks] 接收到的vod_id格式错误: ${safeId}`);
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '参数错误，无法解析', pan: '' }] }] });
    }

    const simpleId = parts[0]; // 索引
    const keyword = parts[1]; // 关键词
    
    log(`[getTracks] 开始请求详情, id=${simpleId}, keyword=${keyword}`);

    try {
        // 1. 用纯净ID和keyword去后端换取完整的links数组
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
        // 返回更明确的错误信息，方便调试
        const errorMessage = e.message.includes('缓存') ? e.message : '获取链接失败, 请尝试重新搜索';
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: errorMessage, pan: '' }] }] });
    }
}

// --- 播放函数 (备用) ---
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    if (id && (id.startsWith('http'  ) || id.startsWith('//'))) {
        return jsonify({ parse: 0, url: id, header: {} });
    }
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }

log('==== 插件加载完成 V34-Fix ====');
