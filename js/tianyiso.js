/**
 * reboys.cn 前端插件 - V23.0 (终极简化版)
 * 
 * 核心修复:
 * 1. ✅ 删除首页逻辑（网站使用弹窗，无需详情页）
 * 2. ✅ 统一数据流：所有内容都通过搜索获取
 * 3. ✅ 直接使用后端返回的 links 数组
 * 4. ✅ 简化 vod_id 结构，避免数据丢失
 */

// ==================== 配置区 ====================
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;

// ==================== 全局缓存 ====================
let searchCache = {};

// ==================== 辅助函数 ====================

function log(msg) { 
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}][reboys V23] ${msg}`;
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
            log(`[argsify] ⚠️ 解析失败: ${e.message}`);
            return {}; 
        }
    }
    return ext || {}; 
}

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

/**
 * 识别网盘类型
 */
function detectPanType(url, type) {
    if (!url) return 'Unknown';
    
    if (type) {
        const typeMap = {
            'quark': '夸克网盘',
            'baidu': '百度网盘',
            'aliyun': '阿里云盘',
            '115': '115网盘',
            'tianyi': '天翼云盘'
        };
        return typeMap[type.toLowerCase()] || type.toUpperCase();
    }
    
    if (url.includes('quark.cn')) return '夸克网盘';
    if (url.includes('pan.baidu.com')) return '百度网盘';
    if (url.includes('aliyundrive.com') || url.includes('alipan.com')) return '阿里云盘';
    if (url.includes('115.com')) return '115网盘';
    if (url.includes('189.cn')) return '天翼云盘';
    if (url.includes('weiyun.com')) return '微云';
    if (url.includes('lanzou')) return '蓝奏云';
    
    return '网盘链接';
}

// ==================== 插件初始化 ====================

async function getConfig() {
    log("========== 插件初始化 V23.0 ==========");
    
    // 只保留搜索功能，不提供分类
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V23)', 
        site: SITE_URL, 
        tabs: []  // 空数组表示只提供搜索
    });
}

// ==================== 搜索功能（核心）====================

async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1;
    
    if (!keyword) {
        log('[search] ⚠️ 关键词为空');
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
    
    log(`[search] 🔍 关键词: "${keyword}", 页码: ${page}`);
    
    try {
        const cacheKey = `search_${keyword}`;
        let allResults = searchCache[cacheKey];
        
        if (!allResults) {
            log(`[search] 📡 请求后端...`);
            
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            // 解析响应
            let response = null;
            if (typeof fetchResult === 'string') {
                response = JSON.parse(fetchResult);
            } else if (fetchResult?.data) {
                response = typeof fetchResult.data === 'string' 
                    ? JSON.parse(fetchResult.data) 
                    : fetchResult.data;
            } else {
                response = fetchResult;
            }
            
            if (!response || response.code !== 0) {
                log(`[search] ❌ 后端错误: ${response?.message || '未知错误'}`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }

            // 提取结果
            let results = response.data?.data?.results 
                       || response.data?.results 
                       || response.results 
                       || [];
            
            if (results.length === 0) {
                log(`[search] ⚠️ 无搜索结果`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }
            
            log(`[search] ✅ 获取 ${results.length} 条原始结果`);
            
            // ============ 核心映射逻辑 ============
            allResults = results.map((item, index) => {
                const title = item.title || '未知标题';
                const links = item.links || [];
                const image = item.image || FALLBACK_PIC;
                
                // 🔑 关键：完整保留所有数据
                const vod_id_data = {
                    title: title,
                    links: links,  // ✅ 完整的链接数组
                    image: image
                };
                
                const linkCount = links.length;
                
                // 调试输出（前5个）
                if (index < 5) {
                    log(`[search] #${index + 1}: "${title}" - ${linkCount} 个链接`);
                    if (linkCount > 0) {
                        links.forEach((link, i) => {
                            log(`[search]     链接${i + 1}: ${link.type || 'unknown'} - ${link.url?.substring(0, 40)}...`);
                        });
                    }
                }

                return {
                    vod_id: jsonify(vod_id_data),
                    vod_name: title,
                    vod_pic: image,
                    vod_remarks: linkCount > 0 ? `${linkCount}个网盘` : '暂无链接'
                };
            });
            
            searchCache[cacheKey] = allResults;
            log(`[search] 💾 缓存 ${allResults.length} 条结果`);
            
        } else {
            log(`[search] ⚡ 使用缓存 (${allResults.length} 条)`);
        }
        
        // 分页
        const pageSize = 10;
        const startIdx = (page - 1) * pageSize;
        const pageResults = allResults.slice(startIdx, startIdx + pageSize);
        const totalPages = Math.ceil(allResults.length / pageSize);
        
        log(`[search] 📄 返回第 ${page}/${totalPages} 页，本页 ${pageResults.length} 条`);
        
        return jsonify({
            list: pageResults,
            page: page,
            pagecount: totalPages,
            total: allResults.length
        });

    } catch (e) {
        log(`[search] 💥 异常: ${e.message}`);
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}

// ==================== 详情页（简化版）====================

async function getTracks(ext) {
    const vod_id = ext.vod_id;
    
    log(`[getTracks] ========== 开始处理 ==========`);
    
    try {
        const idData = argsify(vod_id);
        const title = idData.title || '未知标题';
        const links = idData.links || [];
        
        log(`[getTracks] 标题: "${title}"`);
        log(`[getTracks] 链接数: ${links.length}`);
        
        // 输出完整的 idData 用于调试
        log(`[getTracks] 完整数据: ${JSON.stringify(idData).substring(0, 200)}...`);
        
        if (links.length === 0) {
            log(`[getTracks] ⚠️ 没有链接！`);
            log(`[getTracks] vod_id 内容: ${vod_id}`);
            
            return jsonify({ 
                list: [{ 
                    title: '暂无资源', 
                    tracks: [{ 
                        name: '该资源暂无可用网盘链接', 
                        pan: '' 
                    }] 
                }]
            });
        }
        
        // 构建播放列表
        const tracks = links.map((link, index) => {
            const url = link.url || '';
            const password = link.password || '';
            const type = link.type || '';
            
            const panType = detectPanType(url, type);
            
            let displayName = `[${panType}] ${title}`;
            if (password) {
                displayName += ` 🔑 ${password}`;
            }
            
            log(`[getTracks] 链接${index + 1}: ${panType} → ${url}`);
            
            return { 
                name: displayName, 
                pan: url 
            };
        });
        
        log(`[getTracks] ✅ 返回 ${tracks.length} 个链接`);
        
        return jsonify({ 
            list: [{ 
                title: title, 
                tracks: tracks 
            }]
        });
        
    } catch (e) {
        log(`[getTracks] 💥 异常: ${e.message}`);
        log(`[getTracks] 堆栈: ${e.stack}`);
        
        return jsonify({ 
            list: [{ 
                title: '错误', 
                tracks: [{ 
                    name: `解析失败: ${e.message}`, 
                    pan: '' 
                }] 
            }]
        });
    }
}

// ==================== 播放功能 ====================

async function play(flag, id) {
    log(`[play] flag: "${flag}", id: ${id?.substring(0, 50)}...`);
    
    if (!id) {
        log(`[play] ❌ id 为空`);
        return jsonify({ parse: 0, url: '', header: {} });
    }
    
    if (id.startsWith('http://') || id.startsWith('https://')) {
        log(`[play] ✅ 返回网盘链接`);
        return jsonify({ 
            parse: 0,
            url: id,
            header: {}
        });
    }
    
    if (id.startsWith('//')) {
        const fullUrl = 'https:' + id;
        log(`[play] ✅ 补全协议: ${fullUrl}`);
        return jsonify({ 
            parse: 0,
            url: fullUrl,
            header: {}
        });
    }
    
    log(`[play] ❌ 无效链接`);
    return jsonify({ parse: 0, url: '', header: {} });
}

// ==================== 兼容接口 ====================

async function init() { 
    return getConfig(); 
}

async function home() { 
    // 不提供首页，只提供搜索
    return jsonify({ class: [] }); 
}

async function category(tid, pg) { 
    // 不提供分类
    return jsonify({ list: [] }); 
}

async function detail(id) { 
    return getTracks({ vod_id: id }); 
}

async function getCards() {
    // 不提供首页卡片
    return jsonify({ list: [] });
}

log('========================================');
log('✅ 插件加载完成: reboys V23.0');
log('📌 说明: 纯搜索插件，无首页/分类');
log('🔧 后端: ' + BACKEND_URL);
log('========================================');
