/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v37.1 (最新Cookie测试版)
 *
 * 更新说明:
 * - 严格按照您的要求，集成了您最新提供的、刚登陆的Cookie。
 * - 所有自动续期逻辑保持不变，核心是测试初始请求的成功率。
 * - 如果此版本首次搜索仍然失败，则可100%确定问题在于Cloudflare验证，
 *   而非Cookie本身的新鲜度。
 * =================================================================
 */

// 播放器环境提供的基础函数/对象
const cheerio = createCheerio(); 

// --- 全局配置 ---
const UA = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36";
const CACHE_KEY = 'leijing_cookie_cache_v37_test2'; // 使用新的缓存键
const HEARTBEAT_INTERVAL = 30 * 60 * 1000;

const appConfig = {
  ver: 37.1,
  title: '雷鲸 (最新Cookie测试)',
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

// ★★★ 已为您集成最新提供的、刚登陆的Cookie ★★★
const INITIAL_COOKIE = 'JSESSIONID=269EC54DE80DED533FEF79E49CA11641; cms_token=e35b5a9313314aa4a923a12abe5068e2; cf_clearance=RgUzf3d4rwnhD7mH3Y0Y.74wV2lo60wKZ2Swya2HJjQ-1762315496-1.2.1.1-awc_spWMZ_cmqjkmp2EBKqJvqatxyzrGU1M_MQEZi87g540gRxsv92X7I4pp5mqYIju2OleiDMUWxP5CMy8u.PDL9dzj8Ciq3iSUWa.8enzVBRGn6Go_G8vBd5gBH18ROpesZhK3AQySL2BP4EiRFLSpTDR35NAnKBKjR9KMunlTv.e72L.uq5_br6d2HRqdnXo9U2gSYHVT8ISZpH_s4X0RkBk_tYKLaZMJCvi8xAU; cms_accessToken=939897faef1d402fa90901fdde04b916; cms_refreshToken=5e056766fe144c37887d11c8320e8d6b';

// (getCookie, updateCookie, heartbeat, init 等函数与v37版本完全相同 ，此处为完整性而保留)

function getCookie() {
  let cachedCookie = $.getCache(CACHE_KEY);
  if (cachedCookie) return cachedCookie;
  if (INITIAL_COOKIE.includes('cms_refreshToken')) {
    $.setCache(CACHE_KEY, INITIAL_COOKIE);
    return INITIAL_COOKIE;
  }
  return '';
}

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
  const updatedCookie = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  $.setCache(CACHE_KEY, updatedCookie);
  console.log('雷鲸Cookie已通过心跳自动更新！');
  return updatedCookie;
}

async function heartbeat() {
  const currentCookie = getCookie();
  if (!currentCookie) return;
  try {
    const url = `${appConfig.site}/user/control/unreadMessageCount?timestamp=${new Date().getTime()}`;
    const response = await $fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, 'Cookie': currentCookie, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `${appConfig.site}/index` }
    });
    const newCookieHeaders = response.headers['set-cookie'] || response.headers['Set-Cookie'];
    if (newCookieHeaders && newCookieHeaders.length > 0) {
      updateCookie(Array.isArray(newCookieHeaders) ? newCookieHeaders : [newCookieHeaders]);
    }
  } catch (e) {
    console.error('雷鲸心跳请求失败:', e.message);
  }
}

async function init(cfg) {
  console.log('雷鲸最新Cookie测试版(v37.1)已加载...');
  await heartbeat();
  setInterval(heartbeat, HEARTBEAT_INTERVAL);
}

// --- 核心功能函数 ---

async function getConfig() { return jsonify(appConfig); }
function getHtmlFromResponse(response) { return (typeof response === 'string') ? response : (response && typeof response.data === 'string' ? response.data : ''); }

async function search(ext) {
  ext = argsify(ext);
  const currentCookie = getCookie();

  if (!currentCookie) {
    return jsonify({ list: [{ vod_id: 'no_cookie', vod_name: '错误：Cookie未初始化' }] });
  }

  try {
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const requestUrl = `${appConfig.site}/search?keyword=${text}&page=${page}`;

    // 发起核心的搜索请求
    const htmlData = await $fetch.get(requestUrl, {
      headers: {
        'User-Agent': UA,
        'Cookie': currentCookie,
        'Referer': appConfig.site + '/',
      }
    });

    const $ = cheerio.load(htmlData);

    if ($('title').text().includes('登录')) {
      return jsonify({ list: [{ vod_id: 'login_required', vod_name: '登录验证失败', vod_remarks: 'Cloudflare验证可能失败，请尝试后端代理方案' }] });
    }
    if (htmlData.includes("Just a moment...")) {
      return jsonify({ list: [{ vod_id: 'cloudflare_block', vod_name: '被Cloudflare拦截', vod_remarks: '请切换到后端代理方案' }] });
    }

    let cards = [];
    $('.topicItem').each((_, el) => {
      const a = $(el).find('h2 a');
      const href = a.attr('href');
      const title = a.text();
      const tag = $(el).find('.tag').text();
      if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
      cards.push({ vod_id: href, vod_name: title, vod_pic: '', vod_remarks: tag, ext: { url: `${appConfig.site}/${href}` } });
    });
    
    if (cards.length === 0 && !htmlData.includes('topicItem')) {
        // 如果页面没有topicItem，可能也是一种失败的标志
        return jsonify({ list: [{ vod_id: 'no_results', vod_name: '未找到结果或页面异常', vod_remarks: '请检查网站或切换方案' }] });
    }

    return jsonify({ list: cards });

  } catch (e) {
    console.error('搜索失败:', e);
    return jsonify({ list: [{ vod_id: 'search_error', vod_name: '搜索请求异常', vod_remarks: e.message }] });
  }
}

// (getCards, getPlayinfo, getTracks 等函数与之前版本相同，此处省略以保持简洁)
// ... 您可以从之前版本复制 getCards, getPlayinfo, getProtocolAgnosticUrl, getTracks ...
// 为保证完整性，我将它们也附在下面

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  const htmlData = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(htmlData);
  $('.topicItem').each((_, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return;
    const href = $(each).find('h2 a').attr('href');
    const title = $(each).find('h2 a').text();
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test($(each).find('.tag').text())) return;
    cards.push({ vod_id: href, vod_name: dramaName, vod_pic: '', vod_remarks: '', ext: { url: `${appConfig.site}/${href}` } });
  });
  return jsonify({ list: cards });
}
async function getPlayinfo(ext) { return jsonify({ urls: [] }); }
function getProtocolAgnosticUrl(rawUrl) { if (!rawUrl) return null; const cleaned = rawUrl.replace(/（访问码[:：\uff1a][a-zA-Z0-9]{4,6}）/g, ''); const match = cleaned.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/); return match ? match[0] : null; }
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();
  try {
    const requestUrl = ext.url;
    const htmlData = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(htmlData);
    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();
    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+   ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) { let panUrl = match[0].replace('http://', 'https://' ); let agnosticUrl = getProtocolAgnosticUrl(panUrl); if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue; tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } }); if (agnosticUrl) uniqueLinks.add(agnosticUrl); }
    $('a[href*="cloud.189.cn"]').each((_, el) => { const $el = $(el); let href = $el.attr('href'); if (!href) return; let agnosticUrl = getProtocolAgnosticUrl(href); if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue; href = href.replace('http://', 'https://' ); let trackName = $el.text().trim() || pageTitle; tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } }); if (agnosticUrl) uniqueLinks.add(agnosticUrl); });
    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<> ）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) { let panUrl = match[0].replace('http://', 'https://' ); let accessCode = ''; const codeMatch = bodyText.slice(match.index, match.index + 100).match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/); if (codeMatch) accessCode = codeMatch[1]; panUrl = panUrl.trim().replace(/[）\)]+$/, ''); if (accessCode) panUrl = `${panUrl}（访问码：${accessCode}）`; const agnosticUrl = getProtocolAgnosticUrl(panUrl); if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue; tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } }); if (agnosticUrl) uniqueLinks.add(agnosticUrl); }
    return tracks.length ? jsonify({ list: [{ title: '天翼云盘', tracks }] }) : jsonify({ list: [] });
  } catch (e) { return jsonify({ list: [{ title: '错误', tracks: [{ name: '加载失败', pan: 'about:blank' }] }] }); }
}

