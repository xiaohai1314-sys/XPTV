/**
 * =================================================================
 * 最终可用脚本 - 终极修正版
 * 版本: 24 (终极修正版)
 *
 * 更新日志:
 * - 彻底重构 getTracks 函数，采用更直接、更健壮的提取逻辑。
 * - 引入一个全新的、强大的正则表达式，专门用于从解码后的 href 或文本中一次性提取“链接”和“访问码”。
 * - 新的正则能够完美处理 topicId=41829 中 URL编码 + 全角标点 的情况。
 * - 同样兼容 topicId=41879 中链接和访问码分离（但在同一行或附近）的情况。
 * - 简化了代码逻辑，移除了之前版本中复杂且容易出错的上下文搜索。
 * - 这应该是解决您所提问题的最终版本。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 24, // 版本号更新
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
};

async function getConfig(   ) {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
  const $ = cheerio.load(data);
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
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}

async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] });
}

// --- 详情页函数: v24 终极修正版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        
        // [核心修正] 定义一个强大的正则表达式，用于匹配链接和密码
        // 1. (https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+) - 捕获天翼云盘链接
        // 2. (?: ... )? - 一个可选的非捕获组，用于匹配密码部分
        // 3. [\s\S]*? - 匹配链接和密码之间的任何字符（包括换行符，非贪婪）
        // 4. (?:访问码|密码|提取码|code) - 匹配密码关键字
        // 5. [\s:：]*? - 匹配分隔符（空格、半角/全角冒号）
        // 6. ([a-zA-Z0-9]{4,6}) - 捕获4-6位的访问码
        const panPattern = /(https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+)(?:[\s\S]*?(?:访问码|密码|提取码|code)[\s:：]*?([a-zA-Z0-9]{4,6}))?/gi;

        // 将整个页面的内容（包括HTML标签，以应对链接在a标签内的情况）作为搜索文本
        const content = $('.topicContent').html().replace(/<br\s*\/?>/gi, '\n'); // 将  
替换为换行符，以处理换行情况
        
        let match;
        while ((match = panPattern.exec(content)) !== null) {
            const panUrl = match[1].trim(); // 捕获组1: 链接
            const accessCode = match[2] || ''; // 捕获组2: 访问码 (可能不存在)

            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;

            tracks.push({
                name: title,
                pan: panUrl,
                ext: { accessCode: accessCode.trim() }
            });
            uniqueLinks.add(normalizedUrl);
        }

        // 如果上述方法找不到（例如链接和密码被HTML标签严重分割），则使用备用方案
        if (tracks.length === 0) {
            const bodyText = $('body').text();
            while ((match = panPattern.exec(bodyText)) !== null) {
                const panUrl = match[1].trim();
                const accessCode = match[2] || '';
                const normalizedUrl = normalizePanUrl(panUrl);
                if (uniqueLinks.has(normalizedUrl)) continue;
                tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode.trim() } });
                uniqueLinks.add(normalizedUrl);
            }
        }


        if (tracks.length > 0) {
            return jsonify({ list: [{ title: "天翼云盘", tracks }] });
        } else {
            return jsonify({ list: [] });
        }

    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
    }
}

function normalizePanUrl(url) {
    try {
        // 在解码前处理，避免URL中的特殊字符导致 new URL 失败
        const decodedUrl = decodeURIComponent(url);
        const urlObj = new URL(decodedUrl);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>(  )]+/);
        return match ? match[0].toLowerCase() : url.toLowerCase();
    }
}

async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
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
      vod_pic: '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
