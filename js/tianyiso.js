/**
 * reboys.cn 前端插件 - V22.0 (完整修复版)
 * 
 * 核心修复:
 * 1. ✅ 统一数据流：搜索结果直接包含链接，无需二次请求
 * 2. ✅ 简化详情逻辑：直接解析 vod_id 中的 links 数组
 * 3. ✅ 完善网盘识别：支持夸克/百度/阿里/115/天翼等主流网盘
 * 4. ✅ 优化缓存机制：避免重复请求后端
 * 5. ✅ 增强错误处理：详细的日志输出
 */

// ==================== 配置区 ====================
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio();

// ==================== 全局缓存 ====================
let searchCache = {};  // 搜索结果缓存
let homeCache = null;  // 首页缓存

// ==================== 辅助函数 ====================

/**
 * 日志输出
 */
function log(msg) { 
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}][reboys V22] ${msg}`;
    try { 
        $log(logMsg); 
    } catch (_) { 
        if (DEBUG) console.log(logMsg); 
    }
}

/**
 * 参数解析：字符串转对象
 */
function argsify(ext) { 
    if (typeof ext === 'string') {
        try { 
            return JSON.parse(ext); 
        } catch (e) { 
            log(`[argsify] 解析失败: ${e.message}`);
            return {}; 
        }
    }
    return ext || {}; 
}

/**
 * 对象转 JSON 字符串
 */
function jsonify(obj) { 
    return JSON.stringify(obj); 
}

/**
 * 识别网盘类型
 */
function detectPanType(url, type) {
    if (!url) return 'Unknown';
    
    // 优先使用 type 字段
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
    
    // URL 模式匹配
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
    log("========== 插件初始化 V22.0 ==========");
    
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

// ==================== 首页/分类 ====================

async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    
    log(`[getCards] 获取分类: ${categoryId}`);
    
    try {
        // 缓存首页内容
        if (!homeCache) {
            log(`[getCards] 请求首页数据...`);
            const { data } = await $fetch.get(SITE_URL, { 
                headers: { 'User-Agent': UA },
                timeout: 10000
            });
            homeCache = data;
        }
        
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        
        if (targetBlock.length === 0) {
            log(`[getCards] ⚠️ 未找到分类 ${categoryId}`);
            return jsonify({ list: [] });
        }

        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            
            if (detailPath && title) {
                cards.push({
                    vod_id: jsonify({ 
                        type: 'home', 
                        path: detailPath,
                        title: title
                    }),
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '首页推荐'
                });
            }
        });
        
        log(`[getCards] ✅ 返回 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
        
    } catch (e) {
        log(`[getCards] ❌ 异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// ==================== 搜索功能 ====================

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
        // ============ 缓存机制 ============
        const cacheKey = `search_${keyword}`;
        let allResults = searchCache[cacheKey];
        
        if (!allResults) {
            log(`[search] 📡 缓存未命中，请求后端...`);
            
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            // ============ 解析响应 ============
            let response = null;
            
            // 处理不同的响应格式
            if (typeof fetchResult === 'string') {
                response = JSON.parse(fetchResult);
            } else if (typeof fetchResult === 'object' && fetchResult !== null) {
                if (fetchResult.data) {
                    response = typeof fetchResult.data === 'string' 
                        ? JSON.parse(fetchResult.data) 
                        : fetchResult.data;
                } else if (fetchResult.code !== undefined) {
                    response = fetchResult;
                }
            }
            
            // 验证响应
            if (!response || response.code !== 0) {
                log(`[search] ❌ 后端返回错误: code=${response?.code}, message=${response?.message}`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }

            // ============ 提取结果（多路径兼容）============
            let results = null;
            
            if (response.data?.data?.results) {
                results = response.data.data.results;
                log(`[search] 📦 数据路径: response.data.data.results`);
            } else if (response.data?.results) {
                results = response.data.results;
                log(`[search] 📦 数据路径: response.data.results`);
            } else if (response.results) {
                results = response.results;
                log(`[search] 📦 数据路径: response.results`);
            }
            
            if (!Array.isArray(results) || results.length === 0) {
                log(`[search] ⚠️ 未找到搜索结果`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }
            
            log(`[search] ✅ 获取到 ${results.length} 条原始结果`);
            
            // ============ 映射搜索结果 ============
            allResults = results.map((item, index) => {
                const title = item.title || '未知标题';
                const links = item.links || [];
                const image = item.image || FALLBACK_PIC;
                
                // 🔑 关键：将完整的链接数组打包到 vod_id 中
                const vod_id_data = {
                    title: title,
                    links: links,  // ✅ 完整传递所有链接
                    image: image,
                    content: item.content || '',
                    datetime: item.datetime || ''
                };
                
                const totalLinks = links.length;
                const remarks = totalLinks > 0 
                    ? `${totalLinks}个网盘` 
                    : '暂无链接';
                
                // 输出每个结果的链接数量（调试用）
                if (index < 3) {  // 只输出前3个
                    log(`[search] 结果 ${index + 1}: "${title}" - ${totalLinks} 个链接`);
                }

                return {
                    vod_id: jsonify(vod_id_data),  // ✅ 打包成 JSON 字符串
                    vod_name: title,
                    vod_pic: image,
                    vod_remarks: remarks
                };
            });
            
            // 缓存结果
            searchCache[cacheKey] = allResults;
            log(`[search] 💾 缓存 ${allResults.length} 条结果`);
            
        } else {
            log(`[search] ⚡ 使用缓存，共 ${allResults.length} 条结果`);
        }
        
        // ============ 分页处理 ============
        const pageSize = 10;
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageResults = allResults.slice(startIdx, endIdx);
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
        log(`[search] 堆栈: ${e.stack}`);
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}

// ==================== 详情页（核心修复）====================

async function getTracks(ext) {
    const vod_id = ext.vod_id;
    
    log(`[getTracks] ========== 开始获取详情 ==========`);
    log(`[getTracks] 原始 vod_id 长度: ${vod_id?.length || 0} 字符`);
    
    try {
        // ============ 解析 vod_id ============
        const idData = argsify(vod_id);
        
        log(`[getTracks] 📦 解析结果:`);
        log(`[getTracks]   - 类型: ${idData.type || 'search'}`);
        log(`[getTracks]   - 标题: ${idData.title}`);
        log(`[getTracks]   - 链接数: ${(idData.links || []).length}`);
        
        // ============ 处理搜索结果类型 ============
        const links = idData.links || [];
        const title = idData.title || '未知标题';
        
        if (links.length === 0) {
            log(`[getTracks] ⚠️ 没有可用链接`);
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
        
        // ============ 构建播放列表 ============
        log(`[getTracks] 🔗 开始构建播放列表...`);
        
        const tracks = links.map((link, index) => {
            const url = link.url || '';
            const password = link.password || '';
            const type = link.type || '';
            
            // 识别网盘类型
            const panType = detectPanType(url, type);
            
            // 构建显示名称
            let displayName = `[${panType}] ${title}`;
            if (password) {
                displayName += ` 🔑 ${password}`;
            }
            
            log(`[getTracks]   链接${index + 1}: ${panType} - ${url.substring(0, 40)}...`);
            
            return { 
                name: displayName, 
                pan: url 
            };
        });
        
        log(`[getTracks] ✅ 成功返回 ${tracks.length} 个播放链接`);
        log(`[getTracks] ========== 详情获取完成 ==========`);
        
        return jsonify({ 
            list: [{ 
                title: title, 
                tracks: tracks 
            }]
        });
        
    } catch (e) {
        log(`[getTracks] ❌ 异常: ${e.message}`);
        log(`[getTracks] 堆栈: ${e.stack}`);
        
        return jsonify({ 
            list: [{ 
                title: '获取失败', 
                tracks: [{ 
                    name: `错误: ${e.message}`, 
                    pan: '' 
                }] 
            }]
        });
    }
}

// ==================== 播放功能 ====================

async function play(flag, id) {
    log(`[play] ========== 开始播放 ==========`);
    log(`[play] flag: "${flag}"`);
    log(`[play] id 长度: ${id?.length || 0} 字符`);
    log(`[play] id 前缀: ${id?.substring(0, 50)}...`);
    
    // ============ 验证链接 ============
    if (!id) {
        log(`[play] ❌ id 为空`);
        return jsonify({ parse: 0, url: '', header: {} });
    }
    
    // 检查是否是有效的 HTTP(S) 链接
    if (id.startsWith('http://') || id.startsWith('https://')) {
        log(`[play] ✅ 返回网盘链接`);
        log(`[play] 完整 URL: ${id}`);
        
        return jsonify({ 
            parse: 0,  // 0 = 不需要解析，直接使用 url
            url: id,
            header: {}
        });
    }
    
    // 支持协议相对 URL
    if (id.startsWith('//')) {
        const fullUrl = 'https:' + id;
        log(`[play] ✅ 补全协议: ${fullUrl}`);
        return jsonify({ 
            parse: 0,
            url: fullUrl,
            header: {}
        });
    }
    
    log(`[play] ❌ 无效的链接格式`);
    return jsonify({ 
        parse: 0,
        url: '',
        header: {}
    });
}

// ==================== 兼容接口 ====================

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

// ==================== 插件加载完成 ====================

log('========================================');
log('✅ 插件加载完成: reboys V22.0');
log('🔧 后端地址: ' + BACKEND_URL);
log('🌐 网站地址: ' + SITE_URL);
log('========================================');
