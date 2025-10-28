/**
 * reboys.cn 前端插件 - V23.0 (终极稳定版：修复无限加载 + 强制网盘识别)
 * 核心修正:
 * 1. [无限加载修复] search: 引入搜索缓存机制，防止重复请求。
 * 2. [网盘修复] getTracks: 强制返回 App 插件要求的 vod_play_from/vod_play_url 字段。
 * 3. [网盘修复] play: 保持直接返回 URL 的逻辑。
 * 4. [兼容解析] 保持兼容性路径提取。
 */

// --- 配置区 ---
// ⚠️ 请根据你的后端服务地址修改 BACKEND_URL
const BACKEND_URL = "http://192.168.1.7:3000"; 
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let homeCache = null;
let searchCache = {}; // V23 修复：引入搜索缓存

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
    if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; } 
    return ext || {}; 
}
function jsonify(obj) { 
    return JSON.stringify(obj); 
}

// ----------------------------------------------------------------------
// ★★★★★ getConfig & 首页/分类 (逻辑保持不变) ★★★★★
// ----------------------------------------------------------------------
async function getConfig() {
    log("==== 插件初始化 V23 (终极稳定版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V23)", site: SITE_URL, tabs: CATEGORIES });
}

async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    try {
        if (!homeCache) {
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
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
        homeCache = null;
        return jsonify({ list: [] });
    }
}


// ----------------------------------------------------------------------
// ★★★★★ 搜索 (修复无限加载) ★★★★★
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1; 
    if (!keyword) return jsonify({ list: [] });
    
    // 检查缓存，防止重复搜索请求
    const cacheKey = `${keyword}_${page}`;
    if (searchCache[cacheKey]) {
        return jsonify(searchCache[cacheKey]);
    }

    log(`[search] 开始搜索: ${keyword}, 页码: ${page}`);
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
        
        const fetchResult = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        let response = null;

        // 1. 鲁棒解析
        try {
            if (typeof fetchResult.data === 'string') {
                response = JSON.parse(fetchResult.data);
            } else if (typeof fetchResult.data === 'object' && fetchResult.data !== null) {
                response = fetchResult.data;
            } else if (typeof fetchResult === 'object' && fetchResult.code !== undefined) {
                response = fetchResult;
            }
        } catch (e) {
            return jsonify({ list: [] });
        }
        
        if (!response || response.code !== 0) {
             return jsonify({ list: [] });
        }

        // 2. 兼容性路径提取
        let coreData = null;
        if (response.data && response.data.data && response.data.data.results) {
             coreData = response.data.data;
        } else if (response.data && response.data.results) {
             coreData = response.data;
        } else if (response.results) {
             coreData = response;
        }
        
        const results = coreData?.results || [];
        
        if (results.length === 0) {
             return jsonify({ list: [] });
        }
        
        // 3. 映射结果
        const list = results.map(item => {
            const vod_id_data = {
                type: 'search', 
                title: item.title,
                links: item.links || [], 
            };
            
            const vod_id = JSON.stringify(vod_id_data);
            
            const totalLinks = item.links?.length || 0;
            const remarks = totalLinks > 0 ? `共${totalLinks}个链接` : (item.datetime ? new Date(item.datetime).toLocaleDateString('zh-CN') : '无链接');

            return {
                vod_id: vod_id,         
                vod_name: item.title,   
                vod_pic: item.image || FALLBACK_PIC, 
                vod_remarks: remarks,  
            };
        });

        const total = coreData?.total || list.length;
        const pageCount = Math.ceil(total / (results.length || 10)); 
        
        const finalResult = {
            list: list,
            total: total,
            page: page,
            pagecount: pageCount,
        };

        searchCache[cacheKey] = finalResult; 
        return jsonify(finalResult);

    } catch (e) {
        log(`❌ [search] 搜索异常: ${e.message}`);
        return jsonify({ list: [], total: 0 });
    }
}


// ----------------------------------------------------------------------
// ★★★★★ 详情/播放 (强制网盘识别修复) ★★★★★
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    
    try {
        const idData = argsify(vod_id); 
        
        if (idData.type === 'search') {
            const links = idData.links;

            if (links && links.length > 0) {
                // 生成 App 期望的播放列表 string: "名称$链接#名称$链接..."
                const playUrls = links.map(link => {
                    const panType = (link.type || '网盘').toUpperCase();
                    const password = link.password ? ` (码: ${link.password})` : '';
                    const name = `[${panType}] ${idData.title || '播放列表'}${password}`;
                    
                    // V23 修复：使用 App 插件最兼容的格式 "名称$链接"
                    return `${name}$${link.url}`; 
                }).join('#');
                
                // V23 修复：返回 App 强制要求的 vod_play_from 和 vod_play_url
                return jsonify({ 
                    vod_play_from: '网盘资源', // 播放源名称
                    vod_play_url: playUrls,    // 播放列表字符串
                    // 注意：这里不再使用 {list: [{title:..., tracks:[...]}]} 的结构
                });

            } else {
                return jsonify({ list: [] });
            }

        } 
        else if (idData.type === 'home') {
            // 首页/分类模式 (保持 V19/V22 逻辑不变)
            const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;
            const { data } = await $fetch.get(url);
            
            if (data.success) {
                let trackName = data.data.pwd ? `点击播放 (码: ${data.data.pwd})` : '点击播放';
                // 首页数据仍返回 tracks 结构（因为你的 App 可能支持两种结构）
                return jsonify({ 
                    list: [{ 
                        title: '播放列表', 
                        tracks: [{ name: trackName, pan: data.data.pan }] 
                    }] 
                });
            } else {
                return jsonify({ list: [] });
            }

        } 
        else {
            return jsonify({ list: [] });
        }
    } catch (e) {
        log(`❌ [getTracks] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// 播放 (保持不变)
// ----------------------------------------------------------------------
async function play(flag, id) {
    // id 就是网盘链接
    if (id && (id.startsWith('http') || id.startsWith('//'))) {
        return jsonify({ 
            parse: 0, // 0: 不需解析 (直接是链接)
            url: id,
            header: {}
        });
    }
    
    return jsonify({ 
        parse: 0,
        url: '',
        header: {}
    });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }

