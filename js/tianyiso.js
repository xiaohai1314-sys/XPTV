/**
 * reboys.cn 前端插件 - V20.0 (修复无限加载+网盘识别)
 * 核心修复:
 * 1. 添加搜索缓存机制（参考找盘插件）
 * 2. 完善分页结构返回
 * 3. 修复网盘链接识别和播放
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio();

// --- 全局缓存 ---
let searchCache = {}; // 核心：添加搜索缓存

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V21] ${msg}`;
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
    log("==== 插件初始化 V21 (修复版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V21)', 
        site: SITE_URL, 
        tabs: CATEGORIES 
    });
}

// ----------------------------------------------------------------------
// 首页/分类
// ----------------------------------------------------------------------
let homeCache = null;

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
// 搜索 (核心修复：添加缓存机制)
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
        // 缓存键：关键词
        const cacheKey = `search_${keyword}`;
        let allResults = searchCache[cacheKey];
        
        // 缓存未命中，请求后端
        if (!allResults) {
            log(`[search] 缓存未命中，请求后端`);
            
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            // 解析响应
            let response = null;
            
            if (typeof fetchResult === 'string') {
                response = JSON.parse(fetchResult);
            } else if (typeof fetchResult === 'object' && fetchResult !== null) {
                if (fetchResult.data) {
                    if (typeof fetchResult.data === 'string') {
                        response = JSON.parse(fetchResult.data);
                    } else {
                        response = fetchResult.data;
                    }
                } else if (fetchResult.code !== undefined) {
                    response = fetchResult;
                }
            }
            
            if (!response || response.code !== 0) {
                log(`[search] 后端返回错误或无响应`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }

            // 提取结果（多路径兼容）
            let results = null;
            
            if (response.data?.data?.results) {
                results = response.data.data.results;
                log(`[search] 路径1: response.data.data.results`);
            } else if (response.data?.results) {
                results = response.data.results;
                log(`[search] 路径2: response.data.results`);
            } else if (response.results) {
                results = response.results;
                log(`[search] 路径3: response.results`);
            }
            
            if (!results || !Array.isArray(results) || results.length === 0) {
                log(`[search] 未找到搜索结果`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }
            
            // 映射并缓存所有结果
            allResults = results.map(item => {
                const vod_id_data = {
                    type: 'search',
                    title: item.title || '未知标题',
                    links: item.links || [],
                    image: item.image || FALLBACK_PIC
                };
                
                const totalLinks = (item.links || []).length;
                const remarks = totalLinks > 0 
                    ? `${totalLinks}个网盘` 
                    : '暂无链接';

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
        
        // 分页处理（每页10条）
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
// 详情 (核心修复：返回完整的播放信息结构)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    log(`[getTracks] 获取详情`);
    
    try {
        const idData = argsify(vod_id);
        log(`[getTracks] 类型: ${idData.type}`);
        
        if (idData.type === 'search') {
            const links = idData.links || [];
            log(`[getTracks] 搜索结果，链接数: ${links.length}`);
            
            if (links.length === 0) {
                return jsonify({ 
                    list: [{ 
                        title: '播放列表', 
                        tracks: [{ 
                            name: '暂无可用链接', 
                            pan: '' 
                        }] 
                    }],
                    vod_play_from: '播放列表',
                    vod_play_url: '暂无可用链接$'
                });
            }
            
            // 构建播放列表
            const tracks = links.map((link, index) => {
                // 识别网盘类型
                let panType = 'unknown';
                const url = link.url || '';
                
                if (url.includes('quark.cn') || link.type === 'quark') {
                    panType = '夸克';
                } else if (url.includes('pan.baidu.com') || link.type === 'baidu') {
                    panType = '百度';
                } else if (url.includes('aliyundrive.com') || link.type === 'aliyun') {
                    panType = '阿里';
                } else if (url.includes('115.com') || link.type === '115') {
                    panType = '115';
                } else if (url.includes('189.cn') || link.type === 'tianyi') {
                    panType = '天翼';
                } else if (link.type) {
                    panType = link.type.toUpperCase();
                }
                
                const password = link.password ? ` 提取码:${link.password}` : '';
                const name = `[${panType}] ${idData.title || '播放'}${password}`;
                
                log(`[getTracks] 添加: ${name}`);
                
                return { 
                    name: name, 
                    pan: url 
                };
            });
            
            // 构建 vod_play_url 格式（用$分隔多个链接）
            const playUrls = tracks.map(t => `${t.name}$${t.pan}`).join('#');
            
            log(`[getTracks] 返回 ${tracks.length} 个播放链接`);
            
            return jsonify({ 
                list: [{ 
                    title: idData.title || '播放列表', 
                    tracks: tracks 
                }],
                vod_play_from: '网盘列表',
                vod_play_url: playUrls
            });
        } 
        else if (idData.type === 'home') {
            log(`[getTracks] 首页详情: ${idData.path}`);
            
            const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;
            const { data } = await $fetch.get(url, {
                headers: { 'User-Agent': UA }
            });
            
            if (data.success) {
                const trackName = data.data.pwd 
                    ? `点击播放 提取码:${data.data.pwd}` 
                    : '点击播放';
                const playUrl = `${trackName}$${data.data.pan}`;
                    
                log(`[getTracks] 首页详情解析成功`);
                
                return jsonify({ 
                    list: [{ 
                        title: '播放列表', 
                        tracks: [{ 
                            name: trackName, 
                            pan: data.data.pan 
                        }] 
                    }],
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
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ 
            list: [{ 
                title: '播放列表', 
                tracks: [{ 
                    name: '获取链接失败', 
                    pan: '' 
                }] 
            }],
            vod_play_from: '错误',
            vod_play_url: '获取链接失败$'
        });
    }
}

// ----------------------------------------------------------------------
// 播放 (核心修复：正确处理网盘链接)
// ----------------------------------------------------------------------
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    
    // id 就是网盘链接，直接返回
    if (id && (id.startsWith('http') || id.startsWith('//'))) {
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

log('==== 插件加载完成 V21 ====');
