/**
 * reboys.cn 前端插件 - V35-AppFriendly (APP纯净链接专用版)
 * 
 * 核心修复：将后端返回的 links 数组转换为 APP 可识别的纯净 URL 字符串
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio();

// --- 全局缓存 ---
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V35] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V35-AppFriendly ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V35)', site: SITE_URL, tabs: CATEGORIES });
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
// ★★★ getTracks函数 - 关键修复：将 links 数组转换为纯净 URL ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
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

        // 2. ★★★ 关键修复：将 links 数组转换为 APP 可识别的纯净 URL 字符串 ★★★
        const tracks = links.map((linkData, index) => {
            const url = linkData.url || '';
            const password = linkData.password || '';
            
            // 识别网盘类型
            let panType = '网盘';
            if (linkData.type === 'quark' || url.includes('quark.cn')) panType = '夸克';
            else if (linkData.type === 'aliyun' || url.includes('aliyundrive.com')) panType = '阿里';
            else if (linkData.type === 'baidu' || url.includes('pan.baidu.com')) panType = '百度';
            
            // 按钮名称
            const buttonName = `${panType}网盘 ${index + 1}`;
            
            // ★★★ 核心修复：pan 字段必须是纯净的 URL 字符串 ★★★
            // 如果有密码，将密码拼接在 URL 后面（用特殊分隔符，让APP自己解析）
            // 但根据您的需求，APP可能无法处理复杂格式，所以这里只返回纯URL
            const finalUrl = url; // 只返回纯净URL
            
            // 如果需要传递密码，可以在 name 中显示
            const nameWithPassword = password ? `${buttonName}（密码:${password}）` : buttonName;

            return { 
                name: nameWithPassword, 
                pan: finalUrl,  // ★★★ 纯净URL字符串 ★★★
                ext: {} 
            };
        });

        // 3. 返回标准 list/tracks 结构
        log(`[getTracks] ✅ 返回 ${tracks.length} 个纯净链接给APP`);
        return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        const errorMessage = e.message.includes('缓存') ? e.message : '获取链接失败, 请尝试重新搜索';
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: errorMessage, pan: '' }] }] });
    }
}

// --- 播放函数 (备用) ---
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    if (id && (id.startsWith('http') || id.startsWith('//'))) {
        return jsonify({ parse: 0, url: id, header: {} });
    }
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }

log('==== 插件加载完成 V35-AppFriendly ====');
