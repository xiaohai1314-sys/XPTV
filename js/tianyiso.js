/**
 * reboys.cn 前端插件 - V32.0 (100%完整V20后端专用版)
 * 
 * 最终逻辑:
 * - search: 请求V20后端的/search接口，获取的列表中，vod_id已经是纯净链接。
 * - detail/getTracks: 直接使用这个纯净链接(vod_id)，并正确地生成带编号的按钮。
 * - 这是对V20后端返回数据的最直接、最正确的处理方式。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 (保留，但search函数不再使用) ---
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V32] ${msg}`;
    try { 
        $log(logMsg); 
    } catch (_) { 
        if (DEBUG) console.log(logMsg); 
    }
}

function argsify(ext) { 
    if (typeof ext === 'string') {
        try { 
            return JSON.parse(ext); 
        } catch (e) { 
            return {}; 
        }
    }
    return ext || {}; 
}

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V32 (V20后端专用版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V32)', 
        site: SITE_URL, 
        tabs: CATEGORIES 
    });
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
        if (targetBlock.length === 0) {
            log(`[getCards] 未找到分类 ${categoryId}`);
            return jsonify({ list: [] });
        }
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
        log(`[getCards] 返回 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[getCards] 异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// --- 搜索函数：获取V20后端返回的完美列表 ---
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
        log(`[search] ✅ V20后端一步到位返回 ${response.list.length} 条结果`);
        return jsonify({ list: response.list }); // 直接返回，不做任何修改
    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 核心函数：getTracks，正确处理V20后端返回的、已经是纯净链接的vod_id ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // ext.vod_id 就是V20后端处理好的纯净链接字符串
    const pureLinkString = ext.vod_id;
    log(`[getTracks] 接收到纯净链接: ${pureLinkString}`);

    if (!pureLinkString || pureLinkString === '暂无链接') {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
    }

    // --- 智能生成按钮名称 ---
    let panType = '网盘';
    if (pureLinkString.includes('quark.cn')) {
        panType = '夸克';
    } else if (pureLinkString.includes('aliyundrive.com')) {
        panType = '阿里';
    } else if (pureLinkString.includes('pan.baidu.com')) {
        panType = '百度';
    }
    
    // 因为V20后端只返回一个链接，所以我们只生成一个按钮，编号为1
    const buttonName = `${panType}网盘 1`;

    // 返回标准的 list/tracks 结构
    return jsonify({
        list: [{
            title: '云盘', // 分组标题
            tracks: [{
                name: buttonName,
                pan: pureLinkString, // pan字段就是纯净链接
                ext: {}
            }]
        }]
    });
}


// --- 播放函数 (备用) ---
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    if (id && (id.startsWith('http' ) || id.startsWith('//'))) {
        log(`[play] 返回网盘链接: ${id.substring(0, 50)}...`);
        return jsonify({ parse: 0, url: id, header: {} });
    }
    log(`[play] 无效的播放ID`);
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 ---
async function init() { 
    return getConfig(); 
}

async function home() { 
    const c = await getConfig(); 
    return jsonify({ class: JSON.parse(c).tabs }); 
}

async function category(tid, pg) { 
    return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); 
}

async function detail(id) { 
    return getTracks({ vod_id: id }); 
}

log('==== 插件加载完成 V32 ====');
