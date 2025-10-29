/**
 * reboys.cn 前端插件 - 最终完整版 (V22)
 * 
 * 核心变更:
 * - 重写 getTracks/detail 函数，严格模仿已知成功案例的返回结构。
 * - 强制App使用其内置的对 `pan` 字段的特殊处理逻辑，以直接打开网盘链接。
 * - 移除 vod_play_from 和 vod_play_url，避免触发标准的、可能存在问题的播放流程。
 * - 加固了 search 函数中的 JSON 解析和缓存逻辑。
 */

// --- 配置区 ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 在这里填入您自己部署的 Puppeteer 后端服务的 IP 地址和端口
const BACKEND_URL = "http://192.168.10.106:3000"; 
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let searchCache = {}; // 搜索结果缓存
let homeCache = null;   // 首页内容缓存

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V22] ${msg}`;
    if (DEBUG) {
        try { 
            $log(logMsg); 
        } catch (_) { 
            console.log(logMsg); 
        }
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

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V22 (最终版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: '帝陵搜(V22)', 
        site: SITE_URL, 
        tabs: CATEGORIES 
    });
}

// --- 首页/分类 ---
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id || 1; // 默认分类为1
    
    try {
        if (!homeCache) {
            log(`[getCards] 首页缓存未命中，正在获取...`);
            const { data } = await $fetch.get(SITE_URL, { 
                headers: { 'User-Agent': UA } 
            });
            homeCache = data;
        }
        
        const $ = cheerio.load(homeCache);
        const cards = [];
        // Vue的v-show属性在cheerio中无法直接判断，但我们可以找到所有块并提取信息
        const targetBlock = $(`.home .block`).eq(categoryId - 1);
        
        if (targetBlock.length === 0) {
            log(`[getCards] 未找到分类块 (索引: ${categoryId - 1})`);
            return jsonify({ list: [] });
        }

        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            
            if (detailPath && title) {
                cards.push({
                    vod_id: jsonify({ type: 'home', path: detailPath }), // 暂时保留，但此版本未实现首页详情
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '首页推荐'
                });
            }
        });
        
        log(`[getCards] 分类 ${categoryId} 返回 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[getCards] 异常: ${e.message}`);
        homeCache = null; // 出错时清空缓存
        return jsonify({ list: [] });
    }
}

// --- 搜索 ---
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
            log(`[search] 缓存未命中，请求后端: ${BACKEND_URL}`);
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 30000 // 增加超时以等待Puppeteer
            });
            
            const response = argsify(fetchResult.data || fetchResult);
            
            if (!response || response.code !== 0) {
                throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
            }

            const results = response.data?.data?.results || [];
            if (results.length === 0) {
                log(`[search] 后端成功，但未找到结果`);
                return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
            }
            
            allResults = results.map(item => {
                const vod_id_data = {
                    type: 'search',
                    title: item.title,
                    links: item.links || [],
                };
                
                return {
                    vod_id: jsonify(vod_id_data),
                    vod_name: item.title,
                    vod_pic: item.image || FALLBACK_PIC,
                    vod_remarks: `${(item.links || []).length}个资源`
                };
            });
            
            searchCache[cacheKey] = allResults;
            log(`[search] 成功获取并缓存 ${allResults.length} 条结果`);
        } else {
            log(`[search] 命中缓存，共 ${allResults.length} 条结果`);
        }
        
        const pageSize = 10;
        const startIdx = (page - 1) * pageSize;
        const pageResults = allResults.slice(startIdx, startIdx + pageSize);
        const totalPages = Math.ceil(allResults.length / pageSize);
        
        log(`[search] 返回第${page}页，共${pageResults.length}条`);
        
        return jsonify({
            list: pageResults,
            page: page,
            pagecount: totalPages,
            total: allResults.length
        });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        searchCache[`search_${keyword}`] = null; // 清除失败的缓存
        return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });
    }
}

// ★★★★★【详情页 - 最终修正版，模仿成功案例】★★★★★
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    log(`[getTracks] 获取详情 (案例模式)`);
    
    try {
        const idData = argsify(vod_id);
        
        if (idData.type !== 'search' || !idData.links || idData.links.length === 0) {
            throw new Error('无效的详情数据或无链接');
        }
        
        log(`[getTracks] 找到 ${idData.links.length} 个链接`);
        
        const tracks = idData.links.map(link => {
            let panType = '网盘';
            const url = link.url || '';
            
            if (url.includes('quark.cn')) panType = '夸克';
            else if (url.includes('pan.baidu.com')) panType = '百度';
            else if (url.includes('aliyundrive.com')) panType = '阿里';
            
            const password = link.password ? ` (码:${link.password})` : '';
            const name = `[${panType}] ${idData.title}${password}`;
            
            return { 
                name: name, 
                pan: url,  // ★ 核心字段，用于触发App特殊逻辑
                ext: {}    // 保持结构与成功案例一致
            };
        });
        
        // ★ 只返回 list 结构，强制App使用 pan 字段逻辑
        return jsonify({
            list: [{
                title: '网盘资源', // 分组标题
                tracks: tracks
            }]
        });

    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ list: [] }); // 出错时返回空列表
    }
}

// ★★★★★【播放 - 备用函数】★★★★★
// 在新的 getTracks 模式下，此函数理论上不会被调用
async function play(flag, id, flags) {
    log(`[play] (备用模式) 被调用, id=${id}`);
    return jsonify({ 
        parse: 0, // 直接打开URL
        url: id
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
    // detail函数是App调用详情页的入口，它必须调用我们重写后的getTracks
    return getTracks({ vod_id: id }); 
}

log('==== 插件加载完成 V22 (最终版) ====');
