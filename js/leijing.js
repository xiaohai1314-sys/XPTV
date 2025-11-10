/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v35 (修复人机验证循环问题 & Emoji Argument Error)
 *
 * 更新说明:
 * - 修复: 解决人机验证成功后仍循环弹出的问题。
 * - 机制: 脚本现在会尝试获取并携带应用环境中的持久化 Cookie，确保验证成功后能保持会话。
 * - 【新增修复】: 解决详情页点击带 Emoji 链接时出现的 "Emoji Argument Error"。
 * - 版本号: 升级至 v35。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();
// const BACKEND_URL = 'http://192.168.1.3:3001'; // 此行已不再需要 ，但为保持结构完整性可保留或注释掉

const appConfig = {
  ver: 35, // 版本号保持不变
  title: '雷鲸',
  site: 'https://www.leijing1.com',
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

function getHtmlFromResponse(response) {
  if (typeof response === 'string') return response;
  if (response && typeof response.data === 'string') return response.data;
  console.error("收到了非预期的响应格式:", response);
  return ''; 
}

// 封装人机验证检查函数
function checkForHumanVerification(html, siteUrl, userAgent) {
  const $ = cheerio.load(html);
  const pageTitle = $('title').text();
  if (pageTitle.includes('Just a moment...')) {
    console.log("检测到人机验证，正在尝试跳转...");
    $utils.openSafari(siteUrl, userAgent);
    // 返回 true 表示需要中断当前操作
    return true;
  }
  return false;
}

// **【新增修复】** 辅助函数：移除常见的Emoji
function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  // 匹配大部分 Unicode Emoji 范围，确保文本不含Emoji
  // 这会移除点击详情页链接时导致错误的 Emoji 字符
  return text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\uFE0F|\u20E3|\u2600-\u26FF|\u2700-\u27BF|\u2B05-\u2B07|\u2B1B|\u2B1C|\u2B50|\u2B55|\u3030|\u303D|\u3297|\u3299]/g, '').trim();
}

// 辅助函数：获取并构建请求头
async function getRequestHeaders() {
    const headers = { 'User-Agent': UA };
    try {
        // 假设您的运行环境提供了 $utils.getCookie
        const cookie = await $utils.getCookie(appConfig.site);
        if (cookie) {
            headers['Cookie'] = cookie;
        }
    } catch (e) {
        console.log("无法获取持久化 Cookie，可能您的运行环境不支持 $utils.getCookie API。");
    }
    return headers;
}

// getCards 函数
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  // 使用新的请求头，携带 Cookie
  const headers = await getRequestHeaders();
  const response = await $fetch.get(requestUrl, { headers });
  const htmlData = getHtmlFromResponse(response);

  // 检查人机验证
  if (checkForHumanVerification(htmlData, appConfig.site, UA)) {
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
    
    // **【修改点 1/3】** 对标题进行 Emoji 净化
    const sanitizedDramaName = sanitizeText(dramaName);
    
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
    if (/content/.test(r) && !/cloud/.test(r)) return;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: href,
      vod_name: sanitizedDramaName, // 使用净化后的名称
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

// getTracks 函数 - 【核心修改部分】
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();

  try {
    const requestUrl = ext.url;
    const headers = await getRequestHeaders();
    const response = await $fetch.get(requestUrl, { headers });
    const htmlData = getHtmlFromResponse(response);

    if (checkForHumanVerification(htmlData, appConfig.site, UA)) {
      return jsonify({ list: [] });
    }

    const $ = cheerio.load(htmlData);

    // **【修改点 2/3 - A】** 对页面标题进行 Emoji 净化
    const pageTitle = sanitizeText($('.topicBox .title').text().trim() || "网盘资源");
    const bodyText = $('body').text();

    // 1. Precise Pattern 匹配
    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+   ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://' );
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      // 使用净化后的 pageTitle
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    // 2. <a> 标签匹配
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const $el = $(el);
      let href = $el.attr('href');
      if (!href) return;
      let agnosticUrl = getProtocolAgnosticUrl(href);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) return;
      href = href.replace('http://', 'https://' );
      let trackName = $el.text().trim() || pageTitle;
      
      // **【修改点 2/3 - B】** 对从 <a> 标签文本中提取的 trackName 进行 Emoji 净化
      const sanitizedTrackName = sanitizeText(trackName); 
      
      tracks.push({ name: sanitizedTrackName, pan: href, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    });

    // 3. 纯 URL Pattern 匹配
    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<> ）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://' );
      let accessCode = '';
      const codeMatch = bodyText.slice(match.index, match.index + 100)
        .match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/);
      if (codeMatch) accessCode = codeMatch[1];
      panUrl = panUrl.trim().replace(/[）\)]+$/, '');
      if (accessCode) panUrl = `${panUrl}（访问码：${accessCode}）`;
      const agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      // 使用净化后的 pageTitle
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

// search 函数 (已修改，直接请求官方网站，不再依赖私有后端)
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  // 对搜索文本进行URL编码，这是标准的Web实践
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  // 构建请求URL，直接指向雷鲸小站的官方搜索路径
  const requestUrl = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  
  // 获取包含Cookie的请求头，以应对可能的人机验证
  const headers = await getRequestHeaders();

  try {
    const response = await $fetch.get(requestUrl, { headers });
    const htmlData = getHtmlFromResponse(response);

    // 检查返回的HTML是否为人机验证页面
    if (checkForHumanVerification(htmlData, appConfig.site, UA)) {
      console.log("需要人机验证，请在弹出的页面中完成操作。");
      return jsonify({ list: [] }); 
    }

    // 使用cheerio加载返回的HTML内容
    const $ = cheerio.load(htmlData);

    // 解析逻辑
    $('.topicItem').each((_, el) => {
      const a = $(el).find('h2 a');
      const href = a.attr('href');
      const title = a.text();
      const tag = $(el).find('.tag').text();
      
      // 过滤掉无效或不需要的结果
      if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
      
      // **【修改点 3/3】** 对搜索结果标题进行 Emoji 净化
      const sanitizedTitle = sanitizeText(title);

      cards.push({
        vod_id: href,
        vod_name: sanitizedTitle, // 使用净化后的名称
        vod_pic: '', // 列表页通常没有图片，详情页才有
        vod_remarks: tag,
        ext: { url: `${appConfig.site}/${href}` }, // 构建详情页的完整URL
      });
    });

    // 返回JSON格式的卡片列表
    return jsonify({ list: cards });

  } catch (e) {
    console.error(`直接搜索失败: ${e}`);
    return jsonify({ list: [] });
  }
}

// 保持不变的外部结构，以防 App 环境依赖于函数的顺序
// ...
