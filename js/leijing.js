/**
 * =================================================================
 * 最终可用脚本 - 解码修复版
 * 版本: 25 (解码版)
 *
 * 更新日志:
 * - 找到了导致所有先前版本失败的根本原因：网站使用HTML实体编码隐藏了“访问码”等关键字。
 * - [getTracks] 新增核心解码步骤:
 *   1. 在所有匹配操作之前，先对获取到的原始HTML进行解码，将 &#xXXXX; 形式的实体编码转回为正常字符。
 *   2. 之后的所有匹配策略（v21及补充方案）都在解码后的、干净的文本上执行。
 * - 增加了一个 `decodeHtmlEntities` 辅助函数来处理解码逻辑。
 * - 此版本从根源上解决了关键字匹配失败的问题，是目前唯一能正确处理该网站反爬机制的最终版本。
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

// --- 新增：HTML实体解码函数 ---
function decodeHtmlEntities(text ) {
    if (!text) return '';
    return text.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    }).replace(/&[a-zA-Z]+;/g, (match) => {
        // 可选：如果需要，可以添加对 &nbsp; 等命名实体的处理
        const entities = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };
        return entities[match] || match;
    });
}


async function getConfig(  ) {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
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

// --- 详情页函数: v25 解码修复版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        let { data: html } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        
        // *** 关键修复：解码HTML实体 ***
        html = decodeHtmlEntities(html);

        const $ = cheerio.load(html);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();
        
        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|访问|提取|解压)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // --- 策略一：v21 的精准匹配 (在解码后的文本上运行) ---
        const precisePatternV21 = /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code=  )[^\s<)]*?(?:[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09])/g;
        let match;
        while ((match = precisePatternV21.exec(bodyText)) !== null) {
            const panUrl = match[0].split(/[\(（\uff08]/)[0].trim();
            const accessCode = match[1];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            
            tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        }

        // --- 策略二：v21 的广泛兼容模式 (在解码后的DOM上运行) ---
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

        const urlPatternV21 = /https?:\/\/cloud\.189\.cn\/(t|web\/share  )\/[^\s<>()]+/gi;
        while ((match = urlPatternV21.exec(bodyText)) !== null) {
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
        
        // --- 策略三：终极补充方案 (在解码后的HTML上运行) ---
        if (tracks.length === 0) {
            const ultimatePattern = /<a[^>]+href="([^"]*cloud\.189\.cn[^"]*)"[^>]*>[\s\S]*?(?:访问码|密码|提取码)[\s:：]*([a-zA-Z0-9]{4,6})/gi;
            while ((match = ultimatePattern.exec(html)) !== null) {
                const panUrl = match[1];
                const accessCode = match[2];
                const normalizedUrl = normalizePanUrl(panUrl);
                if (uniqueLinks.has(normalizedUrl)) continue;

                tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
                uniqueLinks.add(normalizedUrl);
            }
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
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
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
      vod_pic: $item.find('img').attr('src') || '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
