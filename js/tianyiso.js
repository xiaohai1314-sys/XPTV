/**
 * reboys.cn 前端插件 - V19.0 (最终兼容解析版)
 * * 核心修正: 采用最保守的“多层级”数据提取策略，确保无论 App 自动剥离多少层 JSON，都能找到 results 数组。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000"; // 您的后端服务地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 辅助函数 ---
function log(msg) { 
    if (DEBUG) {
        // 由于没有调试控制台，此 log 主要用于代码结构完整性
        console.log(`[reboys插件 V19] ${msg}`); 
    }
}
function argsify(ext) { 
    if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; } 
    return ext || {}; 
}
function jsonify(obj) { 
    return JSON.stringify(obj); 
}
async function getConfig() {
    log("==== 插件初始化 V19 (最终兼容版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V19)', site: SITE_URL, tabs: CATEGORIES });
}
// ----------------------------------------------------------------------
// ★★★★★ 首页/分类 (保持不变) ★★★★★
// ----------------------------------------------------------------------
let homeCache = null;
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
// ★★★★★ 搜索 (核心修复：鲁棒解析 + 兼容路径) ★★★★★
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
        
        const fetchResult = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        let response = null;

        // 1. 鲁棒解析 (V18 核心，处理 JSON 字符串或对象)
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

        // 2. 核心修正：兼容性路径提取
        let coreData = null;
        
        // 原始后端数据结构: {code:0, data: {code:0, data: {total: 98, results: [...]}}}
        
        if (response.data && response.data.data && response.data.data.results) {
             // 路径 1: response.data.data (最可能路径)
             coreData = response.data.data;
        } else if (response.data && response.data.results) {
             // 路径 2: response.data (如果 App 自动剥离了最外层 {code:0})
             coreData = response.data;
        } else if (response.data && response.data.data && response.data.data.data && response.data.data.data.results) {
             // 路径 3: response.data.data.data (V15 的路径)
             coreData = response.data.data.data;
        } else if (response.results) {
             // 路径 4: response 本身 (如果 App 剥离了两层 {code:0})
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
        
        // 4. 返回结构
        return jsonify({
            list: list,
            total: total,
            page: 1,
            pagecount: Math.ceil(total / 10),
        });

    } catch (e) {
        log(`❌ [search] 搜索异常: ${e.message}`);
        return jsonify({ list: [], total: 0 });
    }
}


// ----------------------------------------------------------------------
// ★★★★★ 详情/播放 (保持不变) ★★★★★
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    try {
        const idData = argsify(vod_id); 
        
        if (idData.type === 'search') {
            const links = idData.links;
            if (links && links.length > 0) {
                const tracks = links.map(link => {
                    const panType = (link.type || '网盘').toUpperCase();
                    const password = link.password ? ` (码: ${link.password})` : '';
                    const name = `[${panType}] ${idData.title || '播放列表'}${password}`;
                    return { name: name, pan: link.url };
                });
                return jsonify({ list: [{ title: idData.title || '播放列表', tracks: tracks }] });
            } else {
                return jsonify({ list: [{ title: '播放列表', tracks: [{ name: '无可用链接', pan: '' }] }] });
            }
        } 
        else if (idData.type === 'home') {
            const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;
            const { data } = await $fetch.get(url);
            if (data.success) {
                let trackName = data.data.pwd ? `点击播放 (码: ${data.data.pwd})` : '点击播放';
                return jsonify({ list: [{ title: '播放列表', tracks: [{ name: trackName, pan: data.data.pan }] }] });
            } else {
                throw new Error(`后端详情解析失败: ${data.message}`);
            }
        } 
        else {
            throw new Error('未知的 vod_id 类型');
        }
    } catch (e) {
        return jsonify({ list: [] });
    }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
