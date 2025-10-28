/**
 * reboys.cn 前端插件 - V23.0 (终极修复版)
 * 核心修复:
 * 1. 详情页(getTracks)逻辑重构，正确使用后端传入的独立链接标题。
 * 2. 增强 getTracks 函数的健壮性，防止因数据格式问题导致崩溃。
 * 3. 优化链接名称显示格式，包含网盘类型、独立标题和密码。
 * 4. 保持原有缓存、分页等功能不变。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let searchCache = {};
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V23] ${msg}`;
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
    log("==== 插件初始化 V23 (终极修复版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V23)', 
        site: SITE_URL, 
        tabs: CATEGORIES 
    });
}

// ----------------------------------------------------------------------
// 首页/分类 (无变化)
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
// 搜索 (无变化)
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
            log(`[search] 缓存未命中，请求后端`);
            
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            let response = null;
            if (typeof fetchResult === 'string') response = JSON.parse(fetchResult);
            else if (typeof fetchResult === 'object' && fetchResult !== null) {
                if (fetchResult.data) response = (typeof fetchResult.data === 'string') ? JSON.parse(fetchResult.data) : fetchResult.data;
                else if (fetchResult.code !== undefined) response = fetchResult;
            }
            
            if (!response || response.code !== 0) {
                log(`[search] 后端返回错误或无响应`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }

            let results = response.data?.data?.results || response.data?.results || response.results || [];
            
            if (!results || !Array.isArray(results) || results.length === 0) {
                log(`[search] 未找到搜索结果`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }
            
            allResults = results.map(item => {
                // 后端已经处理好 links 数组，这里直接使用
                const vod_id_data = {
                    type: 'search',
                    title: item.title || '未知标题',
                    links: item.links || [], // links 数组现在由后端 V18+ 生成
                    image: item.image || FALLBACK_PIC
                };
                
                const totalLinks = (item.links || []).length;
                const remarks = totalLinks > 0 ? `${totalLinks}个网盘` : '暂无链接';

                return {
                    vod_id: jsonify(vod_id_data),
                    vod_name: item.title || '未知标题',
                    vod_pic: item.image || FALLBACK_PIC,
                    vod_remarks: remarks
                };
            });
            
            searchCache[cacheKey] = allResults;
            log(`[search] 缓存 ${allResults.length} 条结果`);
        } else {
            log(`[search] 使用缓存，共 ${allResults.length} 条结果`);
        }
        
        const pageSize = 10;
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageResults = allResults.slice(startIdx, endIdx);
        const totalPages = Math.ceil(allResults.length / pageSize);
        
        log(`[search] 返回第${page}页，共${pageResults.length}条 (总计${allResults.length}条)`);
        
        return jsonify({
            list: pageResults,
            page: page,
            pagecount: totalPages,
            total: allResults.length
        });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}

// ----------------------------------------------------------------------
// 详情 (V23 - 使用独立的链接标题)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    log(`[getTracks V23] 获取详情`);
    
    try {
        const idData = argsify(vod_id);
        const links = idData.links || [];
        const mainTitle = idData.title || '播放列表'; // 主标题作为备用
        
        log(`[getTracks V23] 主标题: "${mainTitle}", 链接数: ${links.length}`);
        
        if (idData.type === 'search') {
            if (links.length === 0) {
                return jsonify({ 
                    list: [{ title: '播放列表', tracks: [{ name: '暂无可用链接', pan: '' }] }],
                    vod_play_from: '播放列表',
                    vod_play_url: '暂无可用链接$'
                });
            }
            
            const tracks = links.map((link) => {
                if (typeof link !== 'object' || !link.url) return null;

                const url = link.url;
                // ===== 核心修改：直接使用 link.title =====
                // 优先使用链接自带的标题，如果不存在，则使用主标题
                const trackTitle = link.title || mainTitle; 
                const password = link.password ? ` 码:${link.password}` : '';
                let panType = link.type || '未知';

                // 双重检查网盘类型
                if (panType === '未知' || !panType) {
                    if (url.includes('quark.cn')) panType = '夸克';
                    else if (url.includes('aliyundrive.com') || url.includes('alipan.com')) panType = '阿里';
                    else if (url.includes('pan.baidu.com')) panType = '百度';
                }
                
                const name = `[${panType.toUpperCase()}] ${trackTitle}${password}`;
                
                log(`[getTracks V23] 添加轨道: ${name}`);
                
                return { name: name, pan: url };
            }).filter(t => t !== null);

            if (tracks.length === 0) throw new Error("所有链接项均无效");

            const playUrls = tracks.map(t => `${t.name}$${t.pan}`).join('#');
            
            return jsonify({ 
                list: [{ title: mainTitle, tracks: tracks }],
                vod_play_from: '网盘列表',
                vod_play_url: playUrls
            });
        } 
        else if (idData.type === 'home') {
            log(`[getTracks V23] 首页详情: ${idData.path}`);
            
            const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;
            const { data } = await $fetch.get(url, {
                headers: { 'User-Agent': UA }
            });
            
            if (data.success) {
                const trackName = data.data.pwd 
                    ? `点击播放 提取码:${data.data.pwd}` 
                    : '点击播放';
                const playUrl = `${trackName}$${data.data.pan}`;
                    
                log(`[getTracks V23] 首页详情解析成功`);
                
                return jsonify({ 
                    list: [{ title: '播放列表', tracks: [{ name: trackName, pan: data.data.pan }] }],
                    vod_play_from: '网盘',
                    vod_play_url: playUrl
                });
            } else {
                throw new Error(`后端详情解析失败: ${data.message}`);
            }
        } 
        else {
            throw new Error(`未知的 vod_id 类型: ${idData.type}`);
        }
    } catch (e) {
        log(`[getTracks V23] 致命异常: ${e.message}`);
        return jsonify({ 
            list: [{ title: '错误', tracks: [{ name: '获取链接失败', pan: '' }] }],
            vod_play_from: '错误',
            vod_play_url: '获取链接失败$'
        });
    }
}


// ----------------------------------------------------------------------
// 播放 (无变化)
// ----------------------------------------------------------------------
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    
    if (id && (id.startsWith('http' ) || id.startsWith('//'))) {
        log(`[play] 返回网盘链接: ${id.substring(0, 50)}...`);
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

// --- 兼容接口 ---
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

log('==== 插件加载完成 V23 ====');
