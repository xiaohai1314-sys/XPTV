/**
 * reboys.cn 前端插件 - V37-StandardFormat (严格对齐成功案例格式)
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
    const logMsg = `[reboys V37] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件配置 ---
async function getConfig() {
    log("==== 插件初始化 V37 ====");
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
// ★★★ getTracks - 严格对齐成功案例的返回格式 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // 统一参数处理
    let safeId = '';
    if (typeof ext === 'string') {
        safeId = ext;
    } else if (ext && ext.vod_id) {
        safeId = ext.vod_id;
    } else {
        log(`[getTracks] 参数错误`);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: '参数错误', pan: '', ext: {} }]
            }]
        });
    }

    log(`[getTracks] 收到ID: ${safeId}`);

    // 首页推荐跳过
    try {
        const parsed = JSON.parse(safeId);
        if (parsed.type === 'home') {
            log(`[getTracks] 首页推荐暂不支持`);
            return jsonify({ list: [] });
        }
    } catch (e) {}

    // 拆分ID
    const parts = safeId.split('@@@');
    if (parts.length !== 2) {
        log(`[getTracks] ID格式错误: ${safeId}`);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: 'ID格式错误', pan: '', ext: {} }]
            }]
        });
    }

    const simpleId = parts[0];
    const keyword = parts[1];
    log(`[getTracks] id=${simpleId}, keyword=${keyword}`);

    try {
        // 请求后端
        const url = `${BACKEND_URL}/get_links?id=${encodeURIComponent(simpleId)}&keyword=${encodeURIComponent(keyword)}`;
        log(`[getTracks] 请求: ${url}`);
        
        const fetchResult = await $fetch.get(url);
        const response = argsify(fetchResult.data || fetchResult);

        if (!response.success || !response.links) {
            throw new Error(response.message || '未知错误');
        }

        const links = response.links;
        log(`[getTracks] ✅ 获取到 ${links.length} 个链接`);

        if (links.length === 0) {
            return jsonify({
                list: [{
                    title: '提示',
                    tracks: [{ name: '暂无链接', pan: '', ext: {} }]
                }]
            });
        }

        // ★★★ 核心逻辑：完全对齐成功案例的格式 ★★★
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
            
            // 构造按钮名称（完全模仿成功案例）
            let buttonName = panType + '网盘';
            
            // 如果有多个链接，加上序号
            if (links.length > 1) {
                buttonName += ' [' + (index + 1) + ']';
            }
            
            // 如果有密码，显示在按钮名称里
            if (password) {
                buttonName += ' [' + password + ']';
            }
            
            // ★★★ 关键：pan字段必须是纯净的URL字符串，什么都不加！★★★
            return { 
                name: buttonName, 
                pan: url,      // ← 只有URL，绝对不能加任何其他文字！
                ext: {}        // ← 空对象
            };
        });

        log(`[getTracks] ✅ 返回 ${tracks.length} 个按钮`);
        
        // ★★★ 严格按照成功案例的格式返回 ★★★
        return jsonify({
            list: [{
                title: '云盘资源',        // ← 组标题
                tracks: tracks           // ← 按钮数组
            }]
        });

    } catch (e) {
        log(`[getTracks] ❌ 异常: ${e.message}`);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: e.message, pan: '', ext: {} }]
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
    log(`[detail] 参数: ${JSON.stringify(id)}`);
    return getTracks(id);
}

log('==== 插件加载完成 V37 ====');
