/**
 * 找盘资源前端插件 - V1.7.3 (模糊搜索严格过滤版)
 * 说明：
 *  - 保持 V1.7.1 的所有结构与逻辑。
 *  - 仅增强 search()：过滤掉所有“非资源卡片”，彻底解决模糊搜索排序混乱。
 *  - 保留网盘排序(115 > 天翼 > 阿里 > 夸克) + 夸克画质排序。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.1.3:3004/api/get_real_url"; 
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;

// --- 辅助函数 ---
function log(msg) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http')) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }
let cardsCache = {};

// --- 插件入口函数 ---
async function getConfig() {
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// --- 首页分页保持不变 ---
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    const url = SITE_URL;

    try {
        const cacheKey = `category_${categoryName}`;
        let allCards = cardsCache[cacheKey];
        if (!allCards) {
            const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            allCards = [];
            const categorySpan = $(`span.fs-5.fw-bold:contains('${categoryName}')`);
            let rowDiv = categorySpan.closest('div.d-flex').parent().next('div.row');
            if (rowDiv.length === 0) rowDiv = categorySpan.closest('div.d-flex').next('div.row');
            rowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                const imgElement = linkElement.find('img.lozad');
                allCards.push({
                    vod_id: linkElement.attr('href') || "",
                    vod_name: linkElement.find('h2').text().trim() || "",
                    vod_pic: getCorrectPicUrl(imgElement.attr('data-src')),
                    vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "",
                    ext: { url: linkElement.attr('href') || "" }
                });
            });
            cardsCache[cacheKey] = allCards;
        }
        const startIdx = (page - 1) * PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, startIdx + PAGE_SIZE);
        return jsonify({ list: pageCards });

    } catch (e) {
        return jsonify({ list: [] });
    }
}

// --- 新增：115 链接清理 ---
function clean115Link(link) {
    if (typeof link === 'string') {
        const original = link;
        link = link.replace('//115cdn.com/', '//115.com/').replace(/[&#]+$/, '');
    }
    return link;
}

// ★★★★★【关键：模糊搜索严格过滤版】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });

    const url = `${SITE_URL}/s/${encodeURIComponent(text)}/0/${page}`;
    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);

        const cards = [];
        const panOrder = ['115', '天翼', '阿里', '夸克'];
        const quarkOrder = ['4K', '原盘', 'REMUX', '杜比', 'UHD', '蓝光', '次世代', '1080P'];

        $("a.resource-item").each((_, item) => {
            const linkElement = $(item);

            // ★★★【严格过滤：必须满足资源三要素】★★★
            const title = linkElement.find('h2').text().trim();
            const panType = linkElement.find('span.text-success').text().trim();
            const href = linkElement.attr('href');

            if (!title) return;                     // 没标题 → 假卡片
            if (!panType) return;                   // 没网盘类型 → 假卡片
            if (!href || !href.startsWith('/')) return; // 外部跳转 / 分类推荐 → 假卡片

            // 过滤迅雷/百度
            if (panType.includes('迅雷') || panType.includes('百度')) return;

            let resourceLink = href;

            // 115 清理
            if (panType.includes('115')) {
                resourceLink = clean115Link(resourceLink);
            }

            const card = {
                vod_id: resourceLink,
                vod_name: title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: `[${panType}]`,
                ext: { url: resourceLink },
                _panType: panType,
                _quality: null
            };

            // 夸克画质识别
            if (panType.includes('夸克')) {
                const match = quarkOrder.find(q =>
                    title.toUpperCase().includes(q.toUpperCase())
                );
                if (!match) return;
                card._quality = match;
            }

            cards.push(card);
        });

        // 正式排序
        cards.sort((a, b) => {
            // 第一层：按网盘类型排序
            const ai = panOrder.findIndex(p => a._panType.includes(p));
            const bi = panOrder.findIndex(p => b._panType.includes(p));
            const A = ai === -1 ? 99 : ai;
            const B = bi === -1 ? 99 : bi;
            if (A !== B) return A - B;

            // 第二层：排序夸克画质
            if (a._panType.includes('夸克') && b._panType.includes('夸克')) {
                const aq = quarkOrder.indexOf(a._quality);
                const bq = quarkOrder.indexOf(b._quality);
                return aq - bq;
            }
            return 0;
        });

        return jsonify({ list: cards.map(({ _quality, _panType, ...rest }) => rest) });

    } catch (e) {
        return jsonify({ list: [] });
    }
}

// --- 详情页与兼容接口保持原样 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const middleUrl = getCorrectPicUrl(url);
    try {
        const apiUrl = `${API_ENDPOINT}?url=${encodeURIComponent(middleUrl)}`;
        const response = await $fetch.get(apiUrl);
        const result = JSON.parse(response.data);
        if (result.success && result.real_url) {
            let panName = '网盘链接';
            if (result.real_url.includes('quark')) panName = '夸克网盘';
            if (result.real_url.includes('aliyun')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: result.real_url, ext: {} }] }] });
        }
    } catch (_) {}

    return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }] });
}

async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
