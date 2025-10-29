/**
 * reboys.cn 前端插件 - V26.0 (基于V21修改的最终版)
 * 
 * 核心修改:
 * - 严格遵循“后端做饭，前端吃饭”原则。
 * - search函数: 简化为只请求后端/search接口，并直接返回后端处理好的列表。移除前端缓存和解析逻辑。
 * - detail/getTracks函数: 简化为只接收纯净链接字符串(vod_id)，并将其包装成 {pan: ...} 结构返回。
 * - 其他所有函数和结构保持V21版本不变。
 */

// --- 配置区 (保持不变) ---
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 (searchCache不再需要，但保留以防万一) ---
let searchCache = {};
let homeCache = null;

// --- 辅助函数 (保持不变) ---
function log(msg) { 
    const logMsg = `[reboys V25] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- getConfig (保持不变) ---
async function getConfig() {
    log("==== 插件初始化 V25 (基于V21修改) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V25)', 
        site: SITE_URL, 
        tabs: CATEGORIES 
    });
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


// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 核心修改 1: 重写 search 函数 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1; // page参数保留，但后端V20已不支持分页
    
    if (!keyword) {
        log('[search] 关键词为空');
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
    
    log(`[search] 搜索: "${keyword}"`);
    
    try {
        // 直接请求后端，后端会完成所有工作
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { 
            headers: { 'User-Agent': UA },
            timeout: 45000 // 给Puppeteer足够长的超时时间
        });
        
        const response = argsify(fetchResult.data || fetchResult);
        
        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        
        log(`[search] ✅ 后端一步到位返回 ${response.list.length} 条结果`);
        
        // 后端已经处理好了一切，直接返回它的结果
        // V20后端不支持分页，所以pagecount和total可能不准，但list是正确的
        return jsonify({
            list: response.list,
            page: 1,
            pagecount: 1, 
            total: response.list.length
        });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}


// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 核心修改 2: 重写 getTracks/detail 函数 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // 在V20后端模式下，ext.vod_id 就是后端处理好的纯净链接字符串
    const pureLinkString = ext.vod_id;
    log(`[getTracks] 接收到纯净链接字符串: ${pureLinkString}`);
    
    // 直接将这个纯净链接字符串放入pan字段
    return jsonify({
        list: [{
            title: '网盘资源', // 分组标题
            tracks: [{
                name: '点击获取', // 名字不重要
                pan: pureLinkString,
                ext: {}
            }]
        }]
    });
}


// --- 播放函数 (保持不变) ---
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    if (id && (id.startsWith('http' ) || id.startsWith('//'))) {
        log(`[play] 返回网盘链接: ${id.substring(0, 50)}...`);
        return jsonify({ parse: 0, url: id, header: {} });
    }
    log(`[play] 无效的播放ID`);
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 (保持不变) ---
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

// detail入口函数现在调用我们重写后的、极简的getTracks
async function detail(id) { 
    return getTracks({ vod_id: id }); 
}

log('==== 插件加载完成 V25 ====');
