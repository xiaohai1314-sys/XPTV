/**
 * =================================================================
 * 最终可用脚本 - 搜索和详情页链接识别功能优化
 * 版本: 21
 *
 * 更新日志:
 * - 进一步优化了 parseAndAddTrack 函数，使其能够更鲁棒地处理天翼云盘链接。
 * - 改进了从 `web/share?code=` 形式的URL中提取分享码和访问码的逻辑，确保即使访问码被URL编码在code参数中也能正确解析。
 * - 简化了URL匹配正则表达式，并利用URLSearchParams进行参数解析，提高了代码的清晰度和健壮性。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 21,
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
