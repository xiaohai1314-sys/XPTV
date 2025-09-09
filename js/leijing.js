/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v29 (JSON登录版)
 *
 * 更新说明:
 * - 登录接口返回 JSON，直接提取 accessToken/refreshToken。
 * - 不再依赖 headers.set-cookie，适配 App 环境。
 * - 所有请求仍通过 fetchWithLogin()，Cookie 自动带上。
 * - 保留原始分类结构 (tabs/ext) 完全不变。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// =============== 登录配置（请自行修改账号/密码哈希/登录token）================
const USERNAME = "xiaohai1314"; 
const PASSWORD_HASH = "902253f297e77213c7ea45d96dc1edafcb9e5e5bcebf87363ff0949bf2eaefca"; 
const LOGIN_TOKEN = "9a85d97e4f834e0fbc7cf7bbcda5c534"; 

let cookieStr = ""; // 全局保存 Cookie

// login: 直接解析 JSON 提取 accessToken/refreshToken
async function login() {
  const timestamp = Date.now();
  const body = `jumpUrl=&token=${LOGIN_TOKEN}&captchaKey=&captchaValue=&type=10&account=${USERNAME}&password=${PASSWORD_HASH}`;
  const res = await $fetch.post(`https://www.leijing.xyz/login?&timestamp=${timestamp}`, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Origin": "https://www.leijing.xyz",
      "Referer": "https://www.leijing.xyz/login",
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  let data;
  try {
    data = JSON.parse(res.data);
  } catch (e) {
    throw new Error("登录失败: 返回不是 JSON → " + res.data.slice(0, 100));
  }

  if (!data.accessToken) {
    throw new Error("登录失败: 未找到 accessToken → " + res.data.slice(0, 100));
  }

  cookieStr = `cms_accessToken=${data.accessToken}; cms_refreshToken=${data.refreshToken}`;
  console.log("登录成功，新的 Cookie:", cookieStr);
}

// fetchWithLogin: 自动携带 Cookie，如果失效会重新登录
async function fetchWithLogin(url, options = {}) {
  if (!cookieStr) {
    await login();
  }
  try {
    const res = await $fetch.get(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "User-Agent": UA,
        "Referer": "https://www.leijing.xyz",
        "Cookie": cookieStr
      }
    });
    if (!res.data || res.data.includes("登录") || res.status === 401 || res.status === 403) {
      await login();
      return await fetchWithLogin(url, options);
    }
    return res;
  } catch (err) {
    console.error("请求失败:", err);
    throw err;
  }
}

// appConfig 与 v21 原版一致
const appConfig = {
  ver: 29,
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

// getCards
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;

  const { data } = await fetchWithLogin(url);
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
  return jsonify({ urls: [] });
}

// 提取纯净 URL
function getProtocolAgnosticUrl(rawUrl) {
  if (!rawUrl) return null;
  const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
  return match ? match[0] : null;
}

// getTracks
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const uniqueLinks = new Set();

  try {
    const { data } = await fetchWithLogin(url);
    const $ = cheerio.load(data);

    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    // 策略一：精准匹配
    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      uniqueLinks.add(agnosticUrl);
    }

    // 策略二：<a> 标签
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const $el = $(el);
      let href = $el.attr('href');
      if (!href) return;
      let agnosticUrl = getProtocolAgnosticUrl(href);
      if (!agnosticUrl || uniqueLinks.has(agnosticUrl)) return;
      href = href.replace('http://', 'https://');
      let trackName = $el.text().trim();
      if (trackName.startsWith('http') || trackName === '') {
        trackName = pageTitle;
      }
      tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
      uniqueLinks.add(agnosticUrl);
    });

    // 策略三：纯文本 URL
    const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      uniqueLinks.add(agnosticUrl);
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

// search
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;

  const { data } = await fetchWithLogin(url);
  const $ = cheerio.load(data);
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
