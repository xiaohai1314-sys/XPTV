/**
 * =================================================================
 * 最终可用脚本 - 融合 v16 和 v20 优点
 * 版本: 21 (融合版)
 *
 * 更新日志:
 * - 融合了 v16 的广泛链接识别能力和 v20 的精准访问码提取能力。
 * - [getTracks] 函数采用双重策略：
 *   1. **精准优先**: 首先尝试用 v20 的精确正则匹配 "链接+访问码" 的组合。
 *   2. **兼容回退**: 如果精准匹配找不到结果，则启动 v16 的广泛链接扫描模式，先找链接，再在附近找访问码。
 * - 解决了 v20 因正则过严而漏掉纯净链接或格式不规范链接的问题。
 * - 解决了 v16 可能将访问码错误匹配的问题，因为精准模式已优先处理。
 * - 这是目前最稳定、兼容性最强的版本。
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

async function getConfig() {
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

// --- 详情页函数: v21 融合版 (增强版) ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text(); // 获取整个页面文本，备用
        let globalAccessCode = '';
        
        // 增强全局访问码提取（支持更多格式）
        const globalCodeMatch = bodyText.match(/(?:通用|访问|提取|解压|密码)[码]?[：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // --- 策略一：增强精准匹配 (优先) ---
        // 新增对URL编码字符的支持（%EF%BC%89等）
        const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code=)([a-zA-Z0-9]+)[^\s]*(?:[\(\（]?(?:访问码|密码|提取码|code)[:：]?\s*([a-zA-Z0-9]{4,6})[\)\）]?)?/gi;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            // 处理URL编码的括号（%EF%BC%89等）
            let panUrl = match[0].replace(/%EF%BC%8C|%EF%BC%9A|%EF%BC%89|%EF%BC%88/g, '');
            const accessCode = match[2] || globalAccessCode;
            
            // 清理链接中的多余字符
            panUrl = panUrl.split(/[\(\（\s]/)[0].trim();
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            
            tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        }

        // --- 策略二：优化回退模式 (兼容性处理) ---
        // 1. 从 <a> 标签中寻找（增强对编码字符的处理）
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            
            // 检测是否包含云盘域名
            if (href.includes('cloud.189.cn') || text.includes('cloud.189.cn')) {
                let panUrl = href.includes('cloud.189.cn') ? href : text;
                
                // 清理编码字符和多余部分
                panUrl = panUrl.replace(/%EF%BC%8C|%EF%BC%9A|%EF%BC%89|%EF%BC%88/g, '')
                               .split(/[\(\（\s]/)[0]
                               .trim();
                
                const normalizedUrl = normalizePanUrl(panUrl);
                if (uniqueLinks.has(normalizedUrl)) return;

                // 提取访问码（优先从文本内容）
                const contextText = $(el).parent().text();
                const localCode = extractAccessCode(contextText) || extractAccessCode(text);
                const accessCode = localCode || globalAccessCode;

                tracks.push({ name: text || title, pan: panUrl, ext: { accessCode } });
                uniqueLinks.add(normalizedUrl);
            }
        });

        // 2. 补充纯文本扫描（增强对编码字符的处理）
        const urlPattern = /https?:\/\/cloud\.189\.cn\/(t\/|web\/share\?code=)[^\s<>{}\[\]\"\']+/gi;
        while ((match = urlPattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace(/%EF%BC%8C|%EF%BC%9A|%EF%BC%89|%EF%BC%88/g, '')
                                 .split(/[\(\（\s]/)[0]
                                 .trim();
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;

            // 在链接前后50字符内搜索访问码
            const searchArea = bodyText.substring(
                Math.max(0, match.index - 50),
                match.index + panUrl.length + 50
            );
            const accessCode = extractAccessCode(searchArea) || globalAccessCode;
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

// 增强访问码提取函数
function extractAccessCode(text) {
    if (!text) return '';
    // 扩展匹配模式（支持无括号情况）
    const patterns = [
        /(?:访问码|密码|提取码|code)\s*[:：\s]*([a-z0-9]{4,6})/i,
        /[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-z0-9]{4,6})\s*[\)）\uff09\]】]/i,
        /[:：]\s*([a-z0-9]{4,6})\b/i  // 直接匹配冒号后的4-6位字符
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) return match[1];
    }
    
    // 尝试匹配纯数字/字母组合（在密码常见位置）
    const fallbackMatch = text.match(/(?:访问|提取|解压|密码)[码]?[:：]?\s*(\w{4,6})/i);
    if (fallbackMatch && fallbackMatch[1]) return fallbackMatch[1];
    
    return '';
}

function normalizePanUrl(url) {
    try {
        const urlObj = new URL(url);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>( )]+/);
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
