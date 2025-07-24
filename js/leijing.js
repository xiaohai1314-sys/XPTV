/**
 * =================================================================
 * 探测脚本 V1 - 自动尝试多种可能的CSS选择器
 * 版本: 14
 *
 * 核心逻辑:
 * - search函数会依次尝试多个常见的列表选择器。
 * - 只要有一个选择器能找到结果，就会停止并返回数据。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 14,
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

// --- 其他函数保持不变 ---
async function getConfig( ) { return jsonify(appConfig); }
async function getCards(ext) { /* ... 此处代码与上一版相同 ... */ ext = argsify(ext); let cards = []; let { page = 1, id } = ext; const url = appConfig.site + `/${id}&page=${page}`; const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } }); const $ = cheerio.load(data); $('.topicItem').each((index, each) => { if ($(each).find('.cms-lock-solid').length > 0) return; const href = $(each).find('h2 a').attr('href'); const title = $(each).find('h2 a').text(); const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/; const match = title.match(regex); const dramaName = match ? match[1] : title; const r = $(each).find('.summary').text(); const tag = $(each).find('.tag').text(); if (/content/.test(r) && !/cloud/.test(r)) return; if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; cards.push({ vod_id: href, vod_name: dramaName, vod_pic: '', vod_remarks: '', ext: { url: `${appConfig.site}/${href}` }, }); }); return jsonify({ list: cards }); }
async function getTracks(ext) { /* ... 此处代码与上一版相同，已知是可用的 ... */ ext = argsify(ext); const tracks = []; const url = ext.url; const uniqueLinks = new Set(); try { const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } }); const $ = cheerio.load(data); const title = $('.topicBox .title').text().trim() || "网盘资源"; let globalAccessCode = ''; const bodyText = $('body').text(); const globalCodeMatch = bodyText.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i); if (globalCodeMatch) { globalAccessCode = globalCodeMatch[1]; } $('a[href*="cloud.189.cn"]').each((i, el) => { const href = $(el).attr('href'); if (href && isValidPanUrl(href)) { const normalizedUrl = normalizePanUrl(href); if (uniqueLinks.has(normalizedUrl)) return; uniqueLinks.add(normalizedUrl); let accessCode = globalAccessCode; const contextText = $(el).parent().text(); const localCode = extractAccessCode(contextText); if (localCode) accessCode = localCode; const linkText = $(el).text().trim(); tracks.push({ name: linkText || title, pan: href, ext: { accessCode } }); } }); if (tracks.length === 0) { scanForLinks(bodyText, tracks, globalAccessCode, uniqueLinks, title); } return jsonify({ list: [{ title: "资源列表", tracks }] }); } catch (e) { return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] }); } }
function scanForLinks(text, tracks, globalAccessCode, uniqueLinks, title) { if (!text) return; const panMatches = []; const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[^\s<)]+/gi; let match; while ((match = urlPattern.exec(text)) !== null) { panMatches.push(match[0]) } const shortPattern = /cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi; while ((match = shortPattern.exec(text)) !== null) { panMatches.push('https://' + match[0] ) } const uniquePanMatches = [...new Set(panMatches)]; uniquePanMatches.forEach(panUrl => { if (!isValidPanUrl(panUrl)) return; const normalizedUrl = normalizePanUrl(panUrl); if (uniqueLinks.has(normalizedUrl)) { return } uniqueLinks.add(normalizedUrl); let accessCode = globalAccessCode; const index = text.indexOf(panUrl); if (index !== -1) { const searchStart = Math.max(0, index - 100); const searchEnd = Math.min(text.length, index + panUrl.length + 100); const contextText = text.substring(searchStart, searchEnd); const localCode = extractAccessCode(contextText); if (localCode) { accessCode = localCode } const directMatch = contextText.match(new RegExp(`${escapeRegExp(panUrl)}[\\s\\S]{0,30}?(?:访问码|密码|访问密码|提取码|code)[:：]?\\s*([a-z0-9]{4,6})`, 'i')); if (directMatch && directMatch[1]) { accessCode = directMatch[1] } } tracks.push({ name: title, pan: panUrl, ext: { accessCode } }) }) }
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function extractAccessCode(text) { if (!text) return ''; let match = text.match(/[\[【]访问码[:：]\s*([a-z0-9]{4,6})[\]】]/i); if (match) return match[1]; match = text.match(/[\(（]密码[:：]\s*([a-z0-9]{4,6})[\)）]/i); if (match) return match[1]; match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i); if (match) return match[1]; const standalone = text.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/i); if (standalone) { const code = standalone[1]; if (!/^\d+$/.test(code) && !/^[a-z]+$/i.test(code) && !/^\d{4}$/.test(code)) { return code } } return '' }
function isValidPanUrl(url) { if (!url) return false; return /https?:\/\/cloud\.189\.cn\/(t|web\/share )\//i.test(url) }
function normalizePanUrl(url) { const cleanUrl = url.replace(/\?.*$/, ''); return cleanUrl.toLowerCase() }
async function getPlayinfo(ext) { return jsonify({ 'urls': [] }); }
// --- 其他函数保持不变 ---


/**
 * 【搜索探测函数】
 * 依次尝试多个选择器，直到找到数据为止。
 */
async function search(ext) {
  ext = argsify(ext);
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;

  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);

  let cards = [];

  // 定义一个解析函数，用于处理不同选择器找到的元素
  const parseItem = ($item) => {
    // 尝试多种方式获取标题和链接
    let a = $item.find('a.title, h2 a, h3 a, .item-title a');
    const href = a.attr('href');
    const title = a.text();
    
    if (!href || !title) return null;

    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const tag = $item.find('.tag, .category, .item-tag').text();
    
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return null;

    return {
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    };
  };

  // 定义要探测的选择器列表
  const selectorsToTry = [
    '.search-result ul > li',
    '.topic-list > .topic-item',
    '.result-list > .item',
    'ul.search-results > li.result-item',
    '.topicItem' // 原始脚本的选择器
  ];

  // 依次尝试每个选择器
  for (const selector of selectorsToTry) {
    const items = $(selector);
    if (items.length > 0) {
      console.log(`探测成功！命中的选择器是: ${selector}`);
      items.each((index, element) => {
        const card = parseItem($(element));
        if (card) {
          cards.push(card);
        }
      });
      // 只要找到结果，就立刻停止探测并返回
      return jsonify({ list: cards });
    }
  }

  // 如果所有选择器都失败了，返回空列表
  console.log("所有探测选择器均未命中，返回空列表。");
  return jsonify({ list: [] });
}
