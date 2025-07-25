/**
 * =================================================================
 * 最终可用脚本 - 融合 v16 和 v20 优点，并适配通用 App 规范
 * 版本: 22 (兼容版)
 *
 * 更新日志:
 * - 参照可识别脚本的规范，重命名核心函数 (home, category, detail, search)。
 * - 调整了 home, category, detail, search 函数的输入参数和输出格式，以符合通用 App 标准。
 * - 移除了全局 appConfig，将配置信息整合到相应函数中，提高模块化。
 * - 继承了 v21 版本的双重策略（精准优先+兼容回退）来提取网盘链接和访问码。
 * - 这是为 XPTV 等通用 App 优化的、稳定且兼容性强的版本。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const site = 'https://www.leijing.xyz';
const cheerio = createCheerio( );

// App 主页: 提供分类信息
async function home() {
    const categories = [
        { type_id: '?tagId=42204684250355', type_name: '剧集' },
        { type_id: '?tagId=42204681950354', type_name: '电影' },
        { type_id: '?tagId=42204792950357', type_name: '动漫' },
        { type_id: '?tagId=42204697150356', type_name: '纪录片' },
        { type_id: '?tagId=42210356650363', type_name: '综艺' },
        { type_id: '?tagId=42212287587456', type_name: '影视原盘' },
    ];
    return jsonify({
        class: categories,
        filters: {} // 很多App需要这个字段，即使为空
    });
}

// 分类页: 获取指定分类下的影视卡片列表
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

// 详情页: 获取播放列表（网盘链接）
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

        // 策略一：精准匹配
        const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code= )[^\s<)]*?(?:[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09])/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            const panUrl = match[0].split(/[\(（\uff08]/)[0].trim();
            const accessCode = match[1];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            tracks.push(`${title}$${panUrl}#${accessCode}`);
            uniqueLinks.add(normalizedUrl);
        }

        // 策略二：广泛兼容模式
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            const normalizedUrl = normalizePanUrl(href);
            if (uniqueLinks.has(normalizedUrl)) return;
            const contextText = $(el).parent().text();
            const localCode = extractAccessCode(contextText);
            const accessCode = localCode || globalAccessCode;
            tracks.push(`${$(el).text().trim() || title}$${href}#${accessCode}`);
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
            tracks.push(`${title}$${panUrl}#${accessCode}`);
            uniqueLinks.add(normalizedUrl);
        }

        const play_from = "天翼云盘";
        const play_url = tracks.join('$$$');

        return jsonify({
            list: [{
                vod_id: ids,
                vod_name: title,
                vod_play_from: play_from,
                vod_play_url: play_url,
            }]
        });

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

// --- 辅助函数 ---

function extractAccessCode(text) {
    if (!text) return '';
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

// 很多App不直接支持 getPlayinfo, 此处保留为空以防万一
async function play(flag, id, flags) {
    return jsonify({
        parse: 0,
        url: id
    });
}
