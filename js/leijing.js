/**
 * =================================================================
 * 最终可用脚本 - 搜索和详情页链接识别功能优化
 * 版本: 17
 *
 * 更新日志:
 * - 重构并增强了 getTracks 函数，以应对复杂的链接和访问码格式。
 * - 优先从 <a> 标签中解析链接，失败后回退到全文扫描。
 * - 能够正确处理 href 属性或标签文本中混有访问码的情况。
 * - 强化了访问码提取的正则表达式，兼容全角/半角符号及多种关键词。
 * - 引入了更可靠的链接去重机制。
 * - 保留了原版高效稳定的搜索函数。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 17,
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

// --- 详情页函数：重构优化版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set(); // 用于存储已添加的、标准化的网盘链接，防止重复

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();

        // 1. 优先处理 <a> 标签，因为它们是明确的链接
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const $el = $(el);
            // 提取 href 属性和标签文本，因为信息可能存在于任何一个地方
            const hrefAttr = $el.attr('href') || '';
            const linkText = $el.text() || '';
            
            // 将 href 和 text 拼接，确保信息完整，然后交给解析函数处理
            parseAndAddTrack(hrefAttr + ' ' + linkText, title, tracks, uniqueLinks);
        });

        // 2. 如果通过 <a> 标签没有找到任何链接，则对主要内容区进行正则匹配
        if (tracks.length === 0) {
            const content = $('.topicContent').text(); // 缩小范围到主要内容区，更精确
            parseAndAddTrack(content, title, tracks, uniqueLinks);
        }

        // 3. 如果主要内容区还是没有，则最后扫描整个 body 文本作为补充
        if (tracks.length === 0) {
            parseAndAddTrack(bodyText, title, tracks, uniqueLinks);
        }

        return jsonify({ list: [{ title: "资源列表", tracks }] });
    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
    }
}

/**
 * @description: 从给定的文本中解析出所有天翼网盘链接和对应的访问码，并添加到结果数组中
 * @param {string} textToParse - 需要解析的文本字符串
 * @param {string} title - 默认的轨道标题
 * @param {Array} tracks - 存储结果的轨道数组
 * @param {Set} uniqueLinks - 用于去重的 Set 对象
 */
function parseAndAddTrack(textToParse, title, tracks, uniqueLinks) {
    if (!textToParse) return;

    // 正则：匹配天翼云盘URL (包括 t/ 和 web/share/ 两种形式)
    const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[a-zA-Z0-9]+/g;
    const matches = textToParse.match(urlPattern);

    if (!matches) return;

    // 对匹配到的每个URL进行处理
    [...new Set(matches)].forEach(panUrl => {
        const normalizedUrl = normalizePanUrl(panUrl);
        if (uniqueLinks.has(normalizedUrl)) {
            return; // 如果已经添加过，则跳过
        }

        // 在原始文本中，以当前URL为中心，向前后搜索一小段范围（例如100个字符）作为上下文
        const urlIndex = textToParse.indexOf(panUrl);
        const contextStart = Math.max(0, urlIndex - 100);
        const contextEnd = Math.min(textToParse.length, urlIndex + panUrl.length + 100);
        const contextText = textToParse.substring(contextStart, contextEnd);

        // 从上下文中提取访问码
        const accessCode = extractAccessCode(contextText);

        tracks.push({
            name: title,
            pan: panUrl,
            ext: { accessCode: accessCode || '' } // 确保 accessCode 存在
        });
        uniqueLinks.add(normalizedUrl); // 添加到去重集合
    });
}

/**
 * @description: 从文本中提取访问码，增强了对全角括号和多种关键词的识别
 * @param {string} text - 包含访问码的文本片段
 * @returns {string} 提取到的访问码，如果找不到则返回空字符串
 */
function extractAccessCode(text) {
    if (!text) return '';
    // 正则：匹配 "访问码"、"密码"、"提取码" 等关键词后面的4-6位字母数字组合
    // 支持全角/半角括号、冒号
    const codeMatch = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (codeMatch && codeMatch[1]) {
        return codeMatch[1];
    }
    // 兼容 （访问码：xxxx）或 [访问码:xxxx] 这种格式
    const bracketMatch = text.match(/[\[【（(]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\]】)）]/i);
    if (bracketMatch && bracketMatch[1]) {
        return bracketMatch[1];
    }
    return '';
}

/**
 * @description: 标准化URL，用于去重（转小写并移除查询参数）
 * @param {string} url
 * @returns {string}
 */
function normalizePanUrl(url) {
    try {
        // 尝试将输入视为一个完整的URL
        const urlObj = new URL(url);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        // 如果构造失败（例如，链接和密码混在一起），则用正则提取URL部分
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s< )]+/);
        return match ? match[0].toLowerCase() : url.toLowerCase();
    }
}


/**
 * 【搜索功能最终版】
 * 使用组合选择器，确保高兼容性和稳定性。
 */
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;

  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);

  // 【最终选择器】使用逗号分隔，同时查找所有可能的列表项，大大提高脚本的健壮性。
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
