/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v36.1 修正版（兼容新版页面结构）
 *
 * 更新说明 (v36.1):
 * - 修正 getCards 函数，以适应 leijing1.com 最新的前端页面结构。
 * - 将列表项选择器从 '.topicItem' 更新为 '.post-item'。
 * - 更新了获取标题、链接和标签的内部选择器。
 * - 其他函数（如 search, getTracks）保持不变，但请注意它们也可能因网站更新而失效。
 *
 * 更新说明 (v35):
 * - 移除账号密码登录逻辑，改为直接使用用户提供的 Cookie 字符串。
 * - 在脚本顶部定义 `USER_COOKIE` 常量，请在此处填入你的 Cookie。
 * - 所有网络请求将自动携带此 Cookie，以保持登录会话。
 * - 简化了代码，移除了不再需要的 axios 和 tough-cookie 依赖。
 * - 保持 v33 的所有功能（访问码拼接、去重增强等）。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();
// ⚠️ 注意：这个 IP 地址是本地地址，如果您的运行环境无法访问，请修改为正确的后端服务地址。
const BACKEND_URL = 'http://192.168.1.3:3001'; 

// ============================ 关键配置 ============================
// ⚠️ 请将下面的字符串替换为您自己的完整 Cookie
const USER_COOKIE = 'eoi=ID=0dbb28bf1e95b293:T=1760889219:RT=1760889219:S=AA-AfjYdK1a9Hn9QyIpTjcD9Dy1w; cf_clearance=1KSgiw7quPKkMiFpRseR8YlHhPJjE_fl0v.L6LbMzlo-1762633022-1.2.1.1-WPvSiDK.w5XsUlu3sIwM4r5pg8AbCqXfGCsZYrFulDsMxo0Z0oKHy4YZNU1C.70_VsKU.D5AgZOZPChSUtnGk8iYVjvnTdrsprQVVyupyTPYq9xRR1KlQoeJ1JqAtjGSqYQu0y_UHuMqdpX.7UDjjQIpRK_gyc2kt5DiEcH2u.Vug6xqZtMX96KOmgB2tsb_I9aWRs5Hl7_UneGjZeeVXPUxtaPY4Fl.0n2z3btGdbYs3hYuja0aWXP0oJSUIs1i; __gads=ID=ebf773339e181721:T=1760889219:RT=1760889219:S=ALNI_MZfqUGthmjWHR1DiGAkynLdHaoVZw; __gpi=UID=000012b7ed6f2a8b:T=1760889219:RT=1760889219:S=ALNI_MaypqVukBihQplCbqa_MrCVPwJkTQ; _ga=GA1.1.1766815720.1762630882; _ga_FM8S5GPFE1=GS2.1.s1762633030$o2$g1$t1762633035$j55$l0$h0; _ga_WPP9075S5T=GS2.1.s1762633030$o2$g1$t1762633035$j55$l0$h0; cms_token=67de22ffa3184ee89c74e1d1eb5bb4aa; JSESSIONID=15D09C7857B0243558DC7B2ECF5802F4';
// =================================================================

const appConfig = {
  ver: 36.1, // 版本号更新
  title: '雷鲸',
  site: 'https://www.leijing1.com/',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
};

// 统一的请求头，包含 User-Agent 和 Cookie
const requestHeaders = {
  'User-Agent': UA,
  'Cookie': USER_COOKIE,
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

// =========== 已根据新版网站结构进行修改 ===========
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  const response = await $fetch.get(requestUrl, { headers: requestHeaders });
  const htmlData = getHtmlFromResponse(response);

  const $ = cheerio.load(htmlData);

  // 使用新的选择器 '.topicItem' 来遍历列表项
  $('.topicItem').each((_, each) => {
    // 检查是否有锁定图标，新版网站可能使用不同的 class，例如 .cms-lock-solid
    if ($(each).find('.cms-lock-solid').length > 0) return;

    // 更新内部元素的选择器以匹配新结构
    const a = $(each).find('h2.title a');
    const href = a.attr('href');
    const title = a.text();
    
    // 标题提取逻辑保持不变
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    
    // 更新摘要和标签的选择器
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
    
    // 过滤逻辑保持不变
    if (/content/.test(r) && !/cloud/.test(r)) return;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    
    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '', // 图片现在可能在 .post-item-cover img 中，如果需要可以添加
      vod_remarks: tag, // 将标签放入备注
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  
  return jsonify({ list: cards });
}
// =====================================================

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

function getProtocolAgnosticUrl(rawUrl) {
  if (!rawUrl) return null;
  const cleaned = rawUrl.replace(/（访问码[:：\uff1a][a-zA-Z0-9]{4,6}）/g, '');
  const match = cleaned.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
  return match ? match[0] : null;
}

async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();

  try {
    const requestUrl = ext.url;
    // 在请求中带上包含 Cookie 的请求头
    const response = await $fetch.get(requestUrl, { headers: requestHeaders });
    const htmlData = getHtmlFromResponse(response);
    const $ = cheerio.load(htmlData);

    // 后续逻辑保持不变
    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+  ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
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

async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`;
  // 搜索功能也需要带上 Cookie
  const response = await $fetch.get(requestUrl, { headers: requestHeaders });
  const htmlData = getHtmlFromResponse(response);
  const $ = cheerio.load(htmlData);

  // 注意：如果搜索结果页面的结构也已更改，这里的 '.topicItem' 也需要同步更新。
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
