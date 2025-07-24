/**
 * =================================================================
 * 脚本最终完美版 - 综合所有分析的稳定版本
 * 版本: 16
 *
 * 核心:
 * 1. getTracks 函数使用已知可用的增强逻辑。
 * 2. search 函数使用一个高容错的组合选择器，以应对网站结构。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 16,
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

// --- getConfig, getCards, getPlayinfo 函数保持不变 ---
async function getConfig( ) { return jsonify(appConfig); }
async function getCards(ext) { ext = argsify(ext); let cards = []; let { page = 1, id } = ext; const url = appConfig.site + `/${id}&page=${page}`; const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } }); const $ = cheerio.load(data); $('.topicItem').each((index, each) => { if ($(each).find('.cms-lock-solid').length > 0) return; const href = $(each).find('h2 a').attr('href'); const title = $(each).find('h2 a').text(); const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/; const match = title.match(regex); const dramaName = match ? match[1] : title; const r = $(each).find('.summary').text(); const tag = $(each).find('.tag').text(); if (/content/.test(r) && !/cloud/.test(r)) return; if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; cards.push({ vod_id: href, vod_name: dramaName, vod_pic: '', vod_remarks: '', ext: { url: `${appConfig.site}/${href}` }, }); }); return jsonify({ list: cards }); }
async function getPlayinfo(ext) { return jsonify({ 'urls': [] }); }

// --- 详情页函数使用已知可用的增强版 ---
async function getTracks(ext) { ext = argsify(ext); const tracks = []; const url = ext.url; const uniqueLinks = new Set(); try { const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } }); const $ = cheerio.load(data); const title = $('.topicBox .title').text().trim() || "网盘资源"; let globalAccessCode = ''; const bodyText = $('body').text(); const globalCodeMatch = bodyText.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i); if (globalCodeMatch) { globalAccessCode = globalCodeMatch[1]; } $('a[href*="cloud.189.cn"]').each((i, el) => { const href = $(el).attr('href'); if (href && isValidPanUrl(href)) { const normalizedUrl = normalizePanUrl(href); if (uniqueLinks.has(normalizedUrl)) return; uniqueLinks.add(normalizedUrl); let accessCode = globalAccessCode; const contextText = $(el).parent().text(); const localCode = extractAccessCode(contextText); if (localCode) accessCode = localCode; const linkText = $(el).text().trim(); tracks.push({ name: linkText || title, pan: href, ext: { accessCode } }); } }); if (tracks.length === 0) { scanForLinks(bodyText, tracks, globalAccessCode, uniqueLinks, title); } return jsonify({ list: [{ title: "资源列表", tracks }] }); } catch (e) { return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] }); } }
function scanForLinks(text, tracks, globalAccessCode, uniqueLinks, title) { if (!text) return; const panMatches = []; const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[^\s<)]+/gi; let match; while ((match = urlPattern.exec(text)) !== null) { panMatches.push(match[0]) } const shortPattern = /cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi; while ((match = shortPattern.exec(text)) !== null) { panMatches.push('https://' + match[0] ) } const uniquePanMatches = [...new Set(panMatches)]; uniquePanMatches.forEach(panUrl => { if (!isValidPanUrl(panUrl)) return; const normalizedUrl = normalizePanUrl(panUrl); if (uniqueLinks.has(normalizedUrl)) { return } uniqueLinks.add(normalizedUrl); let accessCode = globalAccessCode; const index = text.indexOf(panUrl); if (index !== -1) { const searchStart = Math.max(0, index - 100); const searchEnd = Math.min(text.length, index + panUrl.length + 100); const contextText = text.substring(searchStart, searchEnd); const localCode = extractAccessCode(contextText); if (localCode) { accessCode = localCode } const directMatch = contextText.match(new RegExp(`${escapeRegExp(panUrl)}[\\s\\S]{0,30}?(?:访问码|密码|访问密码|提取码|code)[:：]?\\s*([a-z0-9]{4,6})`, 'i')); if (directMatch && directMatch[1]) { accessCode = directMatch[1] } } tracks.push({ name: title, pan: panUrl, ext: { accessCode } }) }) }
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function extractAccessCode(text) { if (!text) return ''; let match = text.match(/[\[【]访问码[:：]\s*([a-z0-9]{4,6})[\]】]/i); if (match) return match[1]; match = text.match(/[\(（]密码[:：]\s*([a-z0-9]{4,6})[\)）]/i); if (match) return match[1]; match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i); if (match) return match[1]; const standalone = text.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/i); if (standalone) { const code = standalone[1]; if (!/^\d+$/.test(code) && !/^[a-z]+$/i.test(code) && !/^\d{4}$/.test(code)) { return code } } return '' }
function isValidPanUrl(url) { if (!url) return false; return /https?:\/\/cloud\.189\.cn\/(t|web\/share )\//i.test(url) }
function normalizePanUrl(url) { const cleanUrl = url.replace(/\?.*$/, ''); return cleanUrl.toLowerCase() }


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
    
    // 同样使用组合选择器来查找标题和链接，增加容错
    const a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a');
    const href = a.attr('href');
    const title = a.text();
    
    if (!href || !title) return; // 跳过无效项

    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    
    // 使用组合选择器查找标签
    const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim();
    
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;

    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: $item.find('img').attr('src') || '', // 尝试获取图片
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });

  return jsonify({ list: cards });
}
