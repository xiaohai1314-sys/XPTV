/**
 * 4k热播影视 前端插件 - V4.0 (屏幕日志诊断版)
 *
 * 目的:
 * - 由于无法查看console.log，此版本将调试信息直接显示在屏幕上。
 * - getCards() 函数会将接收到的参数作为第一个卡片的标题(vod_name)来显示。
 * - 预期行为: 列表能正常显示，但会无限循环。第一个卡片的标题会是 "Debug Info: ..."
 * - 请将看到的卡片标题信息告诉我。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://127.0.0.1:3000/search";
const SITE_URL = "https://reboys.cn";
// --- 配置区结束 ---

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;

// --- 辅助函数 (与V4.0完全相同) ---
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http' )) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- App 插件入口函数 ---

async function getConfig() {
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: "4.0-screen-diag",
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - 屏幕日志核心】★★★★★
async function getCards(ext) {
    const originalExtString = JSON.stringify(ext); // 获取原始参数字符串
    
    ext = argsify(ext);
    const categoryId = ext.id;

    try {
        const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        // --- 屏幕日志注入 ---
        // 将调试信息作为第一个卡片
        cards.push({
            vod_id: 'debug_info',
            vod_name: `Debug Info: ${originalExtString}`, // 在标题显示参数
            vod_pic: FALLBACK_PIC, // 使用一个默认图片
            vod_remarks: '请把此标题内容告诉我',
            ext: { url: SITE_URL }
        });
        // --- 注入结束 ---

        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        if (contentBlock.length === 0) {
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

        return jsonify({ list: cards });
        
    } catch (e) {
        return jsonify({ list: [] });
    }
}

// (其他函数保持V4.0原样，为简洁省略了log)
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);
    if (page > 1) { return jsonify({ list: [] }); }
    if (!searchText) { return jsonify({ list: [] }); }
    const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}`;
    try {
        const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        const response = JSON.parse(jsonString);
        if (response.code !== 0) { return jsonify({ list: [] }); }
        const results = response.data?.data?.results;
        if (!results || !Array.isArray(results)) { return jsonify({ list: [] }); }
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
        return jsonify({ list: cards });
    } catch (e) { return jsonify({ list: [] }); }
}
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url;
    if (!id) { return jsonify({ list: [] }); }
    if (id.includes('pan.quark.cn') || id.includes('pan.baidu.com') || id.includes('aliyundrive.com')) {
        let panName = '网盘资源';
        if (id.includes('quark')) panName = '夸克网盘';
        else if (id.includes('baidu')) panName = '百度网盘';
        else if (id.includes('aliyundrive')) panName = '阿里云盘';
        return jsonify({ list: [{ title: '点击播放', tracks: [{ name: panName, pan: id, ext: {} }] }] });
    } else {
        const keyword = id.split('/').pop().replace('.html', '');
        const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
        try {
            const { data: jsonString } = await $fetch.get(requestUrl);
            const response = JSON.parse(jsonString);
            const results = response.data?.data?.results;
            if (!results || results.length === 0) { throw new Error("API未能解析出有效链接"); }
            const finalUrl = results[0].links[0].url;
            let panName = '夸克网盘';
            if (finalUrl.includes('baidu')) panName = '百度网盘';
            else if (finalUrl.includes('aliyundrive')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: finalUrl, ext: {} }] }] });
        } catch (e) {
            return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: id, ext: {} }] }] });
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
async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}
async function detail(id) { 
    return getTracks({ url: id }); 
}
async function play(flag, id) { 
    return jsonify({ url: id }); 
}
