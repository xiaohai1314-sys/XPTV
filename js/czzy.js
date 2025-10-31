/**
 * 4k热播影视 前端插件 - V4.2 (最终修复版)
 *
 * 更新日志:
 * - V4.2 (由 Manus AI 修正):
 *   - 恢复了 category() 兼容接口的正确逻辑，解决了 V4.1 中列表不显示的问题。
 *   - 保留了 getCards() 中的分页判断，以防止无限重复加载的bug。
 *
 * - V4.1 (由 Manus AI 修复):
 *   - 修复了 getCards() 函数中的分页逻辑。
 *
 * - V4.0 (用户提供):
 *   - 原始可工作版本，但存在无限加载bug。
 */

// --- 配置区 ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 后端API地址 (仅供搜索使用)
const API_ENDPOINT = "http://127.0.0.1:3000/search"; // 【重要】请替换成您的后端服务地址

// 目标网站域名 (供首页抓取使用 )
const SITE_URL = "https://reboys.cn";
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http' )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- App 插件入口函数 ---

async function getConfig() {
    log("==== 插件初始化 V4.2 (最终修复版) ====");
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: 4.2,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - HTML抓取模式】★★★★★
// 【已修复】增加了分页判断，防止无限重复加载
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = parseInt(ext.page || 1, 10); // 获取当前请求的页码

    log(`[getCards] 请求分类ID: ${categoryId}, 页码: ${page} (HTML抓取模式)`);

    // --- 核心修复逻辑 ---
    // 如果请求的不是第一页，直接返回空列表，从而停止前端的无限加载。
    if (page > 1) {
        log(`[getCards] 页码 > 1，返回空列表以停止加载。`);
        return jsonify({ list: [] });
    }
    // --- 修复结束 ---

    try {
        log(`[getCards] 正在从 ${SITE_URL} 获取首页HTML (仅处理第一页)...`);
        const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        if (contentBlock.length === 0) {
            log(`[getCards] ❌ 找不到ID为 ${categoryId} 的内容块`);
            return jsonify({ list: [] });
        }

        contentBlock.find('a.item').each((_, element) => {
            const cardElement = $(element);
            const detailUrl = cardElement.attr('href');
            
            cards.push({
                vod_id: getCorrectUrl(detailUrl),
                vod_name: cardElement.find('p').text().trim(),
                vod_pic: getCorrectUrl(cardElement.find('img').attr('src')),
                vod_remarks: '',
                ext: { url: getCorrectUrl(detailUrl) }
            });
        });

        log(`[getCards] ✓ 成功提取 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}


// ★★★★★【搜索功能 - 后端API模式】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    if (page > 1) {
        log(`[search] 请求页码 > 1，返回空列表以停止无限加载。`);
        return jsonify({ list: [] });
    }

    log(`[search] 搜索关键词: "${searchText}" (后端API模式)`);

    if (!searchText) {
        return jsonify({ list: [] });
    }

    const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}`;
    log(`[search] 正在请求后端API: ${requestUrl}`);

    try {
        const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        const response = JSON.parse(jsonString);

        if (response.code !== 0) {
            log(`[search] ❌ 后端服务返回错误: ${response.message}`);
            return jsonify({ list: [] });
        }

        const results = response.data?.data?.results;
        if (!results || !Array.isArray(results)) {
            log(`[search] ❌ 在返回的JSON中找不到 results 数组`);
            return jsonify({ list: [] });
        }
        
        const cards = results.map(item => {
            if (!item || !item.title || !item.links || item.links.length === 0) return null;
            const finalUrl = item.links[0].url;
            return {
                vod_id: finalUrl,
                vod_name: item.title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: item.datetime ? new Date(item.datetime).toLocaleDateString() : '未知时间',
                ext: { url: finalUrl }
            };
        }).filter(card => card !== null);

        log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 请求或解析JSON时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url;
    
    if (!id) {
        log(`[getTracks] ❌ URL为空`);
        return jsonify({ list: [] });
    }

    if (id.includes('pan.quark.cn') || id.includes('pan.baidu.com') || id.includes('aliyundrive.com')) {
        log(`[getTracks] ✓ 检测到最终网盘链接，直接使用: ${id}`);
        
        let panName = '网盘资源';
        if (id.includes('quark')) panName = '夸克网盘';
        else if (id.includes('baidu')) panName = '百度网盘';
        else if (id.includes('aliyundrive')) panName = '阿里云盘';

        return jsonify({
            list: [{ title: '点击播放', tracks: [{ name: panName, pan: id, ext: {} }] }]
        });
    } else {
        log(`[getTracks] 检测到中间页链接，需要请求后端API进行解析: ${id}`);
        const keyword = id.split('/').pop().replace('.html', '');
        const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
        
        log(`[getTracks] 正在请求后端API: ${requestUrl}`);
        try {
            const { data: jsonString } = await $fetch.get(requestUrl);
            const response = JSON.parse(jsonString);
            const results = response.data?.data?.results;

            if (!results || results.length === 0) {
                throw new Error("API未能解析出有效链接");
            }

            const finalUrl = results[0].links[0].url;
            log(`[getTracks] ✓ API成功解析出链接: ${finalUrl}`);
            
            let panName = '夸克网盘';
            if (finalUrl.includes('baidu')) panName = '百度网盘';
            else if (finalUrl.includes('aliyundrive')) panName = '阿里云盘';

            return jsonify({
                list: [{ title: '解析成功', tracks: [{ name: panName, pan: finalUrl, ext: {} }] }]
            });

        } catch (e) {
            log(`[getTracks] ❌ 解析中间页时发生异常: ${e.message}`);
            return jsonify({
                list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: id, ext: {} }] }]
            });
        }
    }
}


// --- 兼容接口 (与V4.0完全相同) ---
async function init() { return getConfig(); }
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

// 【已恢复】此函数已恢复到V4.0的正确版本
async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}

async function detail(id) { 
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}
async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}
