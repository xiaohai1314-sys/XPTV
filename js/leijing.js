/**
 * =================================================================
 * 脚本最终修复版 - 策略变更
 * 版本: 18
 *
 * 核心策略:
 * 1. 承认无法稳定获取JS动态渲染的访问码文本。
 * 2. 改变策略，以找到并返回链接为最高优先级。
 * 3. 优先尝试从链接周围文本提取访问码。
 * 4. 如果找不到，则返回链接，并将访问码留空，确保用户至少能得到链接。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 18,
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
async function getCards(ext) { ext = argsify(ext); let cards = []; let { page = 1, id } = ext; const url = appConfig.site + `/${id}&page=${page}`; const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } }); const $ = cheerio.load(data); $('.topicItem').each((index, each) => { if ($(each).find('.cms-lock-solid').length > 0) return; const href = $(each).find('h2 a').attr('href'); const title = $(each).find('h2 a').text(); const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/; const match = title.match(regex); const dramaName = match ? match[1] : title; const r = $(each).find('.summary').text(); const tag = $(each).find('.tag').text(); if (/content/.test(r) && !/cloud/.test(r)) return; if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; cards.push({ vod_id: href, vod_name: dramaName, vod_pic: '', vod_remarks: '', ext: { url: `${appConfig.site}/${href}` }, }); }); return jsonify({ list: cards }); }
async function getPlayinfo(ext) { return jsonify({ 'urls': [] }); }
async function search(ext) { ext = argsify(ext); let cards = []; let text = encodeURIComponent(ext.text); let page = ext.page || 1; let url = `${appConfig.site}/search?keyword=${text}&page=${page}`; const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } }); const $ = cheerio.load(data); const searchItems = $('.search-result ul > li, .topic-list > .topic-item, .result-list > .item, ul.search-results > li.result-item, .topicItem, .searchModule .item'); searchItems.each((index, each) => { const $item = $(each); const a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a'); const href = a.attr('href'); const title = a.text(); if (!href || !title) return; const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/; const match = title.match(regex); const dramaName = match ? match[1] : title; const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim(); if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; cards.push({ vod_id: href, vod_name: dramaName, vod_pic: $item.find('img').attr('src') || '', vod_remarks: tag, ext: { url: `${appConfig.site}/${href}` }, }); }); return jsonify({ list: cards }); }
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function isValidPanUrl(url) { if (!url) return false; return /https?:\/\/cloud\.189\.cn\/(t|web\/share )\//i.test(url) }
function normalizePanUrl(url) { const cleanUrl = url.replace(/\?.*$/, ''); return cleanUrl.toLowerCase() }
// --- 其他函数保持不变 ---

/**
 * 【访问码提取函数 - 增强版】
 * 增加了对新格式 "(访问码: xxxx)" 的支持。
 */
function extractAccessCode(text) {
  if (!text) return '';
  let match;
  match = text.match(/[\(（]\s*访问码\s*[:：]\s*([a-z0-9]{4,6})\s*[\)）]/i);
  if (match && match[1]) return match[1];
  match = text.match(/[\[【]访问码[:：]\s*([a-z0-9]{4,6})[\]】]/i);
  if (match && match[1]) return match[1];
  match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]\s*([a-z0-9]{4,6})\b/i);
  if (match && match[1]) return match[1];
  const standalone = text.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/i);
  if (standalone) { const code = standalone[1]; if (!/^\d+$/.test(code) && !/^[a-z]+$/i.test(code) && !/^\d{4}$/.test(code)) { return code; } }
  return '';
}

/**
 * 【详情页解析 - 策略变更版】
 */
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

    // 策略1：优先查找<a>标签，并尝试从其父元素文本中提取访问码
    $('a[href*="cloud.189.cn"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && isValidPanUrl(href)) {
        const normalizedUrl = normalizePanUrl(href);
        if (uniqueLinks.has(normalizedUrl)) return;
        uniqueLinks.add(normalizedUrl);

        // 尝试从父元素文本中提取访问码
        const contextText = $(el).parent().text();
        const accessCode = extractAccessCode(contextText); // 找不到就返回空字符串

        tracks.push({
          name: $(el).text().trim() || title,
          pan: href,
          ext: { accessCode: accessCode || "" } // 确保返回访问码，即使是空的
        });
      }
    });

    // 策略2：如果上面没找到任何<a>标签，则对整个页面纯文本进行扫描
    if (tracks.length === 0) {
      console.log("未找到<a>标签中的链接，对全文进行扫描...");
      const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[^\s<>()]+/gi;
      let match;
      while ((match = urlPattern.exec(bodyText)) !== null) {
        const panUrl = match[0];
        if (isValidPanUrl(panUrl)) {
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            uniqueLinks.add(normalizedUrl);

            // 尝试从链接附近的文本中提取访问码
            const index = bodyText.indexOf(panUrl);
            const searchStart = Math.max(0, index - 50);
            const searchEnd = Math.min(bodyText.length, index + panUrl.length + 50);
            const contextText = bodyText.substring(searchStart, searchEnd);
            const accessCode = extractAccessCode(contextText);

            tracks.push({
                name: title,
                pan: panUrl,
                ext: { accessCode: accessCode || "" }
            });
        }
      }
    }

    return jsonify({ list: [{ title: "资源列表", tracks }] });

  } catch (e) {
    return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
  }
}
