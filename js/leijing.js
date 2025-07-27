/**
 * =================================================================
 * 最终可用脚本 - 针对特殊编码和格式的深度优化版
 * 版本: 23 (深度兼容版)
 *
 * 更新日志:
 * - 修复了对 topicId=41829 这类 a 标签 href 中包含 URL 编码的全角标点链接的提取问题。
 * - 增强 extractAccessCode 函数，使其能同时匹配全角和半角标点符号。
 * - 优化了 a 标签的处理逻辑，在解码 href 后，会使用更强大的正则来提取链接和访问码。
 * - 确保纯文本链接的扫描逻辑作为补充，覆盖所有可能的情况。
 * - 此版本专门解决了您提出的两个链接无法识别的问题。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 23, // 版本号更新
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

// --- 详情页函数: v23 深度兼容版 ---
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
        const bodyHtml = $('body').html();

        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|全局|整页|解压)[密碼码][：:\s]*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // --- 策略一：从 <a> 标签中寻找 (已增强) ---
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            let href = $(el).attr('href');
            if (!href) return;

            // [核心修正] 解码 href 属性，以处理 URL 编码的链接
            try {
                href = decodeURIComponent(href);
            } catch (e) {
                // 解码失败则使用原始 href
            }

            const urlMatch = href.match(/https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+/);
            if (!urlMatch) return;
            const panUrl = urlMatch[0];

            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) return;

            let accessCode = '';
            // 优先从解码后的 href 和链接文本中提取密码
            const combinedText = href + ' ' + $(el).text();
            accessCode = extractAccessCode(combinedText);
            
            // 如果没找到，再从父级元素的文本中寻找
            if (!accessCode) {
                const contextText = $(el).parent().text();
                accessCode = extractAccessCode(contextText);
            }

            // 最后使用全局密码
            if (!accessCode) {
                accessCode = globalAccessCode;
            }

            tracks.push({ name: $(el).text().trim() || title, pan: panUrl, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        });

        // --- 策略二：从纯文本中寻找 (作为补充) ---
        // 使用更宽松的正则匹配页面上所有可能的链接
        const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t|web\/share\?code= )[\w-]+/gi;
        let match;
        while ((match = urlPattern.exec(bodyText)) !== null) {
            const panUrl = match[0];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue; // 避免重复添加

            let accessCode = '';
            // 在链接前后 50 个字符范围内寻找密码
            const searchArea = bodyText.substring(Math.max(0, match.index - 50), match.index + panUrl.length + 50);
            accessCode = extractAccessCode(searchArea) || globalAccessCode;

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

/**
 * [核心修正] 增强的访问码提取函数，兼容全角和半角标点
 * @param {string} text - 包含访问码的文本
 * @returns {string} - 提取到的访问码或空字符串
 */
function extractAccessCode(text) {
    if (!text) return '';
    // 正则表达式现在可以匹配全角和半角的冒号、括号以及空格
    // (?:访问码|密码|提取码|code)     - 匹配关键字
    // [\s:：]*?                     - 匹配任意数量的空格、半角冒号、全角冒号 (非贪婪)
    // \b([a-zA-Z0-9]{4,6})\b         - 捕获4到6位的字母和数字密码，\b确保是独立的单词
    let match = text.match(/(?:访问码|密码|提取码|code)[\s:：]*?\b([a-zA-Z0-9]{4,6})\b/i);
    if (match && match[1]) return match[1];

    // 匹配被括号（全角或半角）包裹的格式
    match = text.match(/[(（\[【\s][\s\S]*?(?:访问码|密码|提取码|code)[\s:：]*?\b([a-zA-Z0-9]{4,6})\b/i);
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
