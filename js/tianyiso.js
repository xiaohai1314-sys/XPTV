/**
 * reboys.cn 前端插件 - V35.0 (前后端完全匹配最终版)
 *
 * 版本说明:
 * - 【V35.0 核心架构修正】: 彻底废除了 V34 中错误的 "search -> get_links" 两步请求架构。
 * - 【适配后端】: 完美适配 V22 后端 "一次性返回所有数据" 的模式。
 * - 【统一 vod_id】: 无论来自搜索还是首页，`vod_id` 均被统一为包含完整信息的 JSON 字符串，彻底解决了“参数错误，无法解析”的问题。
 * - 【流程再造】: 
 *    - `search` 函数现在接收到后端的完整数据后，会将每个条目（包含链接的 ext 部分）序列化并存入 `vod_id`。
 *    - `getTracks` 函数不再进行任何网络请求，而是直接反序列化 `vod_id`，从中提取链接并渲染，实现了“秒开”详情页。
 * - 【首页兼容】: 对 `getCards` (首页) 的 `vod_id` 格式做了同样处理，但由于后端首页逻辑与搜索逻辑不同，引导用户通过搜索获取资源。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000"; // 请确保这个地址在App的运行环境中可以访问
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V35] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V35.0 (前后端完全匹配最终版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V35)', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页/分类 (逻辑保留，但 vod_id 格式已修正) ---
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    try {
        if (!homeCache) {
            log(`[getCards] 缓存为空，正在从 ${SITE_URL} 获取首页数据...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
            log(`[getCards] 首页数据获取并缓存成功。`);
        } else {
            log(`[getCards] 使用已缓存的首页数据。`);
        }
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        if (targetBlock.length === 0) {
            log(`[getCards] 在分类ID ${categoryId}下未找到任何内容块。`);
            return jsonify({ list: [] });
        }
        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            if (detailPath && title) {
                cards.push({
                    // ★ 核心修正: 统一 vod_id 为 JSON 字符串格式
                    vod_id: jsonify({ type: 'home', path: detailPath, title: title }),
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '首页推荐'
                });
            }
        });
        log(`[getCards] 分类ID ${categoryId} 共找到 ${cards.length} 个推荐项。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[getCards] 获取首页/分类列表时发生异常: ${e.message}`);
        homeCache = null; // 清除可能已损坏的缓存
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ V35 核心修正：search函数，接收完整数据并序列化到 vod_id ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 开始搜索: "${keyword}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);
        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        
        // ★ 核心修正: 不再拼接 vod_id，而是将后端返回的完整 item 序列化存入 vod_id
        const listWithSerializedId = response.list.map(item => {
            item.vod_id = jsonify({
                type: 'search',
                data: item // 将包含 links 的完整 item 对象存进去
            });
            return item;
        });
        
        log(`[search] ✅ 成功从后端获取并处理了 ${listWithSerializedId.length} 条结果`);
        return jsonify({ list: listWithSerializedId });
    } catch (e) {
        log(`[search] 搜索过程中发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ V35 核心修正：getTracks函数，直接从 vod_id 解析数据，不再请求网络 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    const vodIdString = ext.vod_id || '';
    if (!vodIdString) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无效的ID', pan: '' }] }] });
    }

    log(`[getTracks] 开始处理详情, 接收到的 vod_id: ${vodIdString.substring(0, 100)}...`);
    const idData = argsify(vodIdString);

    try {
        let links = [];
        // 根据 vod_id 的类型决定如何处理
        if (idData.type === 'search') {
            log('[getTracks] ID类型为 "search"，直接从ID中提取链接。');
            links = idData.data.ext.links || [];
        } else if (idData.type === 'home') {
            log('[getTracks] ID类型为 "home"，这是一个首页推荐项，没有直接链接。');
            // 首页推荐项没有链接数据，只能提示用户去搜索
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '此为首页推荐，请使用搜索功能查找资源', pan: '' }] }] });
        } else {
            // 兼容可能存在的未知格式
            throw new Error(`未知的vod_id类型或格式: ${idData.type || '无类型'}`);
        }

        log(`[getTracks] ✅ 成功解析出 ${links.length} 个链接`);

        if (links.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
        }

        // 前端进行map循环，生成按钮 (此逻辑无需改变)
        const tracks = links.map((linkData, index) => {
            const url = linkData.url;
            const password = linkData.password;
            let panType = '网盘';
            if (linkData.type === 'quark' || (url && url.includes('quark.cn'))) panType = '夸克';
            else if (linkData.type === 'aliyun' || (url && url.includes('aliyundrive.com'))) panType = '阿里';
            else if (linkData.type === 'baidu' || (url && url.includes('pan.baidu.com'))) panType = '百度';
            
            const buttonName = `${panType}网盘 ${index + 1}`;
            // 如果有访问码，则拼接到链接后面，方便用户复制
            const finalPan = password ? `${url}（访问码：${password}）` : url;

            return { name: buttonName, pan: finalPan, ext: {} };
        });

        return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

    } catch (e) {
        log(`[getTracks] 处理详情时发生异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `解析失败: ${e.message}`, pan: '' }] }] });
    }
}

// --- 播放函数 (备用) ---
async function play(flag, id) {
    log(`[play] 触发播放, flag=${flag}, id=${id}`);
    if (id && (id.startsWith('http' ) || id.startsWith('//'))) {
        return jsonify({ parse: 0, url: id, header: {} });
    }
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }

log('==== 插件加载完成 V35.0 (前后端完全匹配最终版) ====');
