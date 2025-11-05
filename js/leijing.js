/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v38 (稳定自动续期版)
 *
 * 核心改进:
 * 1. 简化Cookie管理,避免V37.1的过度处理
 * 2. 保留自动续期能力,但采用更稳定的实现
 * 3. 优先使用内存缓存,减少对播放器缓存API的依赖
 * 4. 详细的错误诊断,方便排查问题
 * =================================================================
 */

const cheerio = createCheerio(); 

// --- 全局配置 ---
const UA = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36";

// ★★★ 在这里粘贴您的最新Cookie ★★★
const INITIAL_COOKIE = 'JSESSIONID=269EC54DE80DED533FEF79E49CA11641; cms_token=e35b5a9313314aa4a923a12abe5068e2; cf_clearance=RgUzf3d4rwnhD7mH3Y0Y.74wV2lo60wKZ2Swya2HJjQ-1762315496-1.2.1.1-awc_spWMZ_cmqjkmp2EBKqJvqatxyzrGU1M_MQEZi87g540gRxsv92X7I4pp5mqYIju2OleiDMUWxP5CMy8u.PDL9dzj8Ciq3iSUWa.8enzVBRGn6Go_G8vBd5gBH18ROpesZhK3AQySL2BP4EiRFLSpTDR35NAnKBKjR9KMunlTv.e72L.uq5_br6d2HRqdnXo9U2gSYHVT8ISZpH_s4X0RkBk_tYKLaZMJCvi8xAU; cms_accessToken=939897faef1d402fa90901fdde04b916; cms_refreshToken=5e056766fe144c37887d11c8320e8d6b';

const appConfig = {
  ver: 38.0,
  title: '雷鲸 (稳定续期版)',
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

// --- Cookie管理 (简化版) ---

// 使用内存变量作为主存储,播放器缓存作为备份
let runtimeCookie = INITIAL_COOKIE;
let lastHeartbeat = 0;
const HEARTBEAT_INTERVAL = 30 * 60 * 1000; // 30分钟

// 获取当前Cookie (优先内存,其次缓存)
function getCookie() {
  if (runtimeCookie && runtimeCookie.length > 100) {
    return runtimeCookie;
  }
  
  // 尝试从播放器缓存恢复
  try {
    const cached = $.getCache('leijing_cookie_v38');
    if (cached && cached.length > 100) {
      runtimeCookie = cached;
      return cached;
    }
  } catch (e) {
    console.log('缓存读取失败,使用初始Cookie');
  }
  
  return INITIAL_COOKIE;
}

// 更新Cookie (提取新token,保留原有结构)
function updateCookie(newCookieStr) {
  if (!newCookieStr || newCookieStr.length < 20) {
    console.log('新Cookie无效,保持原有Cookie');
    return;
  }
  
  try {
    // 提取新的关键字段
    const newTokens = {};
    newCookieStr.split(';').forEach(part => {
      const trimmed = part.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex);
        const value = trimmed.substring(eqIndex + 1);
        // 只更新这些关键字段
        if (['cms_token', 'cms_accessToken', 'cms_refreshToken', 'JSESSIONID'].includes(key)) {
          newTokens[key] = value;
        }
      }
    });
    
    // 如果提取到新token,更新现有Cookie
    if (Object.keys(newTokens).length > 0) {
      const current = getCookie();
      let updated = current;
      
      for (const [key, value] of Object.entries(newTokens)) {
        const regex = new RegExp(`${key}=[^;]*`, 'g');
        if (updated.includes(key)) {
          updated = updated.replace(regex, `${key}=${value}`);
        } else {
          updated += `; ${key}=${value}`;
        }
      }
      
      runtimeCookie = updated;
      
      // 尝试保存到缓存(失败不影响运行)
      try {
        $.setCache('leijing_cookie_v38', updated);
      } catch (e) {
        console.log('缓存保存失败,但内存Cookie已更新');
      }
      
      console.log(`✓ Cookie已自动更新 (更新了${Object.keys(newTokens).length}个字段)`);
    }
  } catch (e) {
    console.error('Cookie更新失败:', e.message);
  }
}

// 心跳请求 (轻量级,只在需要时执行)
async function tryHeartbeat() {
  const now = Date.now();
  
  // 距离上次心跳不足间隔时间,跳过
  if (now - lastHeartbeat < HEARTBEAT_INTERVAL) {
    return;
  }
  
  lastHeartbeat = now;
  const currentCookie = getCookie();
  
  try {
    const url = `${appConfig.site}/user/control/unreadMessageCount?t=${now}`;
    const response = await $fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Cookie': currentCookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${appConfig.site}/index`
      }
    });
    
    // 尝试提取Set-Cookie (如果环境支持)
    if (response && typeof response === 'object') {
      const setCookie = response.headers?.['set-cookie'] || response.headers?.['Set-Cookie'];
      if (setCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
        updateCookie(cookieStr);
      }
    }
    
    console.log('✓ 心跳成功');
  } catch (e) {
    console.log('心跳请求失败(不影响使用):', e.message);
  }
}

// --- 播放器接口函数 ---

async function init(cfg) {
  console.log('雷鲸V38已加载 - 稳定自动续期版');
  console.log('初始Cookie长度:', INITIAL_COOKIE.length);
  
  // 初始化时执行一次心跳
  setTimeout(tryHeartbeat, 2000);
}

async function getConfig() {
  return jsonify(appConfig);
}

async function search(ext) {
  ext = argsify(ext);
  const currentCookie = getCookie();

  // Cookie基础验证
  if (!currentCookie || currentCookie.length < 100) {
    return jsonify({
      list: [{
        vod_id: 'cookie_error',
        vod_name: '错误: Cookie未配置',
        vod_remarks: '请编辑脚本填入INITIAL_COOKIE'
      }]
    });
  }

  try {
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const requestUrl = `${appConfig.site}/search?keyword=${text}&page=${page}`;

    console.log(`搜索: "${ext.text}" (第${page}页)`);
    console.log('使用Cookie长度:', currentCookie.length);

    const htmlData = await $fetch.get(requestUrl, {
      headers: {
        'User-Agent': UA,
        'Cookie': currentCookie,
        'Referer': appConfig.site + '/',
      }
    });

    // 触发心跳 (异步执行,不阻塞搜索结果)
    tryHeartbeat().catch(e => {});

    const $ = cheerio.load(htmlData);
    const pageTitle = $('title').text();
    
    // 详细的错误诊断
    if (pageTitle.includes('登录') || pageTitle.includes('Login')) {
      return jsonify({
        list: [{
          vod_id: 'need_login',
          vod_name: '⚠️ Cookie已失效',
          vod_remarks: '请更新INITIAL_COOKIE',
          vod_pic: '',
          ext: { debug: `页面标题: ${pageTitle}` }
        }]
      });
    }

    if (htmlData.includes('Just a moment') || htmlData.includes('Checking your browser')) {
      return jsonify({
        list: [{
          vod_id: 'cloudflare',
          vod_name: '⚠️ Cloudflare验证',
          vod_remarks: '请在浏览器中重新获取Cookie',
          vod_pic: ''
        }]
      });
    }

    // 解析搜索结果
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
        ext: { url: `${appConfig.site}/${href}` }
      });
    });

    if (cards.length === 0) {
      // 检查是否是真的没结果
      if ($('.topicItem').length === 0 && !htmlData.includes('没有找到') && htmlData.length < 5000) {
        return jsonify({
          list: [{
            vod_id: 'page_error',
            vod_name: '⚠️ 页面异常',
            vod_remarks: `页面长度:${htmlData.length}, 标题:${pageTitle.substring(0,30)}`,
            vod_pic: ''
          }]
        });
      }
    }

    console.log(`✓ 找到${cards.length}个结果`);
    return jsonify({ list: cards });

  } catch (e) {
    console.error('搜索异常:', e);
    return jsonify({
      list: [{
        vod_id: 'exception',
        vod_name: '搜索失败',
        vod_remarks: e.message,
        vod_pic: ''
      }]
    });
  }
}

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
    const tag = $(each).find('.tag').text();
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` }
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
    const htmlData = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(htmlData);

    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    // 精确匹配: URL + 访问码
    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    // 链接标签提取
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

    // 通用URL模式
    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<>）)]+/g;
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
        tracks: [{ name: '加载失败: ' + e.message, pan: 'about:blank' }]
      }]
    });
  }
}
