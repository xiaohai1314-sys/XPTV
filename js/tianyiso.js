/**
 * reboys.cn 前端插件 - V17 (最终正确版)
 * 
 * 核心修正:
 * 1. [最终确认] 根据您在浏览器中测试返回的JSON，确认了后端工作正常且数据结构清晰。
 * 2. [最终修正] search: 
 *    - 使用正确的路径 `data.data.data.results` 来访问结果列表。
 *    - 从 `item.links[0].url` 和 `item.links[0].password` 提取播放链接和密码，这是之前失败的关键原因。
 * 3. [恢复] 恢复所有功能，并清理了所有诊断代码。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000"; // 您的后端服务地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( ); // 假设环境提供此函数

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[reboys插件 V17] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 插件入口 ---
async function getConfig() {
    log("==== 插件初始化 V17 (最终正确版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V17)', site: SITE_URL, tabs: CATEGORIES });
}

// ★★★★★【首页/分类】★★★★★
let homeCache = null;
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    log(`[getCards] 获取分类ID="${categoryId}"`);
    try {
        if (!homeCache) {
            log(`[getCards] 缓存未命中，抓取首页HTML...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
        }
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
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
        log(`✓ 为分类 ${categoryId} 提取到 ${cards.length} 个卡片`);
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
        const { data } = await $fetch.get(url);
        
        if (data && data.code === 0) {
            const results = data.data?.data?.results || [];
            log(`✓ 解析到 ${results.length} 条搜索结果`);

            return jsonify({
                list: results.map(item => {
                    // [核心修正] 从 item.links 数组中提取链接和密码
                    const linkInfo = item.links && item.links.length > 0 ? item.links[0] : {};
                    const playUrl = linkInfo.url || '';
                    const playPwd = linkInfo.password || '';

                    return {
                        vod_id: jsonify({ type: 'search', url: playUrl, pwd: playPwd, title: item.title }),
                        vod_name: item.title,
                        vod_pic: item.image || FALLBACK_PIC,
                        vod_remarks: playPwd ? `码: ${playPwd}` : '直链'
                    };
                })
            });
        } else {
            log(`❌ 后端接口返回错误: ${data ? data.message : '无响应'}`);
            return jsonify({ list: [] });
        }
    } catch (e) {
        log(`❌ [search] 请求后端异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const idData = argsify(ext.vod_id);
    log(`[getTracks] 解析详情: ${JSON.stringify(idData)}`);

    try {
        if (idData.type === 'search') {
            const trackName = idData.pwd ? `${idData.title} (码: ${idData.pwd})` : idData.title;
            return jsonify({ list: [{ title: '播放列表', tracks: [{ name: trackName, url: idData.url }] }] });
        } 
        else if (idData.type === 'home') {
            log(`[getTracks] (首页源) 功能待开发`);
            return jsonify({ list: [] });
        }
        throw new Error('未知的 vod_id 类型');
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
async function play(flag, id) {
    log(`[play] 播放请求: flag=${flag}, id=${id}`);
    return jsonify({ url: id }); 
}
