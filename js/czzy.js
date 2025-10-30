/**
 * reboys.cn 前端插件 - V38-DebugFix (修复ID格式和首页推荐问题)
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
    const logMsg = `[reboys V38] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件配置 ---
async function getConfig() {
    log("==== 插件初始化 V38 ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页/分类 ---
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
        if (targetBlock.length === 0) return jsonify({ list: [] });
        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            if (detailPath && title) {
                cards.push({
                    vod_id: 'HOME_ITEM',  // ★★★ 修改：使用特殊标记，不用JSON
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

// --- 搜索 ---
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 搜索: "${keyword}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);
        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        log(`[search] ✅ 返回 ${response.list.length} 条结果`);
        return jsonify({ list: response.list });
    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ getTracks - 修复ID解析和首页推荐问题 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // ★★★ 第一步：获取ID字符串 ★★★
    let safeId = '';
    
    // 处理各种可能的参数格式
    if (typeof ext === 'string') {
        safeId = ext;
        log(`[getTracks] 收到字符串参数: "${safeId}"`);
    } else if (ext && typeof ext === 'object') {
        if (ext.vod_id) {
            safeId = ext.vod_id;
            log(`[getTracks] 从对象提取vod_id: "${safeId}"`);
        } else {
            log(`[getTracks] ❌ 对象中没有vod_id字段: ${JSON.stringify(ext)}`);
            return jsonify({ list: [] });  // 静默返回空列表
        }
    } else {
        log(`[getTracks] ❌ 未知参数类型: ${typeof ext}`);
        return jsonify({ list: [] });
    }

    // ★★★ 第二步：检查是否是首页推荐 ★★★
    if (safeId === 'HOME_ITEM') {
        log(`[getTracks] 首页推荐，不处理`);
        return jsonify({ list: [] });  // 返回空列表，APP不会显示任何内容
    }

    // ★★★ 第三步：验证ID格式（必须包含@@@） ★★★
    if (!safeId.includes('@@@')) {
        log(`[getTracks] ❌ ID缺少分隔符: "${safeId}"`);
        log(`[getTracks] 这可能是首页推荐或其他非搜索结果`);
        return jsonify({ list: [] });  // 静默返回，不显示错误
    }

    // ★★★ 第四步：拆分ID ★★★
    const parts = safeId.split('@@@');
    if (parts.length !== 2) {
        log(`[getTracks] ❌ ID格式错误，拆分后不是2部分: ${parts.length}`);
        log(`[getTracks] parts: ${JSON.stringify(parts)}`);
        return jsonify({
            list: [{
                title: '提示',
                tracks: [{ name: '数据格式异常，请重新搜索', pan: '', ext: {} }]
            }]
        });
    }

    const simpleId = parts[0];
    const keyword = parts[1];
    log(`[getTracks] ✅ ID解析成功 - 索引=${simpleId}, 关键词=${keyword}`);

    // ★★★ 第五步：请求后端获取链接 ★★★
    try {
        const url = `${BACKEND_URL}/get_links?id=${encodeURIComponent(simpleId)}&keyword=${encodeURIComponent(keyword)}`;
        log(`[getTracks] 请求后端: ${url}`);
        
        const fetchResult = await $fetch.get(url);
        log(`[getTracks] 后端响应: ${JSON.stringify(fetchResult.data).substring(0, 200)}`);
        
        const response = argsify(fetchResult.data || fetchResult);

        if (!response.success) {
            log(`[getTracks] ❌ 后端返回失败: ${response.message}`);
            throw new Error(response.message || '后端返回失败');
        }

        if (!response.links || response.links.length === 0) {
            log(`[getTracks] ⚠️ 后端返回成功但无链接`);
            return jsonify({
                list: [{
                    title: '提示',
                    tracks: [{ name: '该资源暂无可用链接', pan: '', ext: {} }]
                }]
            });
        }

        const links = response.links;
        log(`[getTracks] ✅ 成功获取 ${links.length} 个链接`);

        // ★★★ 第六步：转换为APP格式 ★★★
        const tracks = links.map((linkData, index) => {
            const url = linkData.url || '';
            const password = linkData.password || '';
            
            // 识别网盘类型
            let panType = '网盘';
            if (linkData.type === 'quark' || url.includes('quark.cn')) {
                panType = '夸克';
            } else if (linkData.type === 'aliyun' || url.includes('aliyundrive.com')) {
                panType = '阿里';
            } else if (linkData.type === 'baidu' || url.includes('pan.baidu.com')) {
                panType = '百度';
            }
            
            // 构造按钮名称
            let buttonName = panType + '网盘';
            if (links.length > 1) buttonName += ' [' + (index + 1) + ']';
            if (password) buttonName += ' [' + password + ']';
            
            log(`[getTracks] 按钮 ${index + 1}: ${buttonName} -> ${url}`);
            
            // 返回纯净格式
            return { 
                name: buttonName, 
                pan: url,
                ext: {}
            };
        });

        log(`[getTracks] ✅ 成功生成 ${tracks.length} 个按钮`);
        
        return jsonify({
            list: [{
                title: '云盘资源',
                tracks: tracks
            }]
        });

    } catch (e) {
        log(`[getTracks] ❌ 异常: ${e.message}`);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: `获取失败: ${e.message}`, pan: '', ext: {} }]
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
async function init() { return getConfig(); }
async function home() { 
    const c = await getConfig(); 
    return jsonify({ class: JSON.parse(c).tabs }); 
}
async function category(tid, pg) { 
    return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); 
}
async function detail(id) { 
    log(`[detail] 收到原始参数: ${JSON.stringify(id)}, 类型: ${typeof id}`);
    return getTracks(id);
}

log('==== 插件加载完成 V38 ====');
