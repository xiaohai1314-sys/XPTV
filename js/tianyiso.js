/**
 * reboys.cn 前端插件 - V20.0 (修复无限加载和网盘识别)
 * 修复内容:
 * 1. 优化数据解析逻辑，避免无限加载
 * 2. 修复网盘链接识别和播放返回结构
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio();

// --- 辅助函数 ---
function log(msg) { 
    if (DEBUG) {
        console.log(`[reboys插件 V20] ${msg}`); 
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
    log("==== 插件初始化 V20 (修复版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V20)', 
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
            const { data } = await $fetch.get(SITE_URL, { 
                headers: { 'User-Agent': UA } 
            });
            homeCache = data;
        }
        
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        
        if (targetBlock.length === 0) {
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
        
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ [getCards] 异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// 搜索 (核心修复：更健壮的解析 + 详细日志)
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    
    if (!keyword) {
        log('❌ [search] 关键词为空');
        return jsonify({ list: [] });
    }
    
    log(`🔍 [search] 开始搜索: "${keyword}"`);
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
        log(`📡 [search] 请求URL: ${url}`);
        
        const fetchResult = await $fetch.get(url, { 
            headers: { 'User-Agent': UA },
            timeout: 15000
        });
        
        log(`📦 [search] 收到响应，类型: ${typeof fetchResult}`);
        
        // 1. 解析响应体
        let response = null;
        
        if (typeof fetchResult === 'string') {
            try {
                response = JSON.parse(fetchResult);
                log('✅ [search] 成功解析字符串响应');
            } catch (e) {
                log(`❌ [search] JSON解析失败: ${e.message}`);
                return jsonify({ list: [] });
            }
        } else if (typeof fetchResult === 'object' && fetchResult !== null) {
            if (fetchResult.data) {
                if (typeof fetchResult.data === 'string') {
                    try {
                        response = JSON.parse(fetchResult.data);
                        log('✅ [search] 成功解析 fetchResult.data 字符串');
                    } catch (e) {
                        log(`❌ [search] fetchResult.data JSON解析失败: ${e.message}`);
                        return jsonify({ list: [] });
                    }
                } else {
                    response = fetchResult.data;
                    log('✅ [search] 直接使用 fetchResult.data 对象');
                }
            } else if (fetchResult.code !== undefined) {
                response = fetchResult;
                log('✅ [search] 直接使用 fetchResult 对象');
            }
        }
        
        if (!response) {
            log('❌ [search] 无法解析响应体');
            return jsonify({ list: [] });
        }
        
        log(`📊 [search] response.code = ${response.code}`);
        
        // 2. 检查响应状态
        if (response.code !== 0) {
            log(`❌ [search] 后端返回错误: code=${response.code}, message=${response.message}`);
            return jsonify({ list: [] });
        }

        // 3. 提取核心数据（多路径兼容）
        let results = null;
        let total = 0;
        
        // 路径1: response.data.data.results (标准路径)
        if (response.data?.data?.results) {
            results = response.data.data.results;
            total = response.data.data.total || results.length;
            log(`✅ [search] 使用路径1: response.data.data.results, 找到 ${results.length} 条结果`);
        }
        // 路径2: response.data.results
        else if (response.data?.results) {
            results = response.data.results;
            total = response.data.total || results.length;
            log(`✅ [search] 使用路径2: response.data.results, 找到 ${results.length} 条结果`);
        }
        // 路径3: response.results
        else if (response.results) {
            results = response.results;
            total = response.total || results.length;
            log(`✅ [search] 使用路径3: response.results, 找到 ${results.length} 条结果`);
        }
        
        if (!results || !Array.isArray(results) || results.length === 0) {
            log('⚠️ [search] 未找到搜索结果');
            return jsonify({ list: [], total: 0 });
        }
        
        // 4. 映射结果
        const list = results.map((item, index) => {
            const vod_id_data = {
                type: 'search',
                title: item.title || '未知标题',
                links: item.links || [],
                image: item.image || FALLBACK_PIC
            };
            
            const totalLinks = (item.links || []).length;
            const remarks = totalLinks > 0 
                ? `${totalLinks}个网盘链接` 
                : (item.datetime ? new Date(item.datetime).toLocaleDateString('zh-CN') : '暂无链接');

            return {
                vod_id: jsonify(vod_id_data),
                vod_name: item.title || '未知标题',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: remarks
            };
        });

        log(`✅ [search] 成功映射 ${list.length} 条结果`);
        
        // 5. 返回结构
        return jsonify({
            list: list,
            total: total,
            page: 1,
            pagecount: Math.ceil(total / 10)
        });

    } catch (e) {
        log(`❌ [search] 搜索异常: ${e.message}`);
        return jsonify({ list: [], total: 0 });
    }
}

// ----------------------------------------------------------------------
// 详情/播放 (核心修复：正确返回播放信息)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    log(`🎬 [getTracks] 开始获取播放链接`);
    
    try {
        const idData = argsify(vod_id);
        log(`📋 [getTracks] 解析类型: ${idData.type}`);
        
        if (idData.type === 'search') {
            const links = idData.links || [];
            log(`🔗 [getTracks] 搜索结果链接数: ${links.length}`);
            
            if (links.length === 0) {
                log('⚠️ [getTracks] 无可用链接');
                return jsonify({ 
                    list: [{ 
                        title: '播放列表', 
                        tracks: [{ 
                            name: '暂无可用链接', 
                            pan: '' 
                        }] 
                    }] 
                });
            }
            
            // 构建播放列表
            const tracks = links.map((link, index) => {
                const panType = (link.type || 'unknown').toUpperCase();
                const password = link.password ? ` 提取码:${link.password}` : '';
                const name = `${panType}网盘 ${index + 1}${password}`;
                
                log(`🎯 [getTracks] 添加链接: ${name} -> ${link.url}`);
                
                return { 
                    name: name, 
                    pan: link.url 
                };
            });
            
            log(`✅ [getTracks] 成功构建 ${tracks.length} 个播放链接`);
            
            return jsonify({ 
                list: [{ 
                    title: idData.title || '播放列表', 
                    tracks: tracks 
                }] 
            });
        } 
        else if (idData.type === 'home') {
            log(`🏠 [getTracks] 处理首页详情: ${idData.path}`);
            
            const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;
            const { data } = await $fetch.get(url, {
                headers: { 'User-Agent': UA }
            });
            
            if (data.success) {
                const trackName = data.data.pwd 
                    ? `点击播放 提取码:${data.data.pwd}` 
                    : '点击播放';
                    
                log(`✅ [getTracks] 首页详情解析成功`);
                
                return jsonify({ 
                    list: [{ 
                        title: '播放列表', 
                        tracks: [{ 
                            name: trackName, 
                            pan: data.data.pan 
                        }] 
                    }] 
                });
            } else {
                throw new Error(`后端详情解析失败: ${data.message}`);
            }
        } 
        else {
            throw new Error(`未知的 vod_id 类型: ${idData.type}`);
        }
    } catch (e) {
        log(`❌ [getTracks] 异常: ${e.message}`);
        return jsonify({ 
            list: [{ 
                title: '播放列表', 
                tracks: [{ 
                    name: '获取链接失败', 
                    pan: '' 
                }] 
            }] 
        });
    }
}

// ----------------------------------------------------------------------
// 播放接口 (核心修复：正确处理网盘链接)
// ----------------------------------------------------------------------
async function play(flag, id) {
    log(`▶️ [play] 开始播放: flag=${flag}, id=${id}`);
    
    // id 就是网盘链接，直接返回
    if (id && id.startsWith('http')) {
        log(`✅ [play] 返回网盘链接: ${id}`);
        return jsonify({ 
            parse: 0,
            url: id,
            header: {}
        });
    }
    
    log(`⚠️ [play] 无效的播放ID: ${id}`);
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
