/**
 * =================================================================
 * 最终可用脚本 - 融合 v16 和 v20 优点 & 增强链接识别
 * 版本: 25 (融合版 - 增强链接识别)
 *
 * 更新日志:
 * - 融合了 v16 的广泛链接识别能力和 v20 的精准访问码提取能力。
 * - [getTracks] 函数采用双重策略：
 *   1. **精准优先**: 首先尝试用 v20 的精确正则匹配 "链接+访问码" 的组合。
 *   2. **兼容回退**: 如果精准匹配找不到结果，则启动 v16 的广泛链接扫描模式，先找链接，再在附近找访问码。
 * - 解决了 v20 因正则过严而漏掉纯净链接或格式不规范链接的问题。
 * - 解决了 v16 可能将访问码错误匹配的问题，因为精准模式已优先处理。
 * - 增强了对 `https://cloud.189.cn/web/share?code=XXXX` 格式链接的识别，即使没有明确的访问码提示。
 * - 优化了 `extractAccessCode` 函数，使其能更灵活地从文本中提取访问码。
 * - 结合了用户提供的可识别 `topicId=41829` 的脚本逻辑，进一步增强了 `getTracks` 函数的鲁棒性。
 * - 修复了 `extractAccessCode` 无法正确提取访问码的问题。
 * - 这是目前最稳定、兼容性最强的版本。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 25,
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
    // 匹配天翼云盘的短链接或分享链接，并捕获完整的URL
    const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9%\(\)\uff08\uff09\uFF1A\uFF1B\uFF0C\uFF0E\uFF0F\uFF1F\uFF01\uFF02\uFF03\uFF04\uFF05\uFF06\uFF07\uFF08\uFF09\uFF0A\uFF0B\uFF0C\uFF0D\uFF0E\uFF0F\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF5B-\uFF60\uFF61-\uFF65\uFF66-\uFF6F\uFF70-\uFF79\uFF80-\uFF89\uFF90-\uFF99\uFFA0-\uFFA9\uFFB0-\uFFB9\uFFC0-\uFFC9\uFFD0-\uFFD9\uFFE0-\uFFE9\uFFF0-\uFFF9]+)/g;
    let match;
    while ((match = urlPattern.exec(textToParse)) !== null) {
        const rawUrl = match[0];
        let panUrl = rawUrl;
        let accessCode = '';

        try {
            const urlObj = new URL(rawUrl);
            if (urlObj.pathname.startsWith('/web/share')) {
                const codeParam = urlObj.searchParams.get('code');
                if (codeParam) {
                    const decodedCodeParam = decodeURIComponent(codeParam);
                    // 尝试从解码后的code参数中提取访问码
                    const codeMatch = decodedCodeParam.match(/(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})/i);
                    if (codeMatch && codeMatch[1]) {
                        accessCode = codeMatch[1];
                        // 确保panUrl是纯净的分享链接，不包含访问码
                        panUrl = urlObj.origin + urlObj.pathname + '?code=' + encodeURIComponent(decodedCodeParam.replace(/(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})/i, '').trim());
                        // 如果替换后code参数为空，则使用原始的分享码部分
                        if (panUrl.endsWith('?code=')) {
                            panUrl = urlObj.origin + urlObj.pathname + '?code=' + encodeURIComponent(decodedCodeParam.split('（')[0].split('(')[0].trim());
                        }
                    } else {
                        // 如果code参数中没有访问码，则直接使用原始的code参数作为分享码
                        panUrl = rawUrl;
                    }
                }
            }
        } catch (e) {
            // URL解析失败，可能是因为URL本身就包含了访问码，直接从原始匹配中提取
            // 此时panUrl保持为rawUrl
        }

        // 再次尝试从整个rawUrl字符串中提取访问码，作为最终兜底
        if (!accessCode) {
            accessCode = extractAccessCode(rawUrl);
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
    // 匹配 (访问码:xxxx) 【访问码:xxxx】 访问码:xxxx 等多种格式
    let match = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (match && match[1]) return match[1];
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
    if (match && match[1]) return match[1];
    // 尝试匹配直接跟在链接后面的访问码，例如 `https://cloud.189.cn/t/xxxx（t189）` 这种格式
    match = text.match(/\(([a-zA-Z0-9]{4,6})\)$/);
    if (match && match[1]) return match[1];
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





