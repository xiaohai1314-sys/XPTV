/**
 * =================================================================
 * 最终可用脚本 - 融合 v23 优化逻辑
 * 版本: 24 (最终整合版)
 *
 * 更新日志:
 * - 本脚本将优化后的 v23 逻辑完整地整合回原始脚本框架中。
 * - 采用了 App 通用的函数命名 (home, category, detail, search) 以确保兼容性。
 * - [home] 函数返回 App 需要的分类列表 (class) 和过滤器 (filters)。
 * - [category] 函数按标准参数 (tid, pg) 获取分类页面内容。
 * - [detail] 函数返回结构化的播放列表 (list of {name, url})，以解决播放列表的识别问题。
 * - [search] 函数按标准参数 (wd) 执行搜索。
 * - 保留了 v21 的双重策略（精准优先+兼容回退）来提取网盘链接和访问码，确保了最高的成功率。
 * - 这是为 XPTV 等通用 App 优化的、稳定且兼容性强的最终版本。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const site = 'https://www.leijing.xyz';
const cheerio = createCheerio( );

// App 主页: 提供分类信息 (原 getConfig)
async function home() {
    const categories = [
        { type_id: '?tagId=42204684250355', type_name: '剧集' },
        { type_id: '?tagId=42204681950354', type_name: '电影' },
        { type_id: '?tagId=42204792950357', type_name: '动漫' },
        { type_id: '?tagId=42204697150356', type_name: '纪录片' },
        { type_id: '?tagId=42210356650363', type_name: '综艺' },
        { type_id: '?tagId=42212287587456', type_name: '影视原盘' },
    ];
    // 返回符合通用App规范的格式
    return jsonify({
        class: categories,
        filters: {}
    });
}

// 分类页: 获取指定分类下的影视卡片列表 (原 getCards)
async function category(tid, pg, filter, extend) {
    const page = pg || 1;
    const url = `${site}/${tid}&page=${page}`;
    const { data } = await $fetch.get(url, { headers: { 'Referer': site, 'User-Agent': UA } });
    const $ = cheerio.load(data);
    let cards = [];

    $('.topicItem').each((index, each) => {
        if ($(each).find('.cms-lock-solid').length > 0) return;
        const href = $(each).find('h2 a').attr('href');
        const title = $(each).find('h2 a').text();
        const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
        const match = title.match(regex);
        const dramaName = match ? match[1] : title;
        const r = $(each).find('.summary').text();
        const tag = $(each).find('.tag').text();
        if (/content/.test(r) && !/cloud/.test(r)) return;
        if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
        cards.push({
            vod_id: href,
            vod_name: dramaName,
            vod_pic: '', // 雷鲸列表页没有图片
            vod_remarks: '',
        });
    });
    return jsonify({
        list: cards,
        page: page,
        pagecount: page + (cards.length < 20 ? 0 : 1), // 简单判断是否有下一页
        limit: cards.length,
        total: 0 // 网站未提供总数
    });
}

// 详情页: 获取播放列表（网盘链接）- (原 getTracks)
async function detail(ids) {
    const url = `${site}/${ids}`;
    const tracks = [];
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();
        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|访问|提取|解压)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // --- 策略一：v20 的精准匹配 (优先) ---
        const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code= )[^\s<)]*?(?:[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09])/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            const panUrl = match[0].split(/[\(（\uff08]/)[0].trim();
            const accessCode = match[1];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            tracks.push({ name: title, url: `${panUrl}#${accessCode}` });
            uniqueLinks.add(normalizedUrl);
        }

        // --- 策略二：v16 的广泛兼容模式 (回退) ---
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            const normalizedUrl = normalizePanUrl(href);
            if (uniqueLinks.has(normalizedUrl)) return;
            const contextText = $(el).parent().text();
            const localCode = extractAccessCode(contextText);
            const accessCode = localCode || globalAccessCode;
            tracks.push({ name: $(el).text().trim() || title, url: `${href}#${accessCode}` });
            uniqueLinks.add(normalizedUrl);
        });

        const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t|web\/share )\/[^\s<>()]+/gi;
        while ((match = urlPattern.exec(bodyText)) !== null) {
            const panUrl = match[0];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            const searchArea = bodyText.substring(Math.max(0, match.index - 50), match.index + panUrl.length + 50);
            const localCode = extractAccessCode(searchArea);
            const accessCode = localCode || globalAccessCode;
            tracks.push({ name: title, url: `${panUrl}#${accessCode}` });
            uniqueLinks.add(normalizedUrl);
        }

        // 返回结构化的播放列表
        if (tracks.length > 0) {
            return jsonify({
                title: "天翼云盘", // 线路名称
                list: tracks       // 直接返回包含 {name, url} 对象的数组
            });
        } else {
            return jsonify({ list: [] });
        }

    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({ list: [] });
    }
}

// 搜索功能
async function search(wd, quick, pg) {
    const page = pg || 1;
    const url = `${site}/search?keyword=${encodeURIComponent(wd)}&page=${page}`;
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    let cards = [];
    const searchItems = $('.search-result ul > li, .topic-list > .topic-item, .result-list > .item, ul.search-results > li.result-item, .topicItem, .searchModule .item');

    searchItems.each((index, each) => {
        const $item = $(each);
        const a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a');
        const href = a.attr('href');
        const title = a.text();
        if (!href || !title) return;
        const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
        const match = title.match(regex);
        const dramaName = match ? match[1] : title;
        const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim();
        if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
        cards.push({
            vod_id: href,
            vod_name: dramaName,
            vod_pic: $item.find('img').attr('src') || '',
            vod_remarks: tag,
        });
    });
    return jsonify({ list: cards });
}

// --- 辅助函数 (从原始脚本和优化脚本中合并) ---

function extractAccessCode(text) {
    if (!text) return '';
    // 匹配 (访问码:xxxx) 【访问码:xxxx】 访问码:xxxx 等多种格式
    let match = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (match && match[1]) return match[1];
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
    if (match && match[1]) return match[1];
    return '';
}

function normalizePanUrl(url) {
    try {
        const urlObj = new URL(url);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>(  )]+/);
        return match ? match[0].toLowerCase() : url.toLowerCase();
    }
}

// 播放函数，通常由App处理，这里提供一个标准桩函数
async function play(flag, id, flags) {
    return jsonify({
        parse: 0,
        url: id
    });
}

// 原始脚本中的 getPlayinfo 和 getConfig/getCards/getTracks 已被新的 home/category/detail 替代
// 保留一个空的 getPlayinfo 以防万一有旧App调用
async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] });
}
