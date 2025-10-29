/**
 * reboys.cn 前端插件 - V24.0 (极简版 - 无日志)
 * 核心：直接映射后端返回的 links 数组
 */

// ==================== 配置 ====================
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";

// ==================== 缓存 ====================
let searchCache = {};

// ==================== 工具函数 ====================
function argsify(ext) { 
    if (typeof ext === 'string') {
        try { return JSON.parse(ext); } 
        catch (e) { return {}; }
    }
    return ext || {}; 
}

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

function detectPanType(url, type) {
    if (type === 'quark' || url.includes('quark.cn')) return '夸克网盘';
    if (type === 'baidu' || url.includes('baidu.com')) return '百度网盘';
    if (type === 'aliyun' || url.includes('aliyundrive.com') || url.includes('alipan.com')) return '阿里云盘';
    if (type === '115' || url.includes('115.com')) return '115网盘';
    if (type === 'tianyi' || url.includes('189.cn')) return '天翼云盘';
    return '网盘';
}

// ==================== 初始化 ====================
async function getConfig() {
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V24)', 
        site: SITE_URL, 
        tabs: []
    });
}

// ==================== 搜索 ====================
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1;
    
    if (!keyword) {
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
    
    try {
        const cacheKey = `search_${keyword}`;
        let allResults = searchCache[cacheKey];
        
        if (!allResults) {
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            // 解析响应
            let response = fetchResult;
            if (typeof fetchResult === 'string') {
                response = JSON.parse(fetchResult);
            } else if (fetchResult?.data) {
                response = typeof fetchResult.data === 'string' 
                    ? JSON.parse(fetchResult.data) 
                    : fetchResult.data;
            }
            
            if (!response || response.code !== 0) {
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }

            // 提取 results
            let results = response.data?.data?.results 
                       || response.data?.results 
                       || response.results 
                       || [];
            
            if (results.length === 0) {
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }
            
            // 映射数据
            allResults = results.map(item => {
                const links = item.links || [];
                
                return {
                    vod_id: jsonify({
                        title: item.title || '未知',
                        links: links
                    }),
                    vod_name: item.title || '未知',
                    vod_pic: item.image || FALLBACK_PIC,
                    vod_remarks: links.length > 0 ? `${links.length}个网盘` : '暂无'
                };
            });
            
            searchCache[cacheKey] = allResults;
        }
        
        // 分页
        const pageSize = 10;
        const startIdx = (page - 1) * pageSize;
        const pageResults = allResults.slice(startIdx, startIdx + pageSize);
        const totalPages = Math.ceil(allResults.length / pageSize);
        
        return jsonify({
            list: pageResults,
            page: page,
            pagecount: totalPages,
            total: allResults.length
        });

    } catch (e) {
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}

// ==================== 详情 ====================
async function getTracks(ext) {
    try {
        const idData = argsify(ext.vod_id);
        const title = idData.title || '未知';
        const links = idData.links || [];
        
        if (links.length === 0) {
            return jsonify({ 
                list: [{ 
                    title: title, 
                    tracks: [{ 
                        name: '暂无可用链接', 
                        pan: '' 
                    }] 
                }]
            });
        }
        
        const tracks = links.map(link => {
            const url = link.url || '';
            const password = link.password || '';
            const panType = detectPanType(url, link.type || '');
            
            let name = `[${panType}] ${title}`;
            if (password) {
                name += ` 🔑 ${password}`;
            }
            
            return { name: name, pan: url };
        });
        
        return jsonify({ 
            list: [{ 
                title: title, 
                tracks: tracks 
            }]
        });
        
    } catch (e) {
        return jsonify({ 
            list: [{ 
                title: '错误', 
                tracks: [{ 
                    name: '解析失败', 
                    pan: '' 
                }] 
            }]
        });
    }
}

// ==================== 播放 ====================
async function play(flag, id) {
    if (!id) {
        return jsonify({ parse: 0, url: '', header: {} });
    }
    
    if (id.startsWith('http://') || id.startsWith('https://')) {
        return jsonify({ parse: 0, url: id, header: {} });
    }
    
    if (id.startsWith('//')) {
        return jsonify({ parse: 0, url: 'https:' + id, header: {} });
    }
    
    return jsonify({ parse: 0, url: '', header: {} });
}

// ==================== 兼容接口 ====================
async function init() { return getConfig(); }
async function home() { return jsonify({ class: [] }); }
async function category(tid, pg) { return jsonify({ list: [] }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function getCards() { return jsonify({ list: [] }); }
