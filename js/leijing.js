/**
 * =================================================================
 * 最终可用脚本 - 解决复杂链接格式问题
 * 版本: 22 (增强兼容版)
 *
 * 更新日志:
 * - [核心修复] 解决了对 a 标签 href 属性中直接包含访问码文本的链接无法识别的问题。
 * - [正则增强] 升级正则表达式，以兼容全角/半角括号和冒号，以及它们之间的各种空格。
 * - [逻辑优化] 调整匹配逻辑，直接在核心内容区域的完整 HTML 中进行搜索，极大提高了识别率。
 * - [数据清洗] 增加了更强的链接清理逻辑，确保从“污染”源中提取出纯净的 URL。
 * - [保持稳定] 继承了 v21 的双重策略（精准优先+广泛回退），并对两种策略都进行了强化，兼顾了准确性和覆盖面。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 22,
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

// --- 详情页函数: v22 增强兼容版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        
        // 关键改动：直接获取核心内容区的 HTML，以便同时搜索 href 和文本
        const contentHtml = $('.topicContent').html() || $('body').html();
        const bodyText = $('body').text(); // 纯文本备用，用于上下文搜索

        // --- 策略一：增强的精准匹配 (优先) ---
        // 这个正则表达式现在可以处理 URL 在 href 或文本中，并兼容多种括号和冒号
        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))[^\s<]*?\s*[\(（\uff08\s]*?(?:访问码|密码|提取码|code)\s*[:：\uff1a\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09]/gi;
        
        let match;
        while ((match = precisePattern.exec(contentHtml)) !== null) {
            // 清理和规范化 URL，从URL中剔除可能混入的文本
            let panUrl = match[1].replace(/（访问码：.*/, '').trim(); 
            const accessCode = match[2];
            
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            
            tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        }

        // --- 策略二：广泛兼容模式 (回退和补充) ---
        // 寻找页面上所有可能的链接，然后在其附近寻找访问码
        const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t|web\/share )\/[^\s<>()"'`]+/gi;
        
        while ((match = urlPattern.exec(contentHtml)) !== null) {
            let panUrl = match[0];
            // 再次清理，防止链接尾部包含HTML标签等杂质
            panUrl = panUrl.replace(/["'<].*/, '');

            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;

            // 在链接附近（前后50个字符）的纯文本中寻找访问码
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

/**
 * 辅助函数：从一段文本中提取访问码
 * @param {string} text 待搜索的文本
 * @returns {string} 找到的访问码或空字符串
 */
function extractAccessCode(text) {
    if (!text) return '';
    // 匹配 (访问码:xxxx) 【访问码:xxxx】 访问码:xxxx 等多种格式
    let match = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (match && match[1]) return match[1];
    // 再次尝试匹配被括号包围的格式
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
    if (match && match[1]) return match[1];
    return '';
}

/**
 * 辅助函数：规范化URL，用于去重
 * @param {string} url 原始URL
 * @returns {string} 规范化后的URL
 */
function normalizePanUrl(url) {
    try {
        const urlObj = new URL(url);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        // 如果URL构造失败（比如被污染了），则用正则尽力提取核心部分
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
