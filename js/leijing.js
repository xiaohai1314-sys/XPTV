/*
 * 雷鲸资源站脚本 - 自动登录版本 (修正版)
 * 当Cookie失效时自动重新登录获取新Cookie
 *
 * =================================================
 * 主要修正点 (由AI分析并生成):
 * 1. 新增内置SHA256加密函数，解决CryptoJS依赖问题。
 * 2. 登录前先访问登录页，以获取动态的CSRF-Token。
 * 3. 修正登录请求URL为 /login，而不是 /api/login。
 * 4. 修正登录请求体，加入加密后的密码和Token。
 * 5. 修正登录响应处理逻辑，解析JSON判断成功或失败。
 * 6. 增强了错误提示，能更清晰地反馈登录失败原因。
 * =================================================
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

// ★ 新增：内置SHA256加密函数 ，移除对外部CryptoJS的依赖
const sha256 = (function(){
  function rightRotate(value, amount) {
    return (value>>>amount) | (value<<(32 - amount));
  };

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  return function(message) {
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    message += String.fromCharCode(0x80);
    let l = message.length/4 + 2;
    let N = Math.ceil(l/16);
    let M = new Array(N);

    for (let i=0; i<N; i++) {
      M[i] = new Array(16);
      for (let j=0; j<16; j++) {
        M[i][j] = (message.charCodeAt(i*64+j*4)<<24) | (message.charCodeAt(i*64+j*4+1)<<16) | (message.charCodeAt(i*64+j*4+2)<<8) | (message.charCodeAt(i*64+j*4+3));
      }
    }
    
    M[N-1][14] = ((message.length-1)*8) / Math.pow(2, 32); M[N-1][14] = Math.floor(M[N-1][14]);
    M[N-1][15] = ((message.length-1)*8) & 0xffffffff;

    for (let i=0; i<N; i++) {
      let W = new Array(64);
      for (let t=0; t<16; t++) W[t] = M[i][t];
      for (let t=16; t<64; t++) W[t] = (((rightRotate(W[t-2], 17) ^ rightRotate(W[t-2], 19) ^ (W[t-2]>>>10)) + W[t-7] + (rightRotate(W[t-15], 7) ^ rightRotate(W[t-15], 18) ^ (W[t-15]>>>3)) + W[t-16]) & 0xffffffff);

      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

      for (let t=0; t<64; t++) {
        let T1 = h + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e&f)^(~e&g)) + K[t] + W[t];
        let T2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a&b)^(a&c)^(b&c));
        h = g; g = f; f = e; e = (d + T1) & 0xffffffff; d = c; c = b; b = a; a = (T1 + T2) & 0xffffffff;
      }
      H[0] = (H[0] + a) & 0xffffffff; H[1] = (H[1] + b) & 0xffffffff; H[2] = (H[2] + c) & 0xffffffff; H[3] = (H[3] + d) & 0xffffffff;
      H[4] = (H[4] + e) & 0xffffffff; H[5] = (H[5] + f) & 0xffffffff; H[6] = (H[6] + g) & 0xffffffff; H[7] = (H[7] + h) & 0xffffffff;
    }

    return H.map(function (val) {
      return ('00000000' + val.toString(16)).slice(-8);
    }).join('');
  };
})();


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

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★  ↓↓↓  以下是经过修正的核心登录函数 loginAndGetCookie  ↓↓↓  ★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function loginAndGetCookie(account) {
  console.log(`尝试使用账号 ${account.name} (${account.username}) 登录...`);
  
  try {
    // 第一步：访问登录页面获取初始Cookie和Token
    const loginPageResponse = await $fetch.get(`${appConfig.site}/login`, {
      headers: { 'User-Agent': UA },
      redirect: 'follow'
    });
    
    const initialCookie = extractCookieFromHeaders(loginPageResponse.headers);
    const loginPageHtml = getHtmlFromResponse(loginPageResponse);
    const $loginPage = cheerio.load(loginPageHtml);
    const token = $loginPage('#token').val();

    if (!token) {
      throw new Error('未能获取登录Token，页面可能已变更');
    }
    console.log(`成功获取Token`);

    // 第二步：对密码进行SHA256加密
    const encryptedPassword = sha256(account.password);

    // 第三步：构建并提交登录表单
    const loginData = new URLSearchParams({
      username: account.username,
      password: encryptedPassword,
      rememberMe: 'true',
      token: token,
      type: '10' // 账号密码登录类型
    }).toString();
    
    const loginResponse = await $fetch.post(`${appConfig.site}/login`, {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': initialCookie || '',
        'Referer': `${appConfig.site}/login`,
        'Origin': appConfig.site,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: loginData
    });
    
    // 第四步：解析登录响应
    const loginResult = JSON.parse(getHtmlFromResponse(loginResponse));

    if (loginResult.success !== "true") {
      let errorMsg = "未知错误";
      if (loginResult.error) {
        errorMsg = Object.values(loginResult.error).join(', ');
      }
      if (loginResult.captchaKey) {
          errorMsg += " (需要验证码，脚本暂不支持)";
      }
      throw new Error(`登录失败: ${errorMsg}`);
    }

    // 第五步：提取并验证最终的Cookie
    const finalCookie = extractCookieFromHeaders(loginResponse.headers) || initialCookie;
    
    if (!finalCookie) {
      throw new Error('登录成功，但未能获取最终Cookie');
    }
    
    // (可选但推荐) 验证Cookie是否有效
    const testResponse = await $fetch.get(`${appConfig.site}/`, {
      headers: { 'User-Agent': UA, 'Cookie': finalCookie }
    });
    const testHtml = getHtmlFromResponse(testResponse);
    if (testHtml.includes('登录') && !testHtml.includes('退出')) {
      throw new Error('登录看似成功，但Cookie验证无效');
    }
    
    console.log(`账号 ${account.name} 登录成功！`);
    
    cookieCache = {
      value: finalCookie,
      expireTime: Date.now() + 30 * 60 * 1000,
      accountIndex: ACCOUNTS.indexOf(account)
    };
    
    return finalCookie;
    
  } catch (e) {
    // 使用 e.message 来获取更详细的错误信息
    console.error(`账号 ${account.name} 登录失败:`, e.message || e);
    return null;
  }
}
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★  ↑↑↑  以上是经过修正的核心登录函数 loginAndGetCookie  ↑↑↑  ★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★


// 获取有效Cookie（自动登录）
async function getValidCookie() {
  // 检查缓存的Cookie是否还有效
  if (cookieCache.value && Date.now() < cookieCache.expireTime) {
    console.log('使用缓存的Cookie');
    return cookieCache.value;
  }
  
  // Cookie过期或不存在，尝试登录
  console.log('Cookie已过期或不存在，准备重新登录...');
  
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

    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://' );
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
      href = href.replace('http://', 'https://' );
      let trackName = $el.text().trim() || pageTitle;
      tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    });

    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<>  ）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://' );
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
            vod_remarks: '请检查账号密码或网络',
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
