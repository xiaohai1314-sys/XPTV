/**
 * reboys.cn 前端插件 - V36.0 (Base64兼容最终版)
 *
 * 版本说明:
 * - 【V36.0 核心修正】: 解决了 V35 版本中因修改 vod_id 导致App框架传递“无效的ID”的问题。
 * - 【Base64 编码】: `search` 函数不再直接用JSON字符串覆盖 `vod_id`，而是将完整的 item 数据序列化后进行 Base64 编码，生成一个对App框架安全的ID字符串。
 * - 【Base64 解码】: `getTracks` 函数接收到 Base64 编码的 `vod_id` 后，先进行解码，再解析出JSON数据，从而安全地获取到所有链接信息。
 * - 【内置 Polyfill】: 添加了 btoa 和 atob 的 polyfill，确保在缺少这两个函数的JS环境中也能正常运行。
 * - 【架构优势】: 此方案完美实现了“将复杂数据从列表页传递到详情页”的目标，同时完全兼容App框架对 `vod_id` 格式的要求（简单字符串）。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V36] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(obj) { return JSON.stringify(obj); }

// --- Base64 Polyfill (确保 btoa 和 atob 可用) ---
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function btoa(input = '') {
    let str = input;
    let output = '';
    for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || (map = '=', i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) { throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."); }
        block = block << 8 | charCode;
    }
    return output;
}
function atob(input = '') {
    let str = input.replace(/=+$/, '');
    let output = '';
    if (str.length % 4 == 1) { throw new Error("'atob' failed: The string to be decoded is not correctly encoded."); }
    for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V36.0 (Base64兼容最终版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V36)', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页/分类 (保持不变) ---
async function getCards(ext) {
    // ... 此函数逻辑与 V35 相同，为简洁省略，实际使用时请复制 V35 的完整代码 ...
    // ... 为保证完整性，这里再次贴出 ...
    ext = argsify(ext);
    const { id: categoryId } = ext;
    try {
        if (!homeCache) {
            log(`[getCards] 缓存为空，正在从 ${SITE_URL} 获取首页数据...`);
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
                    vod_id: jsonify({ type: 'home', path: detailPath, title: title }),
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '首页推荐'
                });
            }
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`[getCards] 获取首页/分类列表时发生异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}


// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ V36 核心修正：search函数，使用 Base64 编码 vod_id ★★★
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
        
        // ★ 核心修正: 将完整的 item 对象序列化并进行 Base64 编码，作为新的 vod_id
        const listWithBase64Id = response.list.map(item => {
            const itemJson = jsonify(item);
            item.vod_id = btoa(itemJson); // 使用 Base64 编码
            return item;
        });
        
        log(`[search] ✅ 成功获取并使用 Base64 处理了 ${listWithBase64Id.length} 条结果`);
        return jsonify({ list: listWithBase64Id });
    } catch (e) {
        log(`[search] 搜索过程中发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ V36 核心修正：getTracks函数，使用 Base64 解码 vod_id ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    const vodIdBase64 = ext.vod_id || '';
    if (!vodIdBase64) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无效的ID', pan: '' }] }] });
    }

    log(`[getTracks] 开始处理详情, 接收到的 Base64 ID: ${vodIdBase64.substring(0, 50)}...`);
    
    try {
        // ★ 核心修正: 先用 atob 解码，再用 argsify 解析
        const decodedJson = atob(vodIdBase64);
        const itemData = argsify(decodedJson);

        // 如果解码后是首页类型的数据，特殊处理
        if (itemData.type === 'home') {
             log('[getTracks] ID类型为 "home"，这是一个首页推荐项，没有直接链接。');
             return jsonify({ list: [{ title: '提示', tracks: [{ name: '此为首页推荐，请使用搜索功能查找资源', pan: '' }] }] });
        }

        // 从解码后的数据中提取链接
        const links = itemData.ext.links || [];
        log(`[getTracks] ✅ 成功解码并解析出 ${links.length} 个链接`);

        if (links.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
        }

        const tracks = links.map((linkData, index) => {
            const url = linkData.url;
            const password = linkData.password;
            let panType = '网盘';
            if (linkData.type === 'quark' || (url && url.includes('quark.cn'))) panType = '夸克';
            else if (linkData.type === 'aliyun' || (url && url.includes('aliyundrive.com'))) panType = '阿里';
            else if (linkData.type === 'baidu' || (url && url.includes('pan.baidu.com'))) panType = '百度';
            
            const buttonName = `${panType}网盘 ${index + 1}`;
            const finalPan = password ? `${url}（访问码：${password}）` : url;

            return { name: buttonName, pan: finalPan, ext: {} };
        });

        return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

    } catch (e) {
        log(`[getTracks] 处理详情时发生异常 (可能是Base64解码或JSON解析失败): ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `解析ID失败: ${e.message}`, pan: '' }] }] });
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

log('==== 插件加载完成 V36.0 (Base64兼容最终版) ====');
