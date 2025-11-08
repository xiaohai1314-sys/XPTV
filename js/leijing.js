/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v35.2 (修复版)
 *
 * 更新说明:
 * - 修复: 解决了 v35.1 中因人机验证逻辑修改导致分类列表无法显示的问题。
 * - 改进: 验证检测逻辑参考“玩偶哥哥”，不再循环触发，仅在首次检测到 Cloudflare 验证时打开 Safari。
 * - 机制: 当检测到验证页面时，会中断当前的解析流程，避免对无效 HTML 进行操作，同时交由系统自动处理 cf_clearance。
 * - 版本号: 升级至 v35.2。
 * =================================================================
 */

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)";
const cheerio = createCheerio();
const BACKEND_URL = 'http://192.168.1.3:3001';

const appConfig = {
  ver: 35.2, // 版本号更新
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

// ========== ✅ 验证检测逻辑 (已修复) ========== //
function checkForHumanVerification(html, siteUrl, userAgent) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  const needsVerification = title.includes('Just a moment') ||
                            html.includes('cf-challenge') ||
                            html.includes('Checking your browser') ||
                            html.includes('Attention Required');
  
  if (needsVerification) {
    // 使用缓存机制，确保一小时内只打开一次浏览器
    if (!$cache.get('leijing_verified')) {
      $cache.set('leijing_verified', true, 3600); // 设置1小时的标记
      console.log("检测到人机验证，已自动打开 Safari，请在浏览器中完成验证。");
      $utils.openSafari(siteUrl, userAgent);
    }
    // 返回 true，通知调用者需要中断操作
    return true;
  }
  // 如果不需要验证，返回 false
  return false;
}
// ======================================================= //

// getCards (已修复)
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  const response = await $fetch.get(requestUrl, {
    headers: { 'User-Agent': UA }
  });
  const htmlData = typeof response === 'string' ? response : response.data;

  // ✅ 检测验证页，如果需要验证则中断执行
  if (checkForHumanVerification(htmlData, appConfig.site, UA)) {
    console.log("getCards 中断：等待人机验证完成。");
    return jsonify({ list: [] });
  }

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
  const cleaned = rawUrl.replace(/（访问码[:：\uff1a][a-zA-Z0-9]{4,6}）/g, '');
  const match = cleaned.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
  return match ? match[0] : null;
}

// getTracks (已修复)
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();

  try {
    const requestUrl = ext.url;
    const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const htmlData = typeof response === 'string' ? response : response.data;

    // ✅ 检测验证页，如果需要验证则中断执行
    if (checkForHumanVerification(htmlData, appConfig.site, UA)) {
      console.log("getTracks 中断：等待人机验证完成。");
      return jsonify({ list: [] });
    }

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
      const agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      if (accessCode) panUrl = `${panUrl}（访问码：${accessCode}）`;
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

// search (已修复)
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`;
  const response = await $fetch.get(requestUrl);
  const htmlData = typeof response === 'string' ? response : response.data;

  // ✅ 检测验证页，如果需要验证则中断执行
  if (checkForHumanVerification(htmlData, appConfig.site, UA)) {
    console.log("search 中断：等待人机验证完成。");
    return jsonify({ list: [] });
  }

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
