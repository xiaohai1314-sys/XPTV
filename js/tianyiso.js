/**
 * reboys.cn 前端插件 - V24.0 (索引回溯版)
 * 变更日志:
 * 1. [终极方案] 彻底放弃依赖 App 传递 vod_id，改为通过列表索引回溯数据。
 * 2. [新增缓存] 引入 `currentListPageData` 变量，用于临时存储当前页面展示的列表数据。
 * 3. [逻辑重构] `search` 函数在返回列表的同时，填充 `currentListPageData`。
 * 4. [逻辑重构] `detail` 函数的 id 被视为索引，直接从 `currentListPageData` 中获取数据，然后提取链接。
 * 5. [高度兼容] 此方案理论上兼容所有不正确传递 vod_id 的 App 环境。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000"; // 请确保这是你后端服务的正确地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let searchCache = {}; 
let homeCache = null;
// 【V23 新增】用于存储当前页面展示的列表数据
let currentListPageData = [];

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V23] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}

function argsify(ext) { 
    if (typeof ext === 'string') {
        try { return JSON.parse(ext); } catch (e) { return {}; }
    }
    return ext || {}; 
}

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V23 (索引回溯版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V23)', site: SITE_URL, tabs: CATEGORIES });
}

// ----------------------------------------------------------------------
// 首页/分类 (保持原样)
// ----------------------------------------------------------------------
async function getCards(ext) {
    // ... 此处代码与 V22 版本完全相同，为节省篇幅省略 ...
    // ... 实际使用时请保留 V22 版本中的 getCards 完整代码 ...
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
        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            if (detailPath && title) {
                cards.push({ vod_id: detailPath, vod_name: title, vod_pic: imageUrl || FALLBACK_PIC, vod_remarks: '首页推荐' });
            }
        });
        currentListPageData = cards; // 首页也存入当前列表
        log(`[getCards] 返回 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[getCards] 异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// 搜索 (核心修改：填充 currentListPageData)
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1;
    
    if (!keyword) {
        log('[search] 关键词为空');
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
    
    log(`[search] 搜索: "${keyword}", 页码: ${page}`);
    
    try {
        const cacheKey = `search_${keyword}`;
        let allResults = searchCache[cacheKey];
        
        if (!allResults) {
            log(`[search] 缓存未命中，请求后端API`);
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 });
            let response = JSON.parse(fetchResult.data || fetchResult);
            
            if (!response || response.code !== 0) throw new Error(response ? response.message : '后端无响应');

            const results = response.data?.data?.results || [];
            if (results.length === 0) throw new Error('后端未返回有效结果');
            
            allResults = results;
            searchCache[cacheKey] = allResults;
            log(`[search] 成功从后端获取并缓存了 ${allResults.length} 条结果`);
        } else {
            log(`[search] 命中缓存，共 ${allResults.length} 条结果`);
        }
        
        const pageSize = 10;
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageData = allResults.slice(startIdx, endIdx);
        const totalPages = Math.ceil(allResults.length / pageSize);
        
        // 【V23 核心】将当前页的数据存入临时变量
        currentListPageData = pageData;
        log(`[search] 当前页 ${page} 的 ${pageData.length} 条数据已存入临时列表`);

        const list = pageData.map((item, index) => {
            const totalLinks = (item.links || []).length;
            return {
                // vod_id 现在只存储索引，作为最后的备用
                vod_id: index.toString(), 
                vod_name: item.title || '未知标题',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: `${totalLinks}个网盘`
            };
        });
        
        return jsonify({ list: list, page: page, pagecount: totalPages, total: allResults.length });

    } catch (e) {
        log(`[search] 发生严重异常: ${e.message}`);
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}

// ----------------------------------------------------------------------
// 详情 (核心修改：通过索引直接从 currentListPageData 获取)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    // 【V23 核心】ext.vod_id 在这里被我们当作是列表的索引
    const index = parseInt(ext.vod_id, 10);
    log(`[getTracks] 开始获取详情, 接收到的ID/索引为: ${ext.vod_id}`);
    
    try {
        if (isNaN(index) || !currentListPageData || index >= currentListPageData.length) {
            throw new Error(`无效的索引'${index}'或当前列表数据为空`);
        }

        // 直接从当前页的临时缓存中，根据索引取出对应的完整数据
        const targetItem = currentListPageData[index];
        log(`[getTracks] 成功通过索引 ${index} 从临时列表中获取到条目: ${targetItem.title}`);
        
        const links = targetItem.links || [];
        if (links.length === 0) {
            return jsonify({ list: [{ title: '播放列表', tracks: [{ name: '暂无可用链接', pan: '' }] }] });
        }
        
        const tracks = links.map(link => {
            let panType = '未知';
            const url = link.url || '';
            if (url.includes('quark.cn')) panType = '夸克';
            else if (url.includes('pan.baidu.com')) panType = '百度';
            else if (url.includes('aliyundrive.com')) panType = '阿里';
            
            const password = link.password ? ` 码:${link.password}` : '';
            const name = `[${panType}] ${targetItem.title}${password}`;
            
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
            list: [{ title: '错误', tracks: [{ name: `获取链接失败: ${e.message}`, pan: '' }] }] 
        });
    }
}

// ----------------------------------------------------------------------
// 播放 (保持原样)
// ----------------------------------------------------------------------
async function play(flag, id) {
    // ... 此处代码与 V22 版本完全相同 ...
    if (id && (id.startsWith('http' ) || id.startsWith('//'))) {
        return jsonify({ parse: 0, url: id, header: {} });
    }
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 (保持原样) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }

log('==== 插件加载完成 V23 ====');
