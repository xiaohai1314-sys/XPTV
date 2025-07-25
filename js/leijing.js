/**
 * =================================================================
 * 最终可用脚本 - 结构分析修复版
 * 版本: 22 (结构感知版)
 *
 * 更新日志:
 * - 根据实际网站HTML结构重构了 getTracks 函数。
 * - 放弃了单一的正则匹配策略，改为采用更可靠的DOM遍历和上下文搜索方法。
 * - [getTracks] 策略调整:
 *   1. **遍历链接**: 首先通过 `$('a[href*="cloud.189.cn"]')` 精准找到所有天翼云盘的链接元素。
 *   2. **上下文搜索**: 对每个链接，获取其最近的块级父元素(如 <p> 或 <div>)的全部文本内容。
 *   3. **智能提取**: 在这个上下文中，使用增强版的 `extractAccessCode` 函数来查找对应的访问码。
 * - [extractAccessCode] 函数增强: 正则表达式现在可以匹配带括号、中括号和各种空格的访问码格式。
 * - 解决了因链接与访问码在不同HTML标签内而导致识别失败的根本问题。
 * - 这是目前针对该网站结构最稳定、最准确的版本。
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

// --- 详情页函数: v22 结构感知修复版 ---
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

        // 优先寻找一个全局/通用的访问码，作为备用
        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|全局|解压)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // 核心策略：遍历所有天翼云盘链接，然后在它们的上下文中寻找访问码
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const panUrl = $(el).attr('href');
            if (!panUrl) return;

            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) return; // 防止重复添加

            let accessCode = '';
            // 查找链接最近的块级父元素(p, div)，获取其全部文本内容作为搜索范围
            // 这是解决链接和访问码在不同标签内的关键
            const contextElement = $(el).closest('p, div');
            const contextText = contextElement.length ? contextElement.text() : $(el).parent().text();

            // 在上下文中提取访问码
            accessCode = extractAccessCode(contextText);

            // 如果在局部上下文中找不到，则尝试使用全局备用码
            if (!accessCode) {
                accessCode = globalAccessCode;
            }
            
            // 如果还是找不到，最后在链接本身的文本里找一次 (例如: 链接文本就是 "下载 (访问码:xxxx)")
            if (!accessCode) {
                accessCode = extractAccessCode($(el).text());
            }

            tracks.push({
                name: $(el).text().trim().substring(0, 50) || title, // 截取部分链接文本作为名字
                pan: panUrl,
                ext: { accessCode: accessCode || '' } // 确保有个空字符串
            });
            uniqueLinks.add(normalizedUrl);
        });

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
 * 增强版的访问码提取函数
 * @param {string} text 包含访问码的文本
 * @returns {string} 提取到的访问码或空字符串
 */
function extractAccessCode(text) {
    if (!text) return '';
    // 强大的正则表达式，能匹配 "访问码:xxxx", "(访问码:xxxx)", "【提取码 xxxx】" 等多种格式
    const match = text.match(/(?:访问码|密码|提取码|code)[\s:：]*([a-zA-Z0-9]{4,6})/i);
    if (match && match[1]) {
        return match[1];
    }
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
      vod_pic: $item.find('img').attr('src') || '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
