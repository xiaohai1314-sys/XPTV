/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v37 (最终开箱即用版)
 *
 * 更新说明:
 * - 已预置有效的初始Cookie，实现开箱即用。
 * - 实现了Cookie/AccessToken的全自动续期，理论上一次配置，长期有效。
 * - 利用对 unreadMessageCount 接口的定时心跳请求来触发会话刷新。
 * - 脚本会自动捕获并更新返回的新Cookie，并进行持久化存储。
 * - 搜索和分类功能使用动态更新的Cookie，告别频繁手动操作。
 * =================================================================
 */

// 播放器环境提供的基础函数/对象 (假设存在)
const cheerio = createCheerio(); 

// --- 全局配置 ---
const UA = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36";
const CACHE_KEY = 'leijing_cookie_cache_v37'; // 使用新版本键，避免旧缓存冲突
const HEARTBEAT_INTERVAL = 30 * 60 * 1000; // 心跳间隔: 30分钟

const appConfig = {
  ver: 37,
  title: '雷鲸 (自动续期)',
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

// --- Cookie 核心管理模块 ---

// ★★★ 已为您预置刚登陆的有效Cookie ★★★
const INITIAL_COOKIE = 'JSESSIONID=269EC54DE80DED533FEF79E49CA11641; cms_token=e35b5a9313314aa4a923a12abe5068e2; cf_clearance=y0BwQ5UFmSg.UeFgjkjJGm3Vk5SmiA9l6D5DLZ5WRac-1762314331-1.2.1.1-1qADCgffCIYqg_GMxL9CTgVLKzWJ0M.MD4XEWsoq0C.q70Z6wypUcfqhF6aCswLiIrdHc41mzzoww55v9nkqtzMeK9Qnlrc.Wxx.opMKHEoGORrQXL5iUMk7nf2WrXDPWm1LqL6_YPw9BvYQqe3DjZK4kzrN5zYUZ2zLXMq5CIVSgSNOdXlL_2AffeyjXA61vS_KySK1W6Ese3psQTQFyxQb_gIzdTFV4E7CMvvGqxI; cms_accessToken=3e9aaf41f7f74ce18a22f70faf6b6209; cms_refreshToken=95c0c2009d1446958d988fc6d020ed10';

// 获取当前有效的Cookie
function getCookie( ) {
  let cachedCookie = $.getCache(CACHE_KEY);
  if (cachedCookie) {
    return cachedCookie;
  }
  if (INITIAL_COOKIE.includes('cms_refreshToken')) {
    $.setCache(CACHE_KEY, INITIAL_COOKIE);
    return INITIAL_COOKIE;
  }
  return '';
}

// 更新Cookie (合并旧的和新的)
function updateCookie(newCookieParts) {
  let currentCookie = getCookie();
  const cookieMap = new Map();

  currentCookie.split(';').forEach(part => {
    const eqIndex = part.indexOf('=');
    if (eqIndex > -1) {
      const key = part.substring(0, eqIndex).trim();
      const value = part.substring(eqIndex + 1).trim();
      if (key) cookieMap.set(key, value);
    }
  });

  newCookieParts.forEach(part => {
    const eqIndex = part.indexOf('=');
    const semiIndex = part.indexOf(';');
    if (eqIndex > -1) {
      const key = part.substring(0, eqIndex).trim();
      const value = part.substring(eqIndex + 1, semiIndex > -1 ? semiIndex : undefined).trim();
      if (key) cookieMap.set(key, value);
    }
  });

  const updatedCookie = Array.from(cookieMap.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
  
  $.setCache(CACHE_KEY, updatedCookie);
  console.log('雷鲸Cookie已通过心跳自动更新！');
  return updatedCookie;
}

// 心跳函数，用于自动刷新会话
async function heartbeat() {
  const currentCookie = getCookie();
  if (!currentCookie || !currentCookie.includes('cms_refreshToken')) {
    console.log('雷鲸脚本：缺少 refreshToken，无法执行心跳任务。');
    return;
  }

  try {
    const url = `${appConfig.site}/user/control/unreadMessageCount?timestamp=${new Date().getTime()}`;
    // 注意：$fetch需要能返回完整的response对象，包括headers
    const response = await $fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Cookie': currentCookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${appConfig.site}/index`,
      }
    });

    const newCookieHeaders = response.headers['set-cookie'] || response.headers['Set-Cookie'];
    if (newCookieHeaders && newCookieHeaders.length > 0) {
      updateCookie(Array.isArray(newCookieHeaders) ? newCookieHeaders : [newCookieHeaders]);
    } else {
      console.log('雷鲸心跳成功，Cookie无需更新。');
    }
  } catch (e) {
    console.error('雷鲸心跳请求失败:', e.message);
  }
}

// --- 脚本主入口和生命周期 ---
async function init(cfg) {
  console.log('雷鲸自动续期脚本初始化...');
  await heartbeat(); // 立即执行一次心跳
  setInterval(heartbeat, HEARTBEAT_INTERVAL); // 设置定时心跳
}

// --- 播放器接口函数 ---
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
    const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const htmlData = getHtmlFromResponse(response);
    const $ = cheerio.load(htmlData);

    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+   ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
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

    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<> ）)]+/g;
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
    return jsonify({ list: [{ title: '错误', tracks: [{ name: '加载失败', pan: 'about:blank' }] }] });
  }
}

async function search(ext) {
  ext = argsify(ext);
  const currentCookie = getCookie();

  if (!currentCookie) {
      return jsonify({ list: [{ vod_id: 'no_cookie', vod_name: '错误：Cookie未初始化', vod_remarks: '请检查脚本配置' }] });
  }

  try {
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const requestUrl = `${appConfig.site}/search?keyword=${text}&page=${page}`;

    const response = await $fetch(requestUrl, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Cookie': currentCookie,
        'Referer': appConfig.site + '/',
      }
    });
    
    const newCookieHeaders = response.headers['set-cookie'] || response.headers['Set-Cookie'];
    if (newCookieHeaders && newCookieHeaders.length > 0) {
      updateCookie(Array.isArray(newCookieHeaders) ? newCookieHeaders : [newCookieHeaders]);
    }

    const htmlData = getHtmlFromResponse(response);
    const $ = cheerio.load(htmlData);

    if ($('title').text().includes('登录')) {
        return jsonify({ list: [{ vod_id: 'login_required', vod_name: '登录失效', vod_remarks: '自动续期失败，请尝试重启或更新初始Cookie' }] });
    }

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
    return jsonify({ list: [] });
  }
}
