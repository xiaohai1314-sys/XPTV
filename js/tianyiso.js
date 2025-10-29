/**
 * reboys.cn 纯前端插件 - V24 (模仿海绵小站模式)
 * 
 * 核心架构:
 * - 彻底移除后端依赖，所有操作均在前端插件内完成。
 * - search函数: 采用两步走策略获取API数据，并将【完整的API响应】存入vod_id。
 * - detail函数: 接收并解析vod_id中的完整数据，提取、拼接链接和密码，生成最终的、包含“纯净”网盘字符串的pan字段。
 * - 严格遵循成功案例（海绵小站）的前端闭环处理模式。
 */

// --- 配置区 ---
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;

// --- 辅助函数 ---
function log(msg ) { if (DEBUG) { try { $log(`[reboys V24] ${msg}`); } catch (_) { console.log(`[reboys V24] ${msg}`); } } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V24 (纯前端最终版) ====");
    return jsonify({
        ver: 1,
        title: '帝陵搜(V24)',
        site: SITE_URL,
        tabs: [{ name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } }],
    });
}

// --- 首页 (简化为关键词搜索) ---
async function getCards(ext) {
    ext = argsify(ext);
    const keyword = ext.id || '热门';
    return search({ text: keyword, page: 1 });
}

// ★★★★★【搜索 - 纯前端两步走】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1;
    if (!keyword) return jsonify({ list: [] });

    log(`[search] 关键词="${keyword}", 页=${page}`);

    try {
        // --- 第一步: 访问HTML页面，获取动态API-TOKEN ---
        const pageUrl = `${SITE_URL}/s/${encodeURIComponent(keyword)}.html`;
        log(`[search] 正在获取动态Token from: ${pageUrl}`);
        const pageResponse = await $fetch.get(pageUrl, { headers: { 'User-Agent': UA } });
        
        const tokenMatch = pageResponse.data.match(/const apiToken = "([^"]+)"/);
        if (!tokenMatch || !tokenMatch[1]) throw new Error("未能提取API Token");
        const dynamicApiToken = tokenMatch[1];
        log(`[search] ✓ 成功获取动态Token`);

        // --- 第二步: 使用动态Token请求数据API ---
        const apiUrl = `${SITE_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const apiResponse = await $fetch.get(apiUrl, {
            headers: { 'API-TOKEN': dynamicApiToken, 'User-Agent': UA, 'Referer': pageUrl }
        });
        const apiData = argsify(apiResponse.data);
        if (apiData.code !== 0) throw new Error(`API返回错误: ${apiData.message}`);

        const results = apiData.data?.data?.results || [];
        log(`[search] ✓ API成功返回 ${results.length} 条结果`);

        const cards = results.map(item => {
            // ★ 核心：将【每个帖子的完整信息】作为JSON字符串存入vod_id
            return {
                vod_id: jsonify(item),
                vod_name: item.title,
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: `${(item.links || []).length}个资源`
            };
        });
        
        // 注意：此API似乎不支持分页，所以我们返回所有结果
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页 - 纯前端做饭】★★★★★
async function detail(id) {
    log(`[detail] 开始处理详情, 接收到的vod_id长度: ${id.length}`);
    
    try {
        const itemData = argsify(id); // 将vod_id还原为帖子信息对象
        if (!itemData || !itemData.links || itemData.links.length === 0) {
            throw new Error('无效的详情数据或无链接');
        }
        
        log(`[detail] ✓ 解析成功，找到 ${itemData.links.length} 个链接`);
        
        const tracks = itemData.links.map(link => {
            let panType = '网盘';
            const url = link.url || '';
            if (url.includes('quark.cn')) panType = '夸克';
            else if (url.includes('pan.baidu.com')) panType = '百度';
            
            const password = link.password;
            const name = `[${panType}] ${itemData.title}`;

            // ★ 核心：模仿海绵小站，拼接链接和密码
            const finalPan = password ? `${url}（访问码：${password}）` : url;
            
            return { 
                name: name,
                pan: finalPan, // ★ 将拼接好的“纯净”字符串喂给App
                ext: {}
            };
        });
        
        // 返回与成功案例一致的list结构
        return jsonify({
            list: [{
                title: '网盘资源',
                tracks: tracks
            }]
        });

    } catch (e) {
        log(`[detail] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: tid, page: pg }); }
async function play(flag, id, flags) { log(`[play] 被调用, id=${id}`); return jsonify({ parse: 0, url: id }); }
