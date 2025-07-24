/**
 * =================================================================
 * 脚本最终修复版 - 针对PC端HTML结构
 * 确认App环境（手机/TV）获取的为PC版网页。
 *
 * 版本: 13
 *
 * 核心修复：
 * 1. 更新 search 函数以匹配新的PC端搜索结果页结构。
 * 2. 增强 getTracks 函数的链接和访问码提取能力，使其更稳健。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 13,
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

async function getConfig( ) {
  return jsonify(appConfig);
}

// 分类列表页函数 (保持原样，假设PC分类页结构未变)
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

// 详情页解析函数 (增强版)
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const uniqueLinks = new Set();

  try {
    console.log(`正在加载资源页面 (PC模式): ${url}`);
    const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
    const $ = cheerio.load(data);
    
    const title = $('.topicBox .title').text().trim() || "网盘资源";
    console.log(`页面标题: ${title}`);

    let globalAccessCode = '';
    const bodyText = $('body').text();
    const globalCodeMatch = bodyText.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i);
    if (globalCodeMatch) {
      globalAccessCode = globalCodeMatch[1];
      console.log(`全局访问码: ${globalAccessCode}`);
    }

    // 【增强点】直接查找所有天翼云盘的链接，更可靠
    $('a[href*="cloud.189.cn"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && isValidPanUrl(href)) {
        const normalizedUrl = normalizePanUrl(href);
        if (uniqueLinks.has(normalizedUrl)) return;
        uniqueLinks.add(normalizedUrl);

        let accessCode = globalAccessCode;
        const contextText = $(el).parent().text();
        const localCode = extractAccessCode(contextText);
        if (localCode) accessCode = localCode;
        
        const linkText = $(el).text().trim();
        tracks.push({
          name: linkText || title,
          pan: href,
          ext: { accessCode }
        });
      }
    });
    
    if (tracks.length === 0) {
      console.log("备用方案：扫描全文寻找链接...");
      scanForLinks(bodyText, tracks, globalAccessCode, uniqueLinks, title);
    }

    console.log(`共找到 ${tracks.length} 个资源`);
    return jsonify({ list: [{ title: "资源列表", tracks }] });

  } catch (e) {
    console.error("资源加载错误:", e);
    return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
  }
}

// 辅助函数：扫描文本中的链接
function scanForLinks(text, tracks, globalAccessCode, uniqueLinks, title) { if (!text) return; const panMatches = []; const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[^\s<)]+/gi; let match; while ((match = urlPattern.exec(text)) !== null) { panMatches.push(match[0]) } const shortPattern = /cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi; while ((match = shortPattern.exec(text)) !== null) { panMatches.push('https://' + match[0] ) } const uniquePanMatches = [...new Set(panMatches)]; uniquePanMatches.forEach(panUrl => { if (!isValidPanUrl(panUrl)) return; const normalizedUrl = normalizePanUrl(panUrl); if (uniqueLinks.has(normalizedUrl)) { console.log(`跳过重复链接: ${panUrl}`); return } uniqueLinks.add(normalizedUrl); let accessCode = globalAccessCode; const index = text.indexOf(panUrl); if (index !== -1) { const searchStart = Math.max(0, index - 100); const searchEnd = Math.min(text.length, index + panUrl.length + 100); const contextText = text.substring(searchStart, searchEnd); const localCode = extractAccessCode(contextText); if (localCode) { console.log(`为链接 ${panUrl} 找到专属访问码: ${localCode}`); accessCode = localCode } const directMatch = contextText.match(new RegExp(`${escapeRegExp(panUrl)}[\\s\\S]{0,30}?(?:访问码|密码|访问密码|提取码|code)[:：]?\\s*([a-z0-9]{4,6})`, 'i')); if (directMatch && directMatch[1]) { console.log(`找到直接关联访问码: ${directMatch[1]} for ${panUrl}`); accessCode = directMatch[1] } } tracks.push({ name: title, pan: panUrl, ext: { accessCode } }) }) }
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function extractAccessCode(text) { if (!text) return ''; let match = text.match(/[\[【]访问码[:：]\s*([a-z0-9]{4,6})[\]】]/i); if (match) return match[1]; match = text.match(/[\(（]密码[:：]\s*([a-z0-9]{4,6})[\)）]/i); if (match) return match[1]; match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i); if (match) return match[1]; const standalone = text.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/i); if (standalone) { const code = standalone[1]; if (!/^\d+$/.test(code) && !/^[a-z]+$/i.test(code) && !/^\d{4}$/.test(code)) { return code } } return '' }
function isValidPanUrl(url) { if (!url) return false; return /https?:\/\/cloud\.189\.cn\/(t|web\/share )\//i.test(url) }
function normalizePanUrl(url) { const cleanUrl = url.replace(/\?.*$/, ''); return cleanUrl.toLowerCase() }

async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] });
}

// 搜索函数 (已修复)
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);

  // **【修复点】** 使用PC端搜索结果页的新选择器
  $('.search-result ul > li').each((index, each) => {
    const $each = $(each);
    const a = $each.find('a.title');
    const href = a.attr('href');
    const title = a.text();
    
    if (!href) return;

    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const tag = $each.find('.tag').text();
    
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
