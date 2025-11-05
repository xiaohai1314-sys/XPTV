/*
 * 雷鲸资源站脚本 - 自动登录版本
 * 当Cookie失效时自动重新登录获取新Cookie
 */

const cheerio = createCheerio(); 
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// ★★★ 配置你的账号信息（支持多账号） ★★★
const ACCOUNTS = [
  { username: 'xiaohai1314', password: 'xiaohai1314', name: '主账号' },
  // 添加更多备用账号
  // { username: 'user2', password: 'pass2', name: '备用账号1' },
];

const appConfig = {
  ver: 38,
  title: '雷鲸 (自动登录)',
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

// Cookie缓存管理
let cookieCache = {
  value: null,
  expireTime: 0,
  accountIndex: 0
};

// 从响应头中提取Cookie
function extractCookieFromHeaders(headers) {
  if (!headers) return null;
  
  const setCookieHeaders = headers['set-cookie'] || headers['Set-Cookie'];
  if (!setCookieHeaders) return null;
  
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

// 执行登录获取Cookie
async function loginAndGetCookie(account) {
  console.log(`尝试使用账号 ${account.name} 登录...`);
  
  try {
    // 第一步：访问登录页面获取初始Cookie
    const loginPageResponse = await $fetch.get(`${appConfig.site}/login`, {
      headers: { 'User-Agent': UA },
      redirect: 'follow'
    });
    
    let initialCookie = extractCookieFromHeaders(loginPageResponse.headers);
    
    // 第二步：提交登录表单
    const loginData = new URLSearchParams({
      username: account.username,
      password: account.password,
      rememberMe: 'true'
    }).toString();
    
    const loginResponse = await $fetch.post(`${appConfig.site}/api/login`, {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': initialCookie || '',
        'Referer': `${appConfig.site}/login`,
        'Origin': appConfig.site
      },
      body: loginData
    });
    
    // 第三步：合并Cookie
    const loginCookie = extractCookieFromHeaders(loginResponse.headers);
    const finalCookie = loginCookie || initialCookie;
    
    if (!finalCookie) {
      throw new Error('未能获取Cookie');
    }
    
    // 验证Cookie是否有效
    const testResponse = await $fetch.get(`${appConfig.site}/`, {
      headers: {
        'User-Agent': UA,
        'Cookie': finalCookie
      }
    });
    
    const testHtml = getHtmlFromResponse(testResponse);
    if (testHtml.includes('登录') && !testHtml.includes('退出')) {
      throw new Error('登录失败，Cookie无效');
    }
    
    console.log(`账号 ${account.name} 登录成功！`);
    
    // 缓存Cookie（默认30分钟有效期）
    cookieCache = {
      value: finalCookie,
      expireTime: Date.now() + 30 * 60 * 1000,
      accountIndex: ACCOUNTS.indexOf(account)
    };
    
    return finalCookie;
    
  } catch (e) {
    console.error(`账号 ${account.name} 登录失败:`, e);
    return null;
  }
}

// 获取有效Cookie（自动登录）
async function getValidCookie() {
  // 检查缓存的Cookie是否还有效
  if (cookieCache.value && Date.now() < cookieCache.expireTime) {
    console.log('使用缓存的Cookie');
    return cookieCache.value;
  }
  
  // Cookie过期或不存在，尝试登录
  console.log('Cookie已过期，准备重新登录...');
  
  // 轮流尝试所有账号
  const startIndex = cookieCache.accountIndex;
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const accountIndex = (startIndex + i) % ACCOUNTS.length;
    const account = ACCOUNTS[accountIndex];
    
    const cookie = await loginAndGetCookie(account);
    if (cookie) {
      return cookie;
    }
    
    // 如果这个账号失败，等待2秒后尝试下一个
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 所有账号都登录失败
  console.error('所有账号都无法登录！');
  return null;
}

async function getConfig() {
  return jsonify(appConfig);
}

function getHtmlFromResponse(response) {
  if (typeof response === 'string') return response;
  if (response && typeof response.data === 'string') return response.data;
  return ''; 
}

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
    const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const htmlData = getHtmlFromResponse(response);
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

    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<> ）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let accessCode = '';
      const codeMatch = bodyText.slice(match.index, match.index + 100).match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/);
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

// 搜索功能 - 自动处理Cookie失效
async function search(ext) {
  ext = argsify(ext);
  
  if (ACCOUNTS.length === 0 || !ACCOUNTS[0].username) {
    return jsonify({
      list: [{
        vod_id: 'no_account',
        vod_name: '错误：请配置账号信息',
        vod_remarks: '编辑脚本的ACCOUNTS数组',
        vod_pic: ''
      }]
    });
  }

  const maxRetries = 2;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      // 获取有效Cookie（自动登录）
      const cookie = await getValidCookie();
      
      if (!cookie) {
        return jsonify({
          list: [{
            vod_id: 'login_failed',
            vod_name: '所有账号都无法登录',
            vod_remarks: '请检查账号密码是否正确',
            vod_pic: ''
          }]
        });
      }
      
      const text = encodeURIComponent(ext.text);
      const page = ext.page || 1;
      const requestUrl = `${appConfig.site}/search?keyword=${text}&page=${page}`;

      const response = await $fetch.get(requestUrl, {
        headers: {
          'User-Agent': UA,
          'Cookie': cookie,
          'Referer': appConfig.site + '/',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        }
      });

      const htmlData = getHtmlFromResponse(response);
      const $ = cheerio.load(htmlData);

      // 检查是否需要重新登录
      if ($('title').text().includes('登录') || htmlData.includes('login')) {
        console.log('Cookie失效，清除缓存并重试...');
        cookieCache.value = null; // 清除缓存
        continue; // 重试
      }

      // 成功获取搜索结果
      let cards = [];

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

    } catch (e) {
      console.error('搜索失败:', e);
      cookieCache.value = null; // 出错时清除缓存
      
      if (retry === maxRetries - 1) {
        return jsonify({
          list: [{
            vod_id: 'search_error',
            vod_name: '搜索失败',
            vod_remarks: e.message || '未知错误',
            vod_pic: ''
          }]
        });
      }
    }
  }
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

/*
 * === 自动登录版本优势 ===
 * 
 * ✅ Cookie失效自动重新登录
 * ✅ 支持多账号自动轮换
 * ✅ 无需手动更新Cookie
 * ✅ 30分钟智能缓存
 * ✅ 失败自动切换账号
 * 
 * 配置方法：
 * 1. 在ACCOUNTS数组中填入账号密码
 * 2. 可以添加多个备用账号
 * 3. 脚本会自动处理Cookie更新
 * 
 * 注意：
 * - 需要播放器支持$fetch.post功能
 * - 如果网站有验证码会失败
 * - 建议配置2-3个备用账号
 */
