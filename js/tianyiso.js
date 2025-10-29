/**
 * reboys.cn 前端插件 - V22.0 (最终修复版)
 * 变更日志:
 * 1. [根本性修复] 重构 search 和 getTracks 函数，解决点击搜索结果后无法识别链接的问题。
 * 2. [架构优化] 采用“后端获取 -> 前端缓存 -> ID关联”的模式，替代不稳定的长字符串 vod_id 传递。
 * 3. [健壮性提升] vod_id 改为存储包含 unique_id 和 keyword 的轻量级 JSON，确保在 App 环境中传递的稳定性。
 * 4. [逻辑闭环] getTracks 函数通过 unique_id 从全局缓存中精确查找数据，完成逻辑闭环。
 * 5. [代码整合] 提供完整、可直接替换的脚本。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000"; // 请确保这是你后端服务的正确地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
// searchCache 用于存储从后端获取的完整搜索结果
// 键为 `search_关键词`，值为后端返回的 results 数组
let searchCache = {}; 
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V22] ${msg}`;
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
            // 如果解析失败，返回空对象，避免程序崩溃
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
    log("==== 插件初始化 V22 (最终修复版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V22)', 
        site: SITE_URL, 
        tabs: CATEGORIES 
    });
}

// ----------------------------------------------------------------------
// 首页/分类 (保持原样)
// ----------------------------------------------------------------------
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    
    try {
        if (!homeCache) {
            log(`[getCards] 获取首页缓存`);
            const { data } = await $fetch.get(SITE_URL, { 
                headers: { 'User-Agent': UA } 
            });
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

// ----------------------------------------------------------------------
// 搜索 (核心修复：使用缓存和轻量级 vod_id)
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
            const fetchResult = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 30000 // 适当延长超时以等待后端Puppeteer完成
            });
            
            let response = JSON.parse(fetchResult.data || fetchResult);
            
            if (!response || response.code !== 0) {
                const errorMsg = response ? response.message : '无响应';
                log(`[search] 后端返回错误: ${errorMsg}`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }

            const results = response.data?.data?.results || [];
            
            if (results.length === 0) {
                log(`[search] 后端未返回有效结果`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }
            
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
        
        const list = pageData.map(item => {
            const totalLinks = (item.links || []).length;
            const remarks = totalLinks > 0 ? `${totalLinks}个网盘` : '暂无链接';

            return {
                vod_id: jsonify({ 
                    type: 'search', 
                    unique_id: item.unique_id, 
                    keyword: keyword 
                }),
                vod_name: item.title || '未知标题',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: remarks
            };
        });
        
        log(`[search] 返回第${page}页，共${list.length}条`);
        
        return jsonify({
            list: list,
            page: page,
            pagecount: totalPages,
            total: allResults.length
        });

    } catch (e) {
        log(`[search] 发生严重异常: ${e.message}`);
        delete searchCache[`search_${keyword}`];
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}

// ----------------------------------------------------------------------
// 详情 (核心修复：通过 unique_id 从缓存中获取链接)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    log(`[getTracks] 开始获取详情, vod_id: ${vod_id}`);
    
    try {
        const idData = argsify(vod_id);
        log(`[getTracks] 解析后类型: ${idData.type}`);
        
        if (idData.type === 'search' && idData.unique_id && idData.keyword) {
            const { unique_id, keyword } = idData;
            log(`[getTracks] 搜索类型, unique_id: ${unique_id}, keyword: ${keyword}`);
            
            const cacheKey = `search_${keyword}`;
            const cachedResults = searchCache[cacheKey];
            
            if (!cachedResults) {
                throw new Error(`缓存丢失，无法找到 keyword="${keyword}" 的结果，请返回并重新搜索`);
            }
            
            const targetItem = cachedResults.find(item => item.unique_id === unique_id);

            if (!targetItem) {
                throw new Error(`在缓存中未找到 unique_id="${unique_id}" 的条目`);
            }
            
            const links = targetItem.links || [];
            log(`[getTracks] 成功从缓存找到条目，链接数: ${links.length}`);
            
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
        } 
        else if (idData.type === 'home') {
            log(`[getTracks] 首页详情: ${idData.path}`);
            // 保持你原来的首页详情逻辑，如果需要的话
            // 示例：返回一个提示
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '首页详情功能待实现', pan: '' }] }] });
        } 
        else {
            throw new Error(`无法识别的 vod_id 类型或内容: ${vod_id}`);
        }
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
    log(`[play] flag=${flag}, id=${id}`);
    
    if (id && (id.startsWith('http' ) || id.startsWith('//'))) {
        log(`[play] 返回网盘链接: ${id.substring(0, 80)}...`);
        return jsonify({ 
            parse: 0,
            url: id,
            header: {}
        });
    }
    
    log(`[play] 无效的播放ID`);
    return jsonify({ 
        parse: 0,
        url: '',
        header: {}
    });
}

// --- 兼容接口 (保持原样) ---
async function init() { 
    return getConfig(); 
}

async function home() { 
    const c = await getConfig(); 
    return jsonify({ 
        class: JSON.parse(c).tabs 
    }); 
}

async function category(tid, pg) { 
    return getCards({ 
        id: (argsify(tid)).id || tid, 
        page: pg || 1 
    }); 
}

async function detail(id) { 
    return getTracks({ vod_id: id }); 
}

log('==== 插件加载完成 V22 ====');

