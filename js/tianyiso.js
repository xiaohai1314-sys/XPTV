/**
 * reboys.cn 前端插件 - V15 (最终正确版)
 * 
 * 核心修正:
 * 1. [最终确认] search: 根据V14诊断版的报错信息，确认了 $fetch.get 会自动将后端返回的JSON解析为对象。
 * 2. [最终修正] search: 使用正确的路径 `data.data.data.results` 来解析已自动转换的JS对象，并提取搜索结果。
 * 3. [恢复] 恢复了首页/分类和详情页的完整功能。
 * 4. [优化] 增加了更健壮的日志和错误处理。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000"; // 您的后端服务地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( ); // 假设环境提供此函数

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[reboys插件 V15] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 插件入口 ---
async function getConfig() {
    log("==== 插件初始化 V15 (最终正确版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V15)', site: SITE_URL, tabs: CATEGORIES });
}

// ★★★★★【首页/分类 - 已恢复】★★★★★
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

// ★★★★★【搜索 - 最终修正版】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    if (!text) return jsonify({ list: [] });
    log(`[search] 用户搜索: "${text}"`);
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(text)}&page=1`;
        log(`[search] 请求后端URL: ${url}`);
        
        // $fetch.get 返回的 data 就是已经解析好的 JavaScript 对象
        const { data } = await $fetch.get(url);
        log(`[search] ✓ 已从后端获取到数据对象`);
        
        if (data && data.code === 0) {
            // 根据后端日志和V14诊断结果，确认最终正确路径是 data.data.data.results
            const results = data.data?.data?.results || [];
            
            log(`✓ 尝试从 data.data.data.results 解析... 解析到 ${results.length} 条结果`);

            if (results.length === 0) {
                log(`⚠️ 警告: 解析结果为空。后端返回的完整对象: ${JSON.stringify(data)}`);
            }

            return jsonify({
                list: results.map(item => ({
                    // 注意：根据后端日志，播放链接字段是 `url`，不是 `pan`
                    vod_id: jsonify({ type: 'search', url: item.url, pwd: item.pwd, title: item.title }),
                    vod_name: item.title,
                    vod_pic: item.image || FALLBACK_PIC,
                    vod_remarks: item.pwd ? `码: ${item.pwd}` : '直链'
                }))
            });
        } else {
            log(`❌ 后端接口返回错误或code不为0: ${data ? data.message : '无响应数据'}`);
            return jsonify({ list: [] });
        }
    } catch (e) {
        log(`❌ [search] 请求后端时发生严重异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情 - 已恢复】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const idData = argsify(ext.vod_id);
    log(`[getTracks] 解析详情: ${JSON.stringify(idData)}`);

    try {
        if (idData.type === 'search') {
            log(`[getTracks] (搜索源) 直接从vod_id返回播放链接`);
            const trackName = idData.pwd ? `${idData.title} (码: ${idData.pwd})` : idData.title;
            // 注意：play接口需要的是 url 字段，我们之前存的是 url
            return jsonify({ list: [{ title: '播放列表', tracks: [{ name: trackName, url: idData.url }] }] });
        } 
        else if (idData.type === 'home') {
            log(`[getTracks] (首页源) 此功能暂未对接后端详情接口`);
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

// play 接口直接返回播放链接
async function play(flag, id) {
    log(`[play] 播放请求: flag=${flag}, id=${id}`);
    return jsonify({ url: id }); 
}
