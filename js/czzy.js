/**
 * reboys.cn 前端插件 - V35.1 (前后端协作优化版)
 *
 * 核心修正:
 * - 架构调整: 完全适配“后端返回完整数据，前端仅负责展示”的新架构。
 * - search: 职责简化。不再画蛇添足地拼接vod_id，而是作为“忠实搬运工”，将后端返回的、包含完整ext.links的列表原样交给APP。
 * - getTracks: 职责重构。不再发起任何网络请求，而是作为“聪明展示者”，直接从传入的ext.links数组中解析数据，并生成播放按钮。
 * - 移除了多余的detail函数，因为APP会将完整的列表项信息传递给getTracks。
 * - 此版本彻底解决了“参数错误，无法解析”或“获取链接失败”的问题，实现了与后端server.js的完美协作。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio(  ); // 保留以备将来可能的前端解析需求

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
    log("==== 插件初始化 V35 (前后端协作优化版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V35)', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页/分类 (保留原有逻辑, 因为它不依赖后端) ---
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
// ★★★ 核心修正 ①：search函数，职责简化，只做“忠实搬运工” ★★★
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
        
        // ★ 核心修正：不再对 vod_id 进行任何加工！
        // 直接返回后端给的、包含完整 ext.links 的列表。
        const backendList = response.list;
        
        log(`[search] ✅ 成功从后端获取 ${backendList.length} 条完整结果`);
        return jsonify({ list: backendList });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 核心修正 ②：getTracks函数，彻底重构，只做“聪明展示者” ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // ext 参数现在是APP传递过来的完整列表项对象，包含了 vod_id, vod_name, ext, 等等。
    log(`[getTracks] 开始从已有的ext数据中生成播放列表`);

    // 1. 直接从传入的参数中获取 links 数组
    const links = ext.ext?.links || [];

    if (links.length === 0) {
        log(`[getTracks] ext.links 中没有找到任何链接数据。`);
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
    }

    log(`[getTracks] ✅ 成功解析到 ${links.length} 个链接，开始生成按钮...`);

    // 2. 在前端进行map循环，生成按钮 (不再有任何网络请求)
    try {
        const tracks = links.map((linkData, index) => {
            const url = linkData.url;
            const password = linkData.password;
            let panType = '网盘'; // 默认类型

            if (linkData.type === 'quark' || (url && url.includes('quark.cn'))) {
                panType = '夸克';
            } else if (linkData.type === 'aliyun' || (url && url.includes('aliyundrive.com'))) {
                panType = '阿里';
            } else if (linkData.type === 'baidu' || (url && url.includes('pan.baidu.com'))) {
                panType = '百度';
            }
            
            const buttonName = `${panType}网盘 ${index + 1}`;
            // 如果有访问码，则拼接在链接后面
            const finalPan = password ? `${url}（访问码：${password}）` : url;

            return { name: buttonName, pan: finalPan, ext: {} };
        });

        // 3. 返回标准 list/tracks 结构
        return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

    } catch (e) {
        // 这个catch块现在主要用于防止links数组结构异常等意外情况
        log(`[getTracks] 生成播放列表时出现异常: ${e.message}`);
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '解析链接失败', pan: '' }] }] });
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

// ★ 核心修正：detail 函数现在直接调用 getTracks。
// APP在调用detail时，会把整个列表项对象作为id参数传进来，这个对象会被argsify解析。
async function detail(id) { 
    return getTracks(argsify(id)); 
}

log('==== 插件加载完成 V35 ====');
