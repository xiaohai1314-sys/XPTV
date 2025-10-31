/**
 * reboys.cn 前端插件 - V39-SuperDebug (超级调试版)
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.107:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio();

let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V39] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件配置 ---
async function getConfig() {
    log("==== 插件初始化 V39-SuperDebug ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页/分类 ---
async function getCards(ext) {
    log(`[getCards] ===== 开始执行 =====`);
    log(`[getCards] 收到参数: ${JSON.stringify(ext)}`);
    
    ext = argsify(ext);
    const { id: categoryId } = ext;
    
    log(`[getCards] 分类ID: ${categoryId}`);
    
    try {
        if (!homeCache) {
            log(`[getCards] 缓存未命中，开始获取首页`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
            log(`[getCards] ✅ 首页数据已缓存`);
        } else {
            log(`[getCards] 使用缓存的首页数据`);
        }
        
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        
        log(`[getCards] 找到的block数量: ${targetBlock.length}`);
        
        if (targetBlock.length === 0) {
            log(`[getCards] ⚠️ 未找到分类block，返回空列表`);
            return jsonify({ list: [] });
        }
        
        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            if (detailPath && title) {
                cards.push({
                    vod_id: 'HOME_ITEM',
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '首页推荐'
                });
            }
        });
        
        log(`[getCards] ✅ 提取了 ${cards.length} 个卡片`);
        const result = jsonify({ list: cards });
        log(`[getCards] 返回数据长度: ${result.length} 字符`);
        return result;
        
    } catch (e) {
        log(`[getCards] ❌ 异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// --- 搜索 ---
async function search(ext) {
    log(`[search] ===== 开始执行 =====`);
    log(`[search] 收到参数: ${JSON.stringify(ext)}`);
    
    ext = argsify(ext);
    const keyword = ext.text || '';
    
    if (!keyword) {
        log(`[search] ⚠️ 关键词为空`);
        return jsonify({ list: [] });
    }
    
    log(`[search] 搜索关键词: "${keyword}"`);
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        log(`[search] 请求URL: ${url}`);
        
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        log(`[search] 后端响应: ${JSON.stringify(fetchResult).substring(0, 300)}`);
        
        const response = argsify(fetchResult.data || fetchResult);
        
        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        
        log(`[search] ✅ 返回 ${response.list.length} 条结果`);
        
        // 打印前3条结果的vod_id，用于调试
        response.list.slice(0, 3).forEach((item, i) => {
            log(`[search] 结果${i}: vod_id="${item.vod_id}", name="${item.vod_name}"`);
        });
        
        return jsonify({ list: response.list });
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ getTracks - 超级调试版 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    log(`[getTracks] ========== 开始执行 ==========`);
    log(`[getTracks] 收到原始参数: ${JSON.stringify(ext)}`);
    log(`[getTracks] 参数类型: ${typeof ext}`);
    
    // 获取ID字符串
    let safeId = '';
    
    if (typeof ext === 'string') {
        safeId = ext;
        log(`[getTracks] → 参数是字符串: "${safeId}"`);
    } else if (ext && typeof ext === 'object') {
        if (ext.vod_id) {
            safeId = ext.vod_id;
            log(`[getTracks] → 从对象中提取vod_id: "${safeId}"`);
        } else {
            log(`[getTracks] → 对象中没有vod_id，字段有: ${Object.keys(ext).join(', ')}`);
            return jsonify({ list: [] });
        }
    } else {
        log(`[getTracks] → 未知参数类型`);
        return jsonify({ list: [] });
    }

    // 检查是否是首页推荐
    if (safeId === 'HOME_ITEM') {
        log(`[getTracks] → 这是首页推荐，返回空列表`);
        return jsonify({ list: [] });
    }

    // 检查是否包含分隔符
    if (!safeId.includes('@@@')) {
        log(`[getTracks] → ID不包含'@@@'分隔符`);
        log(`[getTracks] → 可能是首页推荐或其他类型，返回空列表`);
        return jsonify({ list: [] });
    }

    // 拆分ID
    const parts = safeId.split('@@@');
    log(`[getTracks] → 拆分结果: ${parts.length} 部分`);
    
    if (parts.length !== 2) {
        log(`[getTracks] → ❌ 拆分后不是2部分`);
        parts.forEach((part, i) => {
            log(`[getTracks]    部分${i}: "${part}"`);
        });
        return jsonify({
            list: [{
                title: '提示',
                tracks: [{ name: '数据格式异常', pan: '', ext: {} }]
            }]
        });
    }

    const simpleId = parts[0];
    const keyword = parts[1];
    log(`[getTracks] → ✅ 解析成功`);
    log(`[getTracks]    索引: "${simpleId}"`);
    log(`[getTracks]    关键词: "${keyword}"`);

    // 请求后端
    try {
        const url = `${BACKEND_URL}/get_links?id=${encodeURIComponent(simpleId)}&keyword=${encodeURIComponent(keyword)}`;
        log(`[getTracks] → 请求后端: ${url}`);
        
        const fetchResult = await $fetch.get(url);
        log(`[getTracks] → 后端原始响应: ${JSON.stringify(fetchResult).substring(0, 500)}`);
        
        const response = argsify(fetchResult.data || fetchResult);
        log(`[getTracks] → 解析后: success=${response.success}, links数量=${response.links ? response.links.length : 0}`);

        if (!response.success) {
            log(`[getTracks] → ❌ 后端返回失败: ${response.message}`);
            throw new Error(response.message || '后端返回失败');
        }

        if (!response.links || response.links.length === 0) {
            log(`[getTracks] → ⚠️ 无可用链接`);
            return jsonify({
                list: [{
                    title: '提示',
                    tracks: [{ name: '该资源暂无可用链接', pan: '', ext: {} }]
                }]
            });
        }

        const links = response.links;
        log(`[getTracks] → ✅ 获取到 ${links.length} 个链接`);

        // 转换为按钮
        const tracks = links.map((linkData, index) => {
            const url = linkData.url || '';
            const password = linkData.password || '';
            
            let panType = '网盘';
            if (linkData.type === 'quark' || url.includes('quark.cn')) panType = '夸克';
            else if (linkData.type === 'aliyun' || url.includes('aliyundrive.com')) panType = '阿里';
            else if (linkData.type === 'baidu' || url.includes('pan.baidu.com')) panType = '百度';
            
            let buttonName = panType + '网盘';
            if (links.length > 1) buttonName += ' [' + (index + 1) + ']';
            if (password) buttonName += ' [' + password + ']';
            
            log(`[getTracks] → 按钮${index + 1}: "${buttonName}" -> "${url}"`);
            
            return { name: buttonName, pan: url, ext: {} };
        });

        const result = {
            list: [{
                title: '云盘资源',
                tracks: tracks
            }]
        };
        
        log(`[getTracks] → ✅ 成功生成 ${tracks.length} 个按钮`);
        log(`[getTracks] → 返回数据: ${JSON.stringify(result)}`);
        
        return jsonify(result);

    } catch (e) {
        log(`[getTracks] → ❌ 异常: ${e.message}`);
        log(`[getTracks] → 堆栈: ${e.stack || '无'}`);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: `失败: ${e.message}`, pan: '', ext: {} }]
            }]
        });
    }
}

// --- 播放 ---
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    if (id && (id.startsWith('http') || id.startsWith('//'))) {
        return jsonify({ parse: 0, url: id, header: {} });
    }
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 ---
async function init() { 
    log(`[init] 被调用`);
    return getConfig(); 
}

async function home() { 
    log(`[home] 被调用`);
    const c = await getConfig(); 
    return jsonify({ class: JSON.parse(c).tabs }); 
}

async function category(tid, pg) { 
    log(`[category] 被调用, tid=${JSON.stringify(tid)}, pg=${pg}`);
    return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); 
}

async function detail(id) { 
    log(`[detail] ========== 被调用 ==========`);
    log(`[detail] 参数: ${JSON.stringify(id)}`);
    log(`[detail] 类型: ${typeof id}`);
    const result = await getTracks(id);
    log(`[detail] 返回数据长度: ${result.length} 字符`);
    return result;
}

log('==== 插件加载完成 V39-SuperDebug ====');
