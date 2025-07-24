/**
 * =================================================================
 * 最终可用脚本 - 搜索和详情页链接识别功能优化
 * 版本: 22
 *
 * 更新日志:
 * - 优化了 parseAndAddTrack 函数，使其能够更鲁棒地处理将访问码用中文括号直接附加在URL后的天翼云盘链接。
 * - 增加了一个新的正则表达式 linkAndCodePattern 来精确分离URL和括号内的访问码。
 * - 保持了对其他格式链接和访问码的兼容性。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 22, // 版本号更新
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

async function getConfig(  ) {
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

async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        
        // 优先从<a>标签的href和文本中提取
        let combinedText = "";
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const $el = $(el);
            const hrefAttr = $el.attr('href') || '';
            const linkText = $el.text() || '';
            combinedText += hrefAttr + ' ' + linkText + '\n';
        });

        if (combinedText) {
            parseAndAddTrack(combinedText, title, tracks, uniqueLinks);
        }

        // 如果在<a>标签中没找到，则从整个内容区域提取
        if (tracks.length === 0) {
            const content = $('.topicContent').text();
            parseAndAddTrack(content, title, tracks, uniqueLinks);
        }

        // 如果还是没有，作为最后手段，从整个body提取
        if (tracks.length === 0) {
            const bodyText = $('body').text();
            parseAndAddTrack(bodyText, title, tracks, uniqueLinks);
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

function parseAndAddTrack(textToParse, title, tracks, uniqueLinks) {
    if (!textToParse) return;

    // 匹配天翼云盘链接，包括那些后面直接跟着中文括号访问码的
    const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+(?:（访问码：[a-zA-Z0-9]{4,6} ）)?)/g;
    // 用于从 "https://...（访问码：... ）" 格式中分离URL和访问码
    const linkAndCodePattern = /(https?:\/\/cloud\.189\.cn\/web\/share\?code=[a-zA-Z0-9]+ )（访问码：([a-zA-Z0-9]{4,6})）/;

    let match;
    while ((match = urlPattern.exec(textToParse)) !== null) {
        const rawUrl = match[0];
        let panUrl = rawUrl;
        let accessCode = '';

        const parts = rawUrl.match(linkAndCodePattern);

        if (parts && parts.length === 3) {
            // 匹配成功，parts[1] 是纯净的URL, parts[2] 是访问码
            panUrl = parts[1];
            accessCode = parts[2];
        } else {
            // 如果不匹配特定格式，尝试从原始文本中提取访问码作为备用方案
            accessCode = extractAccessCode(textToParse);
        }

        if (!panUrl) continue;

        const normalizedUrl = normalizePanUrl(panUrl);
        if (uniqueLinks.has(normalizedUrl)) continue;

        tracks.push({
            name: title,
            pan: panUrl,
            ext: { accessCode: accessCode || '' }
        });
        uniqueLinks.add(normalizedUrl);
    }
}


function extractAccessCode(text) {
    if (!text) return '';
    // 优先匹配括号外的访问码
    const codeMatch = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (codeMatch && codeMatch[1]) return codeMatch[1];
    // 其次匹配括号内的访问码
    const bracketMatch = text.match(/[\uFF3B\u3010\uFF08\(]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\uFF3D\u3011\uFF09\)]/i);
    if (bracketMatch && bracketMatch[1]) return bracketMatch[1];
    return '';
}

function normalizePanUrl(url) {
    try {
        const urlObj = new URL(url);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s< )]+/);
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
      vod_pic: $item.find('img').attr('src') || '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
