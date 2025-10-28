/**
 * reboys.cn 前端插件 - V28.0 (功能完整最终版)
 * 变更日志:
 *  - 最终修正：恢复了被错误删除的 home 和 category 功能，确保插件完整性。
 *  - 核心逻辑：严格遵循“一个帖子一个卡片，点击后展示其内部所有链接”的正确流程。
 *  - 细节完善：修复了 getTracks 中网盘类型识别不全的问题。
 *  - 稳定性：配合带缓存的后端V23，避免了无限循环的风险。
 *  - 这是整合了所有正确认知和修复了所有错误的最终版本。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000"; // ★★★ 请确保这是您后端的正确IP和端口 ★★★
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 辅助函数 ---
function log(msg) { const logMsg = `[reboys V28] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(obj) { return JSON.stringify(obj); }

// --- 前端核心解析函数 ---
function parseLinksFromContent(content) {
    if (!content || typeof content !== 'string') return [];
    const links = [];
    const regex = /(?:[\d]+[、\s\.]*)?(.*?)\s*[:：]\s*(https?:\/\/[^\s;]+ )(?:\s*(?:pwd=|提取码|码)[:：\s]*(\w+))?/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const title = match[1] ? match[1].trim().replace(/<[^>]+>/g, '') : '';
        const url = match[2].trim();
        const password = match[3] ? match[3].trim() : '';
        if (url) {
            links.push({ title, url, password });
        }
    }
    return links;
}

// --- 插件入口 ---
async function init() {
    log("==== 插件初始化 V28 (功能完整最终版) ====");
    return jsonify({
        ver: 1, 
        title: 'reboys搜(V28)', 
        site: SITE_URL
    });
}

// ----------------------------------------------------------------------
// ★★★ 恢复：home 和 category 功能 ★★★
// ----------------------------------------------------------------------
async function home() {
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ class: CATEGORIES });
}

let homeCache = null;
async function category(tid, pg) {
    const ext = argsify(tid);
    const categoryId = ext.id || tid;
    const page = pg || 1;
    log(`[category V28] 获取分类: ${categoryId}, 页码: ${page}`);
    try {
        if (!homeCache) {
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
        }
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            cards.push({
                vod_id: jsonify({ type: 'home', path: $item.attr('href') }),
                vod_name: $item.find('p').text().trim(),
                vod_pic: $item.find('img').attr('src') || FALLBACK_PIC,
                vod_remarks: '首页推荐'
            });
        });
        // 简单分页处理
        const start = (page - 1) * 12;
        const end = page * 12;
        return jsonify({ list: cards.slice(start, end) });
    } catch (e) {
        homeCache = null;
        log(`[category V28] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// ★★★ 核心：search 函数 ★★★
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });

    log(`[search V28] 关键词: "${keyword}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const response = await $fetch.get(url);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;
        
        if (data.code !== 0) throw new Error(data.message || "后端代理返回错误");

        const results = data.data?.data?.results || data.data?.results || data.results || [];
        if (results.length === 0) return jsonify({ list: [] });

        const cards = results.map(item => {
            const linksFromContent = parseLinksFromContent(item.content);
            const existingLinks = (item.links && Array.isArray(item.links)) ? item.links : [];
            const allLinks = [...existingLinks, ...linksFromContent];
            const uniqueUrls = new Set(allLinks.map(l => l.url));
            const remarks = `${uniqueUrls.size}个链接`;

            return {
                vod_id: jsonify(item), 
                vod_name: item.title,
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: remarks
            };
        });

        return jsonify({ list: cards });
    } catch (e) {
        log(`[search V28] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// ★★★ 核心：getTracks (由 detail 调用) ★★★
// ----------------------------------------------------------------------
async function getTracks(vod_id_str) {
    log(`[getTracks V28] 开始解析详情`);
    try {
        const item = argsify(vod_id_str);
        if (!item) throw new Error("无效的 vod_id");
        
        // 处理首页推荐的特殊逻辑
        if (item.type === 'home' && item.path) {
            log(`[getTracks V28] 暂不支持处理首页推荐详情: ${item.path}`);
            return jsonify({ list: [{ tracks: [{ name: '首页推荐暂不支持解析' }] }] });
        }

        if (!item.unique_id) throw new Error("非标准的搜索结果 item 对象");

        log(`[getTracks V28] 正在处理帖子: ${item.title}`);

        const linksFromContent = parseLinksFromContent(item.content);
        const existingLinks = (item.links && Array.isArray(item.links)) ? item.links : [];
        const combinedLinks = [...existingLinks];
        const existingUrls = new Set(combinedLinks.map(l => l.url));
        
        linksFromContent.forEach(newLink => {
            if (!existingUrls.has(newLink.url)) {
                combinedLinks.push(newLink);
            }
        });

        if (combinedLinks.length === 0) return jsonify({ list: [{ tracks: [{ name: '暂无可用链接' }] }] });

        const tracks = combinedLinks.map(link => {
            const trackTitle = link.title || item.title; 
            const password = link.password ? ` 码:${link.password}` : '';
            
            // ★★★ 完善的网盘类型识别 ★★★
            let panType = link.type || '未知';
            if (panType === '未知' || !panType) {
                 if (link.url.includes('quark.cn')) panType = '夸克';
                 else if (link.url.includes('aliyundrive.com') || link.url.includes('alipan.com')) panType = '阿里';
                 else if (link.url.includes('pan.baidu.com')) panType = '百度';
            }

            const name = `[${panType.toUpperCase()}] ${trackTitle}${password}`.trim();
            return { name, pan: link.url };
        });

        const playUrls = tracks.map(t => `${t.name}$${t.pan}`).join('#');
        
        return jsonify({
            list: [{ title: item.title, tracks: tracks }],
            vod_play_from: '网盘列表',
            vod_play_url: playUrls
        });

    } catch (e) {
        log(`[getTracks V28] 异常: ${e.message}`);
        return jsonify({ list: [{ tracks: [{ name: '获取链接失败' }] }] });
    }
}

// --- 兼容接口 ---
async function detail(id) { return getTracks(id); }
async function play(flag, id) { return jsonify({ parse: 0, url: id }); }
