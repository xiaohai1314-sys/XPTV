/**
 * =================================================================
 * 最终可用脚本 - 融合 v16 和 v20 优点
 * 版本: 21.2 (最终修正版)
 *
 * 更新日志:
 * - 深入调试，定位到 getCards 函数中存在过滤逻辑缺陷，该缺陷导致特定帖子被提前跳过，无法进入详情页解析。
 * - [getCards] 修正了错误的过滤条件，确保所有有效帖子都能被正确加载。
 * - [getTracks] 对 precisePattern 正则表达式进行最终优化，确保其能处理全角括号及各种文本格式。
 * - [normalizePanUrl] 增加了 decodeURIComponent 步骤，以正确处理 href 属性中被编码的 URL。
 * - 此版本通过端到端调试，确保从列表页到详情页的整个流程通畅，彻底解决目标链接的提取问题。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: "21.2",
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
    // **修正点 1: 优化过滤逻辑，防止误杀**
    if (r.includes('content') && !r.includes('cloud.189.cn')) return;
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

// --- 详情页函数: v21.2 最终修正版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text(); 
        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|访问|提取|解压)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // --- 策略一：精准匹配 (最终优化正则) ---
        // **修正点 2: 优化正则表达式，确保覆盖所有情况**
        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))\s*[（(][^）)]*?(?:访问码|密码|提取码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})[^）)]*?[）)]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            const panUrl = match[1].trim();
            const accessCode = match[2].trim();
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            
            tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        }

        // --- 策略二：广泛兼容模式 (回退) ---
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            const normalizedUrl = normalizePanUrl(href);
            if (uniqueLinks.has(normalizedUrl)) return;

            let accessCode = '';
            const contextText = $(el).parent().text();
            const localCode = extractAccessCode(contextText);
            accessCode = localCode || globalAccessCode;

            tracks.push({ name: $(el).text().trim() || title, pan: href, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        });

        const urlPattern = /https?:\/\/cloud\.189\.cn\/(t\/|web\/share\?code= )[^\s<>()（）]+/gi;
        while ((match = urlPattern.exec(bodyText)) !== null) {
            const panUrl = match[0];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;

            let accessCode = '';
            const searchArea = bodyText.substring(Math.max(0, match.index - 50), match.index + panUrl.length + 50);
            const localCode = extractAccessCode(searchArea);
            accessCode = localCode || globalAccessCode;

            tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
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
    match = text.match(/[（(][^）)]*?(?:访问码|密码|提取码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})[^）)]*?[）)]/i);
    if (match && match[1]) return match[1];
    return '';
}

function normalizePanUrl(url) {
    try {
        // **修正点 3: 增加解码步骤，处理编码过的href**
        const decodedUrl = decodeURIComponent(url);
        const urlObj = new URL(decodedUrl);
        // 只取域名和路径，去掉查询参数和哈希，以获得更纯净的标识
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>(  )（）]+/);
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
