/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v35.3 (内联修复版)
 *
 * 更新说明:
 * - 最终修复: 解决 Tab 栏消失的问题。
 * - 机制: 移除 checkForHumanVerification 独立函数，将验证逻辑内联到主函数中，
 * 避免脚本初始化时发生错误，确保 getConfig 成功执行。
 * =================================================================
 */

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)";
const cheerio = createCheerio();
const BACKEND_URL = 'http://192.168.1.3:3001';

const appConfig = {
  ver: 35.3, // 版本号升级
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
  // 此函数完全不受任何 $fetch 或验证逻辑影响，确保 Tab 显示
  return jsonify(appConfig);
}

// 提取天翼云盘链接逻辑
function getProtocolAgnosticUrl(rawUrl) {
  if (!rawUrl) return null;
  const cleaned = rawUrl.replace(/（访问码[:：\uff1a][a-zA-Z0-9]{4,6}）/g, '');
  const match = cleaned.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
  return match ? match[0] : null;
}

// getCards
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  const response = await $fetch.get(requestUrl, {
    headers: { 'User-Agent': UA }
  });
  const htmlData = typeof response === 'string' ? response : response.data;

  // ✅ Cloudflare 验证检测 (内联逻辑)
  const $check = cheerio.load(htmlData);
  const title = $check('title').text().trim();
  if (
    title.includes('Just a moment') ||
    htmlData.includes('cf-challenge') ||
    htmlData.includes('Checking your browser') ||
    htmlData.includes('Attention Required')
  ) {
      console.log("检测到人机验证，已自动打开 Safari。");
      $utils.openSafari(appConfig.site, UA);
      // 继续执行，解析失败，返回空列表，但流程不中断。
  }
  // ------------------------------------

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

// getTracks
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();

  try {
    const requestUrl = ext.url;
    const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const htmlData = typeof response === 'string' ? response : response.data;

    // ✅ Cloudflare 验证检测 (内联逻辑)
    const $check = cheerio.load(htmlData);
    const title = $check('title').text().trim();
    if (
      title.includes('Just a moment') ||
      htmlData.includes('cf-challenge') ||
      htmlData.includes('Checking your browser') ||
      htmlData.includes('Attention Required')
    ) {
        console.log("检测到人机验证，已自动打开 Safari。");
        $utils.openSafari(appConfig.site, UA);
    }
    // ------------------------------------

    const $ = cheerio.load(htmlData);
    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

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

    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<>）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let accessCode = '';
      const codeMatch = bodyText.slice(match.index, match.index + 100)
        .match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/);
      if (codeMatch) accessCode = codeMatch[1];
      panUrl = panUrl.trim().replace(/[）\)]+$/, '');
      if (accessCode) panUrl = `${panUrl}（访问码：${accessCode}）`;
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

// search 保持不变
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`;
  const response = await $fetch.get(requestUrl);
  const htmlData = typeof response === 'string' ? response : response.data;

  // ✅ Cloudflare 验证检测 (内联逻辑)
  const $check = cheerio.load(htmlData);
  const title = $check('title').text().trim();
  if (
    title.includes('Just a moment') ||
    htmlData.includes('cf-challenge') ||
    htmlData.includes('Checking your browser') ||
    htmlData.includes('Attention Required')
  ) {
      console.log("检测到人机验证，已自动打开 Safari。");
      // 注意：search 函数使用的是 BACKEND_URL，如果验证发生在 BACKEND_URL 上，这里的 siteUrl 应该是 BACKEND_URL
      // 但鉴于主要验证发生在 appConfig.site，我们依然用它来尝试解决问题。
      $utils.openSafari(appConfig.site, UA);
  }
  // ------------------------------------

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
