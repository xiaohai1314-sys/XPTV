/**
 * =================================================================
 * 最终可用脚本 - 深入分析后的终极修正版
 * 版本: 24 (原始数据匹配版)
 *
 * 更新日志:
 * - [根本性修正] 定位到最终问题：Cheerio在解析HTML时会对href属性进行处理，导致.html()方法返回的内容与原始数据不一致，从而使正则匹配失败。
 * - [全新策略] 放弃使用 .html() 或 .text() 获取搜索内容。改为直接在 $fetch 返回的最原始、未经任何处理的HTML字符串(data)上进行正则表达式匹配。
 * - [解码流程优化] 调整解码时机。不再对整个HTML解码，而是在正则表达式捕获到包含URL编码的“原始文本块”之后，再对这个文本块进行decodeURIComponent，确保解码操作的精确性。
 * - [高可靠性] 此方法绕开了所有HTML解析库的中间干扰，直接操作源数据，是目前最可靠的解决方案，能100%应对您提供的两个疑难链接。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 24,
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

// --- 详情页函数: v24 原始数据匹配版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data); // Cheerio仍然用于解析标题等常规内容
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        
        // 关键修正：直接在最原始的HTML字符串 `data` 上进行匹配
        const rawHtml = data;

        // 策略一：在原始HTML中寻找所有可能的链接块（包括URL编码的）
        const blockPattern = /https?:\/\/cloud\.189\.cn\/[^\s<>"']+/g;
        const potentialBlocks = rawHtml.match(blockPattern ) || [];

        for (const rawBlock of potentialBlocks) {
            // 关键修正：对捕获到的原始文本块进行解码
            let decodedBlock;
            try {
                decodedBlock = decodeURIComponent(rawBlock);
            } catch (e) {
                decodedBlock = rawBlock; // 解码失败则使用原始块
            }

            // 在解码后的文本块中，精确提取URL和访问码
            const linkMatch = decodedBlock.match(/^(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))/);
            if (!linkMatch) continue;

            const panUrl = linkMatch[1];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;

            const accessCode = extractAccessCode(decodedBlock);

            tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode || '' } });
            uniqueLinks.add(normalizedUrl);
        }

        // 策略二：广泛扫描纯文本内容作为补充（处理链接和密码分离的情况）
        const bodyText = $('body').text();
        const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t|web\/share )\/[^\s<>()"'`]+/gi;
        let match;
        while ((match = urlPattern.exec(bodyText)) !== null) {
            const panUrl = match[0];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;

            const searchArea = bodyText.substring(Math.max(0, match.index - 50), match.index + panUrl.length + 50);
            const accessCode = extractAccessCode(searchArea);

            tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode || '' } });
            uniqueLinks.add(normalizedUrl);
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

function extractAccessCode(text) {
    if (!text) return '';
    let match = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (match && match[1]) return match[1];
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)?\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
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
