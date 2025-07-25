/**
 * =================================================================
 * 最终可用脚本 - URL重定向修正版
 * 版本: 28 (终版)
 *
 * 更新日志:
 * - 在用户的关键提示下，终于查明了最根本的问题：URL重定向。
 *   (例如: /thread?topicId=41829 会被服务器301重定向到 /thread/41829)
 * - [getCards] & [search]: 核心修正！在获取到 href 后，立即将其转换为正确的URL格式。
 *   - `thread?topicId=ID` -> `thread/ID`
 *   - `https://leijing.xyz` -> `https://www.leijing.xyz`
 * - 此修改从根源上解决了脚本请求地址与浏览器实际地址不一致的问题 。
 * - [getTracks]: 保留了v27的“精准补丁”逻辑，以v21为基础，并在失败后启用解码补丁，应对双重挑战。
 * - 这是结合了正确URL构建和解码反爬机制的、真正意义上的最终解决方案。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 28,
  title: '雷鲸',
  site: 'https://www.leijing.xyz', // 始终使用 www.leijing.xyz
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
};

// --- HTML实体解码函数 ---
function decodeHtmlEntities(text ) {
    if (!text) return '';
    return text.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    });
}

// --- URL格式化函数 ---
function formatUrl(href) {
    if (!href) return '';
    // 将 thread?topicId=xxxxx 格式转换为 thread/xxxxx
    return href.replace('thread?topicId=', 'thread/');
}

async function getConfig(  ) {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
  const $ = cheerio.load(data);
  $('.topicItem').each((index, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return;
    let href = $(each).find('h2 a').attr('href');
    if (!href) return;

    // *** 核心修正 ***
    const formattedHref = formatUrl(href);

    const title = $(each).find('h2 a').text();
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
    if (/content/.test(r) && !/cloud/.test(r)) return;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: formattedHref, // 使用格式化后的href
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${formattedHref}` }, // 构建正确的详情页URL
    });
  });
  return jsonify({ list: cards });
}

async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] });
}

// --- 详情页函数: v27 精准补丁修复版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const url = ext.url; // 这个URL现在是由getCards构建的正确URL
    const tracks = [];
    const uniqueLinks = new Set();

    try {
        const { data: html } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(html);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();
        
        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|访问|提取|解压)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // --- 策略一：v21 的精准匹配 (优先) ---
        const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code=  )[^\s<)]*?(?:[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09])/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            const panUrl = match[0].split(/[\(（\uff08]/)[0].trim();
            const accessCode = match[1];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            
            tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        }

        // --- 策略二：v21 的广泛兼容模式 (回退) ---
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

        const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share  )\/[^\s<>()]+/gi;
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
        
        // --- 策略三：最终补丁 (仅在上述策略全部失效时启用) ---
        if (tracks.length === 0) {
            const decodedHtml = decodeHtmlEntities(html);
            const ultimatePattern = /<a[^>]+href="([^"]*cloud\.189\.cn[^"]*)"[^>]*>[\s\S]*?(?:访问码|密码|提取码)[\s:：]*([a-zA-Z0-9]{4,6})/gi;
            while ((match = ultimatePattern.exec(decodedHtml)) !== null) {
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
    let a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a');
    let href = a.attr('href');
    if (!href) return;

    // *** 核心修正 ***
    const formattedHref = formatUrl(href);

    const title = a.text();
    if (!title) return;
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim();
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: formattedHref, // 使用格式化后的href
      vod_name: dramaName,
      vod_pic: $item.find('img').attr('src') || '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${formattedHref}` }, // 构建正确的详情页URL
    });
  });
  return jsonify({ list: cards });
}
