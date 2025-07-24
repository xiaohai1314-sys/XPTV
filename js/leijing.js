/**
 * =================================================================
 * 脚本最终完美版 - 增强访问码识别
 * 版本: 17
 *
 * 核心更新:
 * 1. 升级 extractAccessCode 函数，增加对 "(访问码: xxxx)" 新格式的支持。
 * 2. 其他逻辑保持最终稳定版(V16)不变。
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

// --- getConfig, getCards, getPlayinfo, search 等函数保持不变 ---
async function getConfig( ) { return jsonify(appConfig); }
async function getCards(ext) { ext = argsify(ext); let cards = []; let { page = 1, id } = ext; const url = appConfig.site + `/${id}&page=${page}`; const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } }); const $ = cheerio.load(data); $('.topicItem').each((index, each) => { if ($(each).find('.cms-lock-solid').length > 0) return; const href = $(each).find('h2 a').attr('href'); const title = $(each).find('h2 a').text(); const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/; const match = title.match(regex); const dramaName = match ? match[1] : title; const r = $(each).find('.summary').text(); const tag = $(each).find('.tag').text(); if (/content/.test(r) && !/cloud/.test(r)) return; if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; cards.push({ vod_id: href, vod_name: dramaName, vod_pic: '', vod_remarks: '', ext: { url: `${appConfig.site}/${href}` }, }); }); return jsonify({ list: cards }); }
async function getPlayinfo(ext) { return jsonify({ 'urls': [] }); }
async function search(ext) { ext = argsify(ext); let cards = []; let text = encodeURIComponent(ext.text); let page = ext.page || 1; let url = `${appConfig.site}/search?keyword=${text}&page=${page}`; const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } }); const $ = cheerio.load(data); const searchItems = $('.search-result ul > li, .topic-list > .topic-item, .result-list > .item, ul.search-results > li.result-item, .topicItem, .searchModule .item'); searchItems.each((index, each) => { const $item = $(each); const a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a'); const href = a.attr('href'); const title = a.text(); if (!href || !title) return; const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/; const match = title.match(regex); const dramaName = match ? match[1] : title; const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim(); if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; cards.push({ vod_id: href, vod_name: dramaName, vod_pic: $item.find('img').attr('src') || '', vod_remarks: tag, ext: { url: `${appConfig.site}/${href}` }, }); }); return jsonify({ list: cards }); }

// --- 详情页函数使用已知可用的增强版 ---
async function getTracks(ext) { ext = argsify(ext); const tracks = []; const url = ext.url; const uniqueLinks = new Set(); try { const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } }); const $ = cheerio.load(data); const title = $('.topicBox .title').text().trim() || "网盘资源"; let globalAccessCode = ''; const bodyText = $('body').text(); const globalCodeMatch = bodyText.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i); if (globalCodeMatch) { globalAccessCode = globalCodeMatch[1]; } $('a[href*="cloud.189.cn"]').each((i, el) => { const href = $(el).attr('href'); if (href && isValidPanUrl(href)) { const normalizedUrl = normalizePanUrl(href); if (uniqueLinks.has(normalizedUrl)) return; uniqueLinks.add(normalizedUrl); let accessCode = globalAccessCode; const contextText = $(el).parent().text(); const localCode = extractAccessCode(contextText); if (localCode) accessCode = localCode; const linkText = $(el).text().trim(); tracks.push({ name: linkText || title, pan: href, ext: { accessCode } }); } }); if (tracks.length === 0) { scanForLinks(bodyText, tracks, globalAccessCode, uniqueLinks, title); } return jsonify({ list: [{ title: "资源列表", tracks }] }); } catch (e) { return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] }); } }
function scanForLinks(text, tracks, globalAccessCode, uniqueLinks, title) { if (!text) return; const panMatches = []; const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[^\s<)]+/gi; let match; while ((match = urlPattern.exec(text)) !== null) { panMatches.push(match[0]) } const shortPattern = /cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi; while ((match = shortPattern.exec(text)) !== null) { panMatches.push('https://' + match[0] ) } const uniquePanMatches = [...new Set(panMatches)]; uniquePanMatches.forEach(panUrl => { if (!isValidPanUrl(panUrl)) return; const normalizedUrl = normalizePanUrl(panUrl); if (uniqueLinks.has(normalizedUrl)) { return } uniqueLinks.add(normalizedUrl); let accessCode = globalAccessCode; const index = text.indexOf(panUrl); if (index !== -1) { const searchStart = Math.max(0, index - 100); const searchEnd = Math.min(text.length, index + panUrl.length + 100); const contextText = text.substring(searchStart, searchEnd); const localCode = extractAccessCode(contextText); if (localCode) { accessCode = localCode } const directMatch = contextText.match(new RegExp(`${escapeRegExp(panUrl)}[\\s\\S]{0,30}?(?:访问码|密码|访问密码|提取码|code)[:：]?\\s*([a-z0-9]{4,6})`, 'i')); if (directMatch && directMatch[1]) { accessCode = directMatch[1] } } tracks.push({ name: title, pan: panUrl, ext: { accessCode } }) }) }
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function isValidPanUrl(url) { if (!url) return false; return /https?:\/\/cloud\.189\.cn\/(t|web\/share )\//i.test(url) }
function normalizePanUrl(url) { const cleanUrl = url.replace(/\?.*$/, ''); return cleanUrl.toLowerCase() }


/**
 * 【访问码提取函数 - 增强版】
 * 增加了对新格式 "(访问码: xxxx)" 的支持。
 */
function extractAccessCode(text) {
  if (!text) return '';
  
  let match;

  // 格式1 (新增): (访问码: xxxx) 或 （访问码：xxxx）
  // 这个正则表达式会匹配半角和全角的括号、冒号和空格
  match = text.match(/[\(（]\s*访问码\s*[:：]\s*([a-z0-9]{4,6})\s*[\)）]/i);
  if (match && match[1]) return match[1];

  // 格式2: 【访问码：abcd】
  match = text.match(/[\[【]访问码[:：]\s*([a-z0-9]{4,6})[\]】]/i);
  if (match && match[1]) return match[1];
  
  // 格式3: 访问码：abcd (无括号)
  match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]\s*([a-z0-9]{4,6})\b/i);
  if (match && match[1]) return match[1];
  
  // 格式4: 独立的4-6位字母数字组合 (作为最后的备用方案)
  const standalone = text.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/i);
  if (standalone) {
    const code = standalone[1];
    if (!/^\d+$/.test(code) && !/^[a-z]+$/i.test(code) && !/^\d{4}$/.test(code)) {
      return code;
    }
  }
  
  return '';
}
