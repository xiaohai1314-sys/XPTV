/**
 * XPTV 插件 - reboys.cn 搜索
 * 版本: V1.0
 * 参考: 找盘插件架构
 * 核心: 后端返回完整 links 数组，无需解析重定向
 */

// ==================== 配置区 ====================
const BACKEND_URL = "http://192.168.10.106:3000";  // ⚠️ 修改为你的后端IP
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;

// ==================== 辅助函数 ====================
function log(msg) { 
    const logMsg = `[reboys] ${msg}`;
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

function jsonify(data) { 
    return JSON.stringify(data); 
}

function detectPanType(url, type) {
    if (type === 'quark' || url.indexOf('quark.cn') > -1) return '夸克网盘';
    if (type === 'baidu' || url.indexOf('baidu.com') > -1) return '百度网盘';
    if (type === 'aliyun' || url.indexOf('aliyundrive.com') > -1 || url.indexOf('alipan.com') > -1) return '阿里云盘';
    if (type === '115' || url.indexOf('115.com') > -1) return '115网盘';
    if (type === 'tianyi' || url.indexOf('189.cn') > -1) return '天翼云盘';
    return '网盘';
}

// ==================== 全局缓存 ====================
let searchCache = {};

// ==================== XPTV 插件入口 ====================

async function getConfig() {
    log("==== 插件初始化 V1.0 ====");
    return jsonify({
        ver: 1,
        title: 'reboys搜',
        site: SITE_URL,
        cookie: '',
        tabs: []  // 无分类，纯搜索
    });
}

// ==================== 首页（不提供）====================
async function getCards(ext) {
    return jsonify({ list: [] });
}

// ==================== 搜索（核心功能）====================
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;

    if (!text) {
        log(`[search] 搜索词为空`);
        return jsonify({ list: [] });
    }

    log(`[search] 关键词="${text}", 页=${page}`);
    
    try {
        // 检查缓存
        const cacheKey = `search_${text}`;
        let allResults = searchCache[cacheKey];
        
        if (!allResults) {
            log(`[search] 缓存未命中，请求后端`);
            
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(text)}&page=1`;
            const response = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            // 解析响应
            let result = response;
            if (typeof response === 'string') {
                result = JSON.parse(response);
            } else if (response.data) {
                result = typeof response.data === 'string' 
                    ? JSON.parse(response.data) 
                    : response.data;
            }
            
            if (!result || result.code !== 0) {
                log(`[search] ❌ 后端返回错误: ${result?.message || '未知'}`);
                return jsonify({ list: [] });
            }

            // 提取 results
            const results = result.data?.data?.results 
                         || result.data?.results 
                         || result.results 
                         || [];
            
            if (results.length === 0) {
                log(`[search] ⚠️ 无搜索结果`);
                return jsonify({ list: [] });
            }
            
            log(`[search] ✓ 获取到 ${results.length} 条结果`);
            
            // 映射数据
            allResults = results.map(function(item) {
                const title = item.title || '未知';
                const links = item.links || [];
                const image = item.image || FALLBACK_PIC;
                
                // 构建 vod_id：序列化完整数据
                const vodData = {
                    title: title,
                    links: links
                };
                
                return {
                    vod_id: jsonify(vodData),  // 序列化为 JSON 字符串
                    vod_name: title,
                    vod_pic: image,
                    vod_remarks: links.length > 0 ? links.length + '个网盘' : '暂无',
                    ext: { data: vodData }  // 备用数据
                };
            });
            
            searchCache[cacheKey] = allResults;
            log(`[search] ✓ 缓存 ${allResults.length} 条结果`);
        } else {
            log(`[search] ⚡ 使用缓存 (${allResults.length} 条)`);
        }
        
        // 分页
        const pageSize = 30;
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageResults = allResults.slice(startIdx, endIdx);
        
        log(`[search] 返回第 ${page} 页，共 ${pageResults.length} 条`);
        return jsonify({ list: pageResults });
        
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ==================== 详情页（解析 vod_id）====================
async function getTracks(ext) {
    ext = argsify(ext);
    const vodIdStr = ext.vod_id || ext.url || '';
    
    if (!vodIdStr) {
        log(`[getTracks] ❌ vod_id 为空`);
        return jsonify({ list: [] });
    }

    log(`[getTracks] 开始解析 vod_id`);
    
    try {
        // 解析 vod_id
        const vodData = argsify(vodIdStr);
        const title = vodData.title || '未知';
        const links = vodData.links || [];
        
        log(`[getTracks] 标题: "${title}"`);
        log(`[getTracks] 链接数: ${links.length}`);
        
        if (links.length === 0) {
            log(`[getTracks] ⚠️ 无可用链接`);
            return jsonify({
                list: [{
                    title: '提示',
                    tracks: [{ 
                        name: '该资源暂无可用网盘链接', 
                        pan: '', 
                        ext: {} 
                    }]
                }]
            });
        }
        
        // 构建播放列表
        const tracks = links.map(function(link) {
            const url = link.url || '';
            const password = link.password || '';
            const type = link.type || '';
            
            const panType = detectPanType(url, type);
            
            let name = '[' + panType + '] ' + title;
            if (password) {
                name += ' 🔑' + password;
            }
            
            log(`[getTracks] 链接: ${panType} → ${url.substring(0, 40)}...`);
            
            return { 
                name: name, 
                pan: url, 
                ext: {} 
            };
        });
        
        log(`[getTracks] ✓ 返回 ${tracks.length} 个链接`);
        
        return jsonify({
            list: [{
                title: title,
                tracks: tracks
            }]
        });
        
    } catch (e) {
        log(`[getTracks] ❌ 异常: ${e.message}`);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ 
                    name: '解析失败: ' + e.message, 
                    pan: '', 
                    ext: {} 
                }]
            }]
        });
    }
}

// ==================== 兼容接口 ====================
async function init() { 
    return getConfig(); 
}

async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg) {
    return getCards({ id: tid, page: pg || 1 });
}

async function detail(id) { 
    log(`[detail] 详情ID长度: ${id?.length || 0}`);
    return getTracks({ vod_id: id }); 
}

async function play(flag, id) { 
    log(`[play] 播放链接: ${id?.substring(0, 50)}...`);
    return jsonify({ url: id }); 
}

log('==== reboys 插件加载完成 V1.0 ====');
