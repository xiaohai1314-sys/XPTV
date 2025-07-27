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

async function getTracks(ext) {
  ext = argsify(ext);
  const url = ext.url;
  const tracks = [];
  const seen = new Set();

  try {
    const { data: html } = await $fetch.get(url, {
      headers: { 'Referer': appConfig.site, 'User-Agent': UA }
    });

    const cheerioHtml = html.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    const $ = cheerio.load(cheerioHtml);
    const title = $('.topicBox .title').text().trim() || "天翼云盘";

    // 全文中提取全局访问码
    const globalMatch = $('body').text().match(/(?:提取码|访问码|密码)[：:\s]?([a-z0-9]{4,6})/i);
    const globalAccessCode = globalMatch ? globalMatch[1] : '';

    // 策略1：常规 a 标签
    $('a[href*="cloud.189.cn"]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const url = normalizePanUrl(href);
      if (seen.has(url)) return;
      const ctx = $(el).parent().text();
      const code = extractAccessCode(ctx) || globalAccessCode;
      tracks.push({ name: $(el).text().trim() || title, pan: href, ext: { accessCode: code } });
      seen.add(url);
    });

    // 策略2：document.write 注入的链接
    const docWritePattern = /document\.write\((['"`])([\s\S]*?)\1\)/g;
    let match;
    while ((match = docWritePattern.exec(html)) !== null) {
      const inner = match[2].replace(/\\u([\d\w]{4})/gi, (_, g) => String.fromCharCode(parseInt(g, 16)));
      const urlMatch = inner.match(/https?:\/\/cloud\.189\.cn\/[^\s"'<>]{4,}/i);
      if (!urlMatch) continue;
      const link = urlMatch[0];
      const norm = normalizePanUrl(link);
      if (seen.has(norm)) continue;
      const code = extractAccessCode(inner) || globalAccessCode;
      tracks.push({ name: title, pan: link, ext: { accessCode: code } });
      seen.add(norm);
    }

    return tracks.length > 0
      ? jsonify({ list: [{ title: "天翼云盘", tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    return jsonify({
      list: [{
        title: "加载失败",
        tracks: [{ name: "错误", pan: "加载异常", ext: {} }]
      }]
    });
  }
}

function extractAccessCode(text) {
  const m = text.match(/(?:提取码|访问码|密码|code)\s*[:：\s]*([a-z0-9]{4,6})/i);
  return m ? m[1] : '';
}

function normalizePanUrl(url) {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).toLowerCase();
  } catch {
    return url.toLowerCase();
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
  const searchItems = $('.search-result ul > li, .topicItem, .searchModule .item');
  searchItems.each((index, each) => {
    const $item = $(each);
    const a = $item.find('a.title, h2 a, h3 a');
    const href = a.attr('href');
    const title = a.text();
    if (!href || !title) return;
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const tag = $item.find('.tag, .category, .item-tag').text().trim();
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
