/**
 * reboys.cn 前端插件 - V22.0 (终极稳定版：兼容解析 + 网盘修复)
 * 核心修正:
 * 1. [终极兼容] search: 采用最保守的“多层级”数据提取策略，确保无论 App 自动剥离多少层 JSON，都能找到 results 数组。
 * 2. [网盘修复] getTracks: 确保生成的 tracks 结构纯净， pan 字段仅包含网盘 URL。
 * 3. [网盘修复] play: 确保能直接返回网盘 URL，防止 App 无法识别。
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
let searchCache = {}; 

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V22] ${msg}`;
    try { 
        // 尝试使用 $log，如果 App 不支持，则使用 console.log
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
    log("==== 插件初始化 V22 (终极稳定版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V22)', site: SITE_URL, tabs: CATEGORIES });
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
// ★★★★★ 搜索 (终极兼容解析) ★★★★★
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1; // 加上分页支持，防止无限加载
    if (!keyword) return jsonify({ list: [] });
    
    // 检查缓存，防止重复搜索导致无限加载
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
            log(`❌ [search] JSON 解析失败: ${e.message}`);
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
        } else if (response.data && response.data.data && response.data.data.data && response.data.data.data.results) {
             coreData = response.data.data.data;
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
        const pageCount = Math.ceil(total / (results.length || 10)); // 假设每页10条或根据结果数量估算
        
        const finalResult = {
            list: list,
            total: total,
            page: page,
            pagecount: pageCount,
        };

        searchCache[cacheKey] = finalResult; // 缓存结果
        return jsonify(finalResult);

    } catch (e) {
        log(`❌ [search] 搜索异常: ${e.message}`);
        return jsonify({ list: [], total: 0 });
    }
}


// ----------------------------------------------------------------------
// ★★★★★ 详情/播放 (网盘识别修复) ★★★★★
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    log(`[getTracks] 收到 vod_id: ${vod_id.substring(0, 100)}...`);
    
    try {
        const idData = argsify(vod_id); 
        
        if (idData.type === 'search') {
            // 搜索结果模式：网盘链接已在 vod_id.links 中
            const links = idData.links;
            log(`[getTracks] (搜索源) 发现 ${links.length} 个网盘链接。`);

            if (links && links.length > 0) {
                // V22 修复：确保映射的结构是 App 期望的：{ name: '名称', pan: '链接' }
                const tracks = links.map(link => {
                    const panType = (link.type || '网盘').toUpperCase();
                    const password = link.password ? ` (码: ${link.password})` : '';
                    
                    return {
                        name: `[${panType}] ${link.url.includes('quark') ? '夸克' : (link.url.includes('baidu') ? '百度' : '网盘')} ${password}`, // 优化名称显示
                        pan: link.url, 
                    };
                });
                
                return jsonify({ 
                    list: [{ 
                        title: idData.title || '网盘列表', 
                        tracks: tracks 
                    }] 
                });

            } else {
                return jsonify({ list: [{ title: '播放列表', tracks: [{ name: '无可用链接', pan: '' }] }] });
            }

        } 
        else if (idData.type === 'home') {
            // 首页/分类模式：调用后端 /detail 接口解析详情页
            const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;
            const { data } = await $fetch.get(url);
            
            if (data.success) {
                let trackName = data.data.pwd ? `点击播放 (码: ${data.data.pwd})` : '点击播放';
                return jsonify({ 
                    list: [{ 
                        title: '播放列表', 
                        tracks: [{ name: trackName, pan: data.data.pan }] 
                    }] 
                });
            } else {
                throw new Error(`后端详情解析失败: ${data.message}`);
            }

        } 
        else {
            throw new Error('未知的 vod_id 类型');
        }
    } catch (e) {
        log(`❌ [getTracks] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// 播放 (网盘识别修复)
// ----------------------------------------------------------------------
async function play(flag, id) {
    // id 就是网盘链接 (即 getTracks 中 pan 字段的值)
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
