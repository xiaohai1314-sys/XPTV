/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v33 修正版（支持访问码拼接 + 去重增强）
 *
 * 更新说明:
 * - 修复无法识别带中文括号访问码的链接。
 * - 自动拼接格式「链接（访问码：xxxx）」。
 * - 增强去重机制：即使带括号/访问码的重复链接也只保留一条。
 * - 分类结构、精准匹配、<a>提取部分保持原样。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();
const BACKEND_URL = 'http://192.168.1.7:3001';

const appConfig = {
  ver: 33,
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

function getHtmlFromResponse(response) {
  if (typeof response === 'string') return response;
  if (response && typeof response.data === 'string') return response.data;
  console.error("收到了非预期的响应格式:", response);
  return ''; 
}

// getCards 函数
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
  const htmlData = getHtmlFromResponse(response);

  const $ = cheerio.load(htmlData);
  $('.topicItem').each((_, each) => {
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
  return jsonify({ urls: [] });
}

function getProtocolAgnosticUrl(rawUrl) {
  if (!rawUrl) return null;
  // 🔹 去除访问码部分后提取核心 cloud.189.cn 链接
  const cleaned = rawUrl.replace(/（访问码[:：\uff1a][a-zA-Z0-9]{4,6}）/g, '');
  const match = cleaned.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
  return match ? match[0] : null;
}

// getTracks 函数
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();

  try {
    const requestUrl = ext.url;
    const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const htmlData = getHtmlFromResponse(response);
    const $ = cheerio.load(htmlData);

    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    // 第一部分：精准匹配（保持原样）
    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+  ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    // 第二部分：<a> 标签提取（保持原样）
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const $el = $(el);
      let href = $el.attr('href');
      if (!href) return;
      let agnosticUrl = getProtocolAgnosticUrl(href);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) return;
      href = href.replace('http://', 'https://');
      let trackName = $el.text().trim() || pageTitle;
      tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    });

    // 第三部分：裸文本提取（修正版 + 去重增强）
    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<>）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');

      // ✅ 提取访问码
      let accessCode = '';
      const codeMatch = bodyText.slice(match.index, match.index + 100)
        .match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/);
      if (codeMatch) accessCode = codeMatch[1];

      // ✅ 去除尾部多余符号
      panUrl = panUrl.trim().replace(/[）\)]+$/, '');

      // ✅ 拼接访问码
      if (accessCode) panUrl = `${panUrl}（访问码：${accessCode}）`;

      // ✅ 去重前清理访问码部分
      const agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;

      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    return tracks.length
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    console.error('获取详情页失败:', e);
    return jsonify({
      list: [{
        title: '错误',
        tracks: [{ name: '加载失败', pan: 'about:blank', ext: { accessCode: '' } }]
      }]
    });
  }
}

// search 函数
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`;
  const response = await $fetch.get(requestUrl);
  const htmlData = getHtmlFromResponse(response);
  const $ = cheerio.load(htmlData);

  $('.topicItem').each((_, el) => {
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $(el).find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
