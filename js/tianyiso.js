/**
 * reboys.cn 前端插件 - V13.3 (修正版)
 * 
 * 核心修正:
 * 1. [修正] search: 修正了从后端API解析搜索结果的数据路径，确保与后端server.js返回的结构一致。
 * 2. [增强] search: 增加了更详细的日志，当解析不到结果时会打印完整的后端响应，方便排查问题。
 * 3. [保持] home/category: 保持通过抓取并解析 reboys.cn 首页HTML来获取分类数据。
 * 4. [保持] detail: 保持对 'home' 和 'search' 两种来源的详情解析逻辑。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000"; // 您的后端服务地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( ); // 假设环境提供此函数

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[reboys插件 V13.2] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 插件入口 ---
async function getConfig() {
    log("==== 插件初始化 V13.2 (修正版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V13.2)', site: SITE_URL, tabs: CATEGORIES });
}

// ★★★★★【首页/分类 - 保持不变】★★★★★
let homeCache = null;
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    log(`[getCards] 获取分类ID="${categoryId}"`);

    try {
        if (!homeCache) {
            log(`[getCards] 缓存未命中，正在抓取首页HTML...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
        }
        
        const $ = cheerio.load(homeCache);
        const cards = [];
        
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        if (targetBlock.length === 0) {
            log(`❌ 在首页HTML中找不到分类ID为 ${categoryId} 的板块`);
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
        
        log(`✓ 从首页HTML为分类 ${categoryId} 提取到 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ [getCards] 异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索 - 路径修正】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    if (!text) return jsonify({ list: [] });
    log(`[search] 用户搜索: "${text}"`);
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(text)}&page=1`;
        const { data } = await $fetch.get(url);
        
        if (data && data.code === 0) {
            // 🔴 [核心修正] 根据后端日志，正确的路径是 data.data.data.results
            const results = data.data?.data?.results || [];
            
            log(`✓ 后端返回成功，尝试从 data.data.data.results 解析...`);
            log(`✓ 解析到 ${results.length} 条搜索结果`);

            if (results.length === 0) {
                log(`⚠️ 警告: 解析结果为空。打印完整后端响应用于调试:`);
                log(JSON.stringify(data));
            }

            return jsonify({
                list: results.map(item => ({
                    vod_id: jsonify({ type: 'search', pan: item.url, pwd: item.pwd, title: item.title }), // 将 title 也存起来
                    vod_name: item.title,
                    vod_pic: item.image || FALLBACK_PIC,
                    vod_remarks: item.pwd ? `码: ${item.pwd}` : '直链'
                }))
            });
        } else {
            log(`❌ 后端搜索接口返回错误或code不为0: ${data ? data.message : '无响应数据'}`);
            return jsonify({ list: [] });
        }
    } catch (e) {
        log(`❌ [search] 请求后端异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情 - 优化】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const idData = argsify(ext.vod_id);
    log(`[getTracks] 解析详情: ${JSON.stringify(idData)}`);

    try {
        if (idData.type === 'search') {
            log(`[getTracks] (搜索源) 直接从vod_id返回网盘链接`);
            const trackName = idData.pwd ? `${idData.title} (码: ${idData.pwd})` : idData.title;
            return jsonify({ list: [{ title: '播放列表', tracks: [{ name: trackName, pan: idData.pan }] }] });
        } 
        else if (idData.type === 'home') {
            log(`[getTracks] (首页源) 暂不支持从首页直接获取播放链接，此功能待开发`);
            // 实际应用中，这里也应该调用后端接口来解析详情页
            return jsonify({ list: [] });
        } else {
            throw new Error('未知的 vod_id 类型');
        }
    } catch (e) {
        log(`❌ [getTracks] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
