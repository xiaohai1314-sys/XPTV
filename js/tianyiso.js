/**
 * reboys.cn 前端插件 - V27.0 (最终正确版)
 * 变更日志:
 *  - 严格遵循用户指出的正确流程：“一个帖子就是一个卡片，点击后展示属于它的所有链接”。
 *  - search: 为每个帖子(item)生成一个卡片。vod_id包含该帖子的全部原始信息。
 *            remarks准确计算该帖子内部所有链接(包括content和links)的总数。
 *  - getTracks: 解析vod_id还原出帖子信息，合并content和links中的所有链接，
 *               并为每个链接生成带有自己独立标题的播放项。
 *  - 此方案是之前所有错误方案的最终修正，是唯一符合逻辑的正确实现。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000"; // ★★★ 请确保这是您后端的正确IP和端口 ★★★
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;

// --- 辅助函数 ---
function log(msg ) { const logMsg = `[reboys V27] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
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
    log("==== 插件初始化 V27 (最终正确版) ====");
    return jsonify({ ver: 1, title: 'reboys搜(V27)', site: "https://reboys.cn" } );
}

// ----------------------------------------------------------------------
// ★★★ search 函数 (正确实现) ★★★
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });

    log(`[search V27] 关键词: "${keyword}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const response = await $fetch.get(url);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;
        
        if (data.code !== 0) throw new Error(data.message || "后端代理返回错误");

        const results = data.data?.data?.results || data.data?.results || data.results || [];
        if (results.length === 0) {
            log('[search V27] 未找到任何结果');
            return jsonify({ list: [] });
        }

        const cards = results.map(item => {
            // ★ 正确计算总链接数
            const linksFromContent = parseLinksFromContent(item.content);
            const existingLinks = (item.links && Array.isArray(item.links)) ? item.links : [];
            const allLinks = [...existingLinks, ...linksFromContent];
            const uniqueUrls = new Set(allLinks.map(l => l.url));
            const remarks = `${uniqueUrls.size}个链接`;

            return {
                // ★ vod_id 包含当前这一个帖子的所有信息
                vod_id: jsonify(item), 
                vod_name: item.title,
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: remarks
            };
        });

        log(`[search V27] 生成了 ${cards.length} 个独立的卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[search V27] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// ★★★ getTracks 函数 (正确实现) ★★★
// ----------------------------------------------------------------------
async function getTracks(vod_id_str) {
    log(`[getTracks V27] 开始解析详情`);
    try {
        const item = argsify(vod_id_str);
        if (!item || !item.unique_id) {
            throw new Error("无效的 vod_id，无法解析成 item 对象");
        }

        log(`[getTracks V27] 正在处理帖子: ${item.title}`);

        // ★ 正确合并所有链接
        const linksFromContent = parseLinksFromContent(item.content);
        const existingLinks = (item.links && Array.isArray(item.links)) ? item.links : [];
        
        const combinedLinks = [...existingLinks];
        const existingUrls = new Set(combinedLinks.map(l => l.url));
        
        linksFromContent.forEach(newLink => {
            if (!existingUrls.has(newLink.url)) {
                combinedLinks.push(newLink);
            }
        });

        if (combinedLinks.length === 0) {
            return jsonify({ list: [{ tracks: [{ name: '暂无可用链接' }] }] });
        }

        // ★ 正确生成带独立标题的播放列表
        const tracks = combinedLinks.map(link => {
            // 优先使用链接自带的标题，如果为空，则使用帖子的主标题
            const trackTitle = link.title || item.title; 
            const password = link.password ? ` 码:${link.password}` : '';
            
            let panType = '未知';
            if (link.url.includes('quark.cn')) panType = '夸克';
            else if (link.url.includes('aliyundrive.com') || link.url.includes('alipan.com')) panType = '阿里';
            else if (link.url.includes('pan.baidu.com')) panType = '百度';

            const name = `[${panType}] ${trackTitle}${password}`.trim();
            return { name, pan: link.url };
        });

        const playUrls = tracks.map(t => `${t.name}$${t.pan}`).join('#');
        
        log(`[getTracks V27] 成功生成 ${tracks.length} 个播放轨道`);
        return jsonify({
            list: [{ title: item.title, tracks: tracks }],
            vod_play_from: '网盘列表',
            vod_play_url: playUrls
        });

    } catch (e) {
        log(`[getTracks V27] 异常: ${e.message}`);
        return jsonify({ list: [{ tracks: [{ name: '获取链接失败' }] }] });
    }
}

// --- 兼容接口 ---
async function home() { return jsonify({ list: [] }); }
async function category(tid, pg) { return jsonify({ list: [] }); }
async function detail(id) { return getTracks(id); }
async function play(flag, id) { return jsonify({ parse: 0, url: id }); }
