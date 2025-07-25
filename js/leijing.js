/**
 * =================================================================
 * 最终可用脚本 - 像素级复刻兼容格式
 * 版本: 25 (决战版)
 *
 * 更新日志:
 * - 彻底放弃自定义结构，严格按照已知可工作的脚本框架进行重构。
 * - [detail] 函数返回值被重构为最标准的 vod 对象格式，包含 vod_play_from 和 vod_play_url。
 * - [detail] 函数将所有链接拼接为 '名称$链接#访问码$$$' 的长字符串格式，这是兼容性最广的方案。
 * - 恢复了全局 appConfig 变量，以应对可能存在的非标准依赖。
 * - 所有函数 (home, category, detail, search) 的输入输出都严格遵循通用规范。
 * - 这是基于所有失败经验总结出的、兼容性最强的最终尝试。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// 恢复全局配置，以防万一
const appConfig = {
  site: 'https://www.leijing.xyz',
  categories: [
      { type_id: '?tagId=42204684250355', type_name: '剧集' },
      { type_id: '?tagId=42204681950354', type_name: '电影' },
      { type_id: '?tagId=42204792950357', type_name: '动漫' },
      { type_id: '?tagId=42204697150356', type_name: '纪录片' },
      { type_id: '?tagId=42210356650363', type_name: '综艺' },
      { type_id: '?tagId=42212287587456', type_name: '影视原盘' },
  ]
};

// App 主页
async function home( ) {
    return jsonify({
        class: appConfig.categories,
        filters: {}
    });
}

// 分类页
async function category(tid, pg) {
    const page = pg || 1;
    const url = `${appConfig.site}/${tid}&page=${page}`;
    const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
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
            vod_pic: '',
            vod_remarks: '',
        });
    });
    return jsonify({
        list: cards,
        page: page,
        pagecount: page + (cards.length < 20 ? 0 : 1),
        limit: cards.length,
        total: 0
    });
}

// 详情页 - 【核心修改处】
async function detail(ids) {
    const url = `${appConfig.site}/${ids}`;
    const tracks = [];
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const vod_name = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();
        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|访问|提取|解压)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // 提取链接和访问码的逻辑保持不变
        const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code= )[^\s<)]*?(?:[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09])/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            const panUrl = match[0].split(/[\(（\uff08]/)[0].trim();
            const accessCode = match[1];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            tracks.push(`${vod_name}$${panUrl}#${accessCode}`);
            uniqueLinks.add(normalizedUrl);
        }

        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            const normalizedUrl = normalizePanUrl(href);
            if (uniqueLinks.has(normalizedUrl)) return;
            const linkName = $(el).text().trim() || vod_name;
            const contextText = $(el).parent().text();
            const localCode = extractAccessCode(contextText);
            const accessCode = localCode || globalAccessCode;
            tracks.push(`${linkName}$${href}#${accessCode}`);
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
            tracks.push(`${vod_name}$${panUrl}#${accessCode}`);
            uniqueLinks.add(normalizedUrl);
        }

        // 【严格按照标准 vod 对象格式返回】
        const vod = {
            vod_id: ids,
            vod_name: vod_name,
            vod_play_from: "天翼云盘",
            vod_play_url: tracks.join('$$$'), // 使用 '$$$' 作为分隔符
            // 可以补充其他信息
            vod_content: $('.topic-content').first().text().trim()
        };

        return jsonify({
            list: [vod]
        });

    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({ list: [] });
    }
}

// 搜索功能
async function search(wd, quick, pg) {
    const page = pg || 1;
    const url = `${appConfig.site}/search?keyword=${encodeURIComponent(wd)}&page=${page}`;
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

async function play(flag, id, flags) {
    return jsonify({
        parse: 0,
        url: id
    });
}
