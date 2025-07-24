/**
 * =================================================================
 * 最终可用脚本 - 搜索和详情页链接识别功能优化
 * 版本: 20
 *
 * 更新日志:
 * - 彻底解决了网盘链接识别问题，特别是针对链接中包含访问码的情况。
 * - 脚本现在能够正确解析并提取出纯净的网盘URL和对应的访问码。
 * - 优化了从URL中提取分享码和访问码的逻辑，确保APP能正确识别。
 * - 调整了 getTracks 函数的最终返回数据结构，使其符合通用播放器APP的规范。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 20,
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

async function getConfig( ) {
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

        if (tracks.length === 0) {
            const content = $('.topicContent').text();
            parseAndAddTrack(content, title, tracks, uniqueLinks);
        }

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
    // 匹配天翼云盘的短链接或分享链接，并捕获分享码和访问码
    const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9%]+))(?:[^\s<)]*?)(?:\uff08访问码\uff1a([a-zA-Z0-9]{4,6})\uff09|\(访问码:([a-zA-Z0-9]{4,6})\))/g;
    let match;
    while ((match = urlPattern.exec(textToParse)) !== null) {
        let panUrl = '';
        let accessCode = '';

        // 优先从 web/share?code= 中提取
        if (match[2]) { // web/share?code= 形式
            panUrl = decodeURIComponent(match[0].split('?code=')[0] + '?code=' + match[2]);
            // 尝试从 URL 的 code 参数中提取访问码
            const urlCodeMatch = decodeURIComponent(match[2]).match(/(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})/i);
            if (urlCodeMatch && urlCodeMatch[1]) {
                accessCode = urlCodeMatch[1];
            }
        } else if (match[1]) { // t/ 形式
            panUrl = `https://cloud.189.cn/t/${match[1]}`;
        }

        // 从括号中提取访问码，优先级更高
        if (match[3]) { // 全角括号
            accessCode = match[3];
        } else if (match[4]) { // 半角括号
            accessCode = match[4];
        }

        if (!panUrl) continue; // 确保有有效的网盘URL

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
    const codeMatch = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (codeMatch && codeMatch[1]) return codeMatch[1];
    const bracketMatch = text.match(/[\uFF3B\u3010\uFF08\(]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\uFF3D\u3011\uFF09\)]/i);
    if (bracketMatch && bracketMatch[1]) return bracketMatch[1];
    return '';
}

function normalizePanUrl(url) {
    try {
        const urlObj = new URL(url);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<)]+/);
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



实时
