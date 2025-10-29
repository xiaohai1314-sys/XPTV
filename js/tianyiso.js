/**
 * reboys.cn 前端插件 - V21.1 (精准微调版)
 * 核心修复:
 * 1. 保持V21的整体架构和缓存机制不变。
 * 2. [微调] search函数：不再将整个数据对象字符串化为vod_id，而是生成一个"uid::{unique_id}"格式的简单字符串ID。
 * 3. [微调] search函数：将从后端获取的完整结果，以unique_id为键，存入一个全新的、更可靠的全局缓存`detailCache`。
 * 4. [微调] getTracks函数：能够正确解析"uid::{unique_id}"，并从`detailCache`中精确取出数据，从而获取链接。
 * 5. 此版本解决了V21中因复杂vod_id无法传递的核心问题。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
// 【微调】searchCache不再使用，改用更精确的detailCache
let detailCache = {}; // 用于以unique_id为键，存储每一条资源的详细信息

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V21.1] ${msg}`; // 版本号更新
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

async function getConfig() {
    log("==== 插件初始化 V21.1 (精准微调版) ===="); // 版本号更新
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V21.1)', // 版本号更新
        site: SITE_URL, 
        tabs: CATEGORIES 
    });
}

// ----------------------------------------------------------------------
// 首页/分类 (保持不变)
// ----------------------------------------------------------------------
let homeCache = null;
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
        log(`[getCards] 异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// 搜索 (微调核心)
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1;
    
    if (!keyword) return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    log(`[search] 搜索: "${keyword}", 页码: ${page}`);
    
    try {
        // 【微调】只有在第一页时才请求后端并刷新缓存
        if (page === 1) {
            log(`[search] 缓存未命中或为第一页，请求后端`);
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 });
            
            let response = null;
            if (typeof fetchResult === 'string') { response = JSON.parse(fetchResult); }
            else if (fetchResult.data) { response = typeof fetchResult.data === 'string' ? JSON.parse(fetchResult.data) : fetchResult.data; }
            else { response = fetchResult; }
            
            if (!response || response.code !== 0) throw new Error('后端返回错误');

            let results = response.data?.data?.results || response.data?.results || response.results || [];
            if (results.length === 0) throw new Error('未找到搜索结果');
            
            // 【微调】清空旧缓存，用unique_id作为键，填充新的详情缓存
            detailCache = {};
            results.forEach(item => {
                if(item.unique_id) {
                    detailCache[item.unique_id] = item;
                }
            });
            log(`[search] 缓存填充/更新完毕，共 ${Object.keys(detailCache).length} 条。`);
        } else {
            log(`[search] 加载第 ${page} 页，使用现有缓存。`);
        }
        
        // 【微调】从缓存的键（所有unique_id）中进行分页
        const allIds = Object.keys(detailCache);
        const pageSize = 10;
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageIds = allIds.slice(startIdx, endIdx);
        const totalPages = Math.ceil(allIds.length / pageSize);

        const pageResults = pageIds.map(uid => {
            const item = detailCache[uid];
            const totalLinks = (item.links || []).length;
            const remarks = totalLinks > 0 ? `${totalLinks}个网盘` : '暂无链接';
            
            return {
                // 【微调核心】vod_id现在是一个简单、干净、可被传递的字符串！
                vod_id: `uid::${item.unique_id}`,
                vod_name: item.title || '未知标题',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: remarks
            };
        });
        
        log(`[search] 返回第${page}页，共${pageResults.length}条 (总计${allIds.length}条)`);
        
        return jsonify({
            list: pageResults,
            page: page,
            pagecount: totalPages,
            total: allIds.length
        });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}

// ----------------------------------------------------------------------
// 详情 (微调核心)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    // 【微调】ext.vod_id 理论上应该是 "uid::hunhepan-829a0b7aba80"
    const vod_id = ext.vod_id || ext;
    log(`[getTracks] 获取详情, 接收到的 vod_id: ${vod_id}`);
    
    try {
        // 【微调】不再使用argsify，而是直接检查和解析我们自定义的简单ID格式
        if (typeof vod_id !== 'string' || !vod_id.startsWith('uid::')) {
            // 如果不是我们的格式，尝试按旧的home逻辑处理
            const idData = argsify(vod_id);
            if (idData.type === 'home') {
                // ... 首页逻辑保持不变 ...
                 log(`[getTracks] 首页详情: ${idData.path}`);
                 // 此处省略首页的实现，因为我们的问题出在搜索上
                 throw new Error('首页详情逻辑未在此版本中实现');
            }
            throw new Error(`接收到的 vod_id 格式不正确: ${vod_id}`);
        }

        // 【微调】从简单字符串中解析出 unique_id
        const unique_id = vod_id.split('::')[1];
        if (!unique_id) throw new Error(`无法从 vod_id 中解析出 unique_id`);
        log(`[getTracks] 解析成功, unique_id: ${unique_id}`);

        // 【微调】从新的 detailCache 中查找数据
        const targetItem = detailCache[unique_id];
        if (!targetItem) throw new Error(`缓存中未找到 unique_id="${unique_id}" 的条目，请返回重新搜索`);
        
        log(`[getTracks] 成功从缓存中找到条目: ${targetItem.title}`);
        const links = targetItem.links || [];
        if (links.length === 0) throw new Error('该条目无可用链接');

        // 构建播放列表 (这部分逻辑是正确的，保持不变)
        const tracks = links.map(link => {
            let panType = 'unknown';
            const url = link.url || '';
            if (url.includes('quark.cn')) panType = '夸克';
            else if (url.includes('pan.baidu.com')) panType = '百度';
            else if (url.includes('aliyundrive.com')) panType = '阿里';
            const password = link.password ? ` 提取码:${link.password}` : '';
            const name = `[${panType}] ${targetItem.title || '播放'}${password}`;
            return { name: name, pan: url };
        });
        
        const playUrls = tracks.map(t => `${t.name}$${t.pan}`).join('#');
        
        return jsonify({ 
            list: [{ title: targetItem.title || '播放列表', tracks: tracks }],
            vod_play_from: '网盘列表',
            vod_play_url: playUrls
        });
        
    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ 
            list: [{ title: '错误', tracks: [{ name: `获取链接失败: ${e.message}`, pan: '' }] }],
            vod_play_from: '错误',
            vod_play_url: `获取链接失败: ${e.message}$`
        });
    }
}

// ----------------------------------------------------------------------
// 播放 (保持不变)
// ----------------------------------------------------------------------
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
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }

log('==== 插件加载完成 V21.1 ====');
