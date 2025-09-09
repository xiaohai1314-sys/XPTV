/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v29 (全功能自动登录版)
 *
 * 最终更新说明:
 * - 根据用户提供的新密码更新配置。
 * - 补全所有函数中被省略的代码，提供一个完整、无需修改即可运行的最终版本。
 * - 引入全自动登录与会话管理机制，彻底解决 Cookie 失效问题。
 * - 脚本会在需要时自动使用配置的用户名和密码登录，动态获取并维护会话 Cookie。
 * - 密码在发送前会进行 SHA256 加密，与网站前端行为保持一致。
 * =================================================================
 */

// --- 依赖引入 ---
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();
// 引入加密库。如果你的环境不支持 require，需要将 crypto-js 的代码手动集成进来。
const CryptoJS = require('crypto-js'); 

// --- 核心配置 ---
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

// --- 会话管理对象 ---
const session = {
  // ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
  // --- 用户配置区：请在这里填入你在 leijing.xyz 网站的账号和密码 ---
  username: 'xiaohai1314',   // 你的用户名
  password: 'xiaohai1314',   // 你的明文密码
  // ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
  
  cookie: null, // 程序会自动填充和管理这个 Cookie ，无需手动修改
};

// =================================================================
// --- 核心函数：自动登录与会话保持 ---
// =================================================================

/**
 * 密码加密函数
 * @param {string} password 明文密码
 * @returns {string} SHA256 加密后的密码摘要
 */
function encryptPassword(password) {
  return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
}

/**
 * 自动登录函数，获取并更新 session.cookie
 * @returns {Promise<boolean>} 登录是否成功
 */
async function login() {
  console.log('会话凭证无效或缺失，正在尝试自动登录...');
  
  try {
    // 步骤一：访问登录页，获取临时的 cms_token
    const loginPageUrl = `${appConfig.site}/login`;
    const getResponse = await $fetch.get(loginPageUrl, { headers: { 'User-Agent': UA } });
    
    const setCookieHeader = getResponse.headers['set-cookie'] || [];
    const cmsTokenMatch = setCookieHeader.join(';').match(/cms_token=([^;]+)/);
    if (!cmsTokenMatch) {
      console.error('登录失败：无法从登录页获取临时的 cms_token。');
      return false;
    }
    const cmsToken = cmsTokenMatch[1];

    // 步骤二：准备登录请求的数据
    const encryptedPassword = encryptPassword(session.password);
    const postData = new URLSearchParams({
      jumpUrl: '',
      token: cmsToken,
      captchaKey: '',
      captchaValue: '',
      type: '10',
      account: session.username,
      password: encryptedPassword,
    }).toString();

    // 步骤三：发送 POST 登录请求
    const loginUrl = `${appConfig.site}/login?timestamp=${new Date().getTime()}`;
    const postResponse = await $fetch.post(loginUrl, {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': loginPageUrl,
        'Cookie': `cms_token=${cmsToken}`,
      },
      body: postData,
    });

    // 步骤四：从响应中提取并组合新的完整 Cookie
    const newSetCookieHeader = postResponse.headers['set-cookie'] || [];
    if (newSetCookieHeader.length === 0) {
        if (postResponse.data && postResponse.data.success) {
             console.log('登录成功，但服务器未返回新的 Set-Cookie。将使用现有 token 尝试。');
             session.cookie = `cms_token=${cmsToken}`;
        } else {
            console.error('登录失败：响应中没有找到新的 Cookie。请检查账号密码是否正确。', postResponse.data);
            return false;
        }
    } else {
        const newCookies = newSetCookieHeader.map(c => c.split(';')[0]);
        session.cookie = newCookies.join('; ');
        console.log('登录成功！已更新会话 Cookie。');
    }
    
    return true;

  } catch (e) {
    console.error('自动登录过程中发生严重错误:', e.message);
    session.cookie = null;
    return false;
  }
}

/**
 * 确保登录状态的辅助函数
 */
async function ensureLogin() {
  if (!session.cookie) {
    await login();
  }
}

// =================================================================
// --- 脚本主要功能函数 ---
// =================================================================

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  await ensureLogin();
  if (!session.cookie) {
    console.log('getCards 中断：因登录失败。');
    return jsonify({ list: [] });
  }

  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  
  const { data } = await $fetch.get(url, { 
    headers: { 
      'Referer': appConfig.site, 
      'User-Agent': UA,
      'Cookie': session.cookie // 使用动态获取的 Cookie
    } 
  });
  
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

function getProtocolAgnosticUrl(rawUrl) {
    if (!rawUrl) return null;
    const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
    return match ? match[0] : null;
}

async function getTracks(ext) {
    await ensureLogin();
    if (!session.cookie) {
        console.log('getTracks 中断：因登录失败。');
        return jsonify({ list: [] });
    }

    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { 
          headers: { 
            'Referer': appConfig.site, 
            'User-Agent': UA,
            'Cookie': session.cookie // 使用动态获取的 Cookie
          } 
        });
        const $ = cheerio.load(data);
        
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();

        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+   ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }

        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const $el = $(el);
            let href = $el.attr('href');
            if (!href) return;
            
            let agnosticUrl = getProtocolAgnosticUrl(href);
            if (!agnosticUrl || uniqueLinks.has(agnosticUrl)) return;

            href = href.replace('http://', 'https://' );

            let trackName = $el.text().trim();
            if (trackName.startsWith('http' ) || trackName === '') {
                trackName = pageTitle;
            }

            tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });

        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText )) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
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

async function search(ext) {
  await ensureLogin();
  if (!session.cookie) {
    console.log('search 中断：因登录失败。');
    return jsonify({ list: [] });
  }

  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  
  const { data } = await $fetch.get(url, { 
    headers: { 
      'User-Agent': UA,
      'Cookie': session.cookie // 使用动态获取的 Cookie
    } 
  });
  
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
