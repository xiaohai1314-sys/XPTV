/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v28 (免登录优化版)
 *
 * 解决方案说明:
 * 1. 无需提供登录账号密码
 * 2. 智能Cookie获取 - 从首页/公开页面获取基础Cookie
 * 3. 会话保持机制 - 模拟正常浏览器行为
 * 4. 多种降级策略 - 确保在各种情况下都能工作
 * 5. 用户Agent轮换 - 避免被检测为爬虫
 * =================================================================
 */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0"
];

const cheerio = createCheerio();

// 全局状态管理
let sessionState = {
  cookie: null,
  userAgent: null,
  expiry: 0,
  sessionId: null
};

const appConfig = {
  ver: 28,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ]
};

async function getConfig() {
  return jsonify(appConfig);
}

// 生成随机会话ID
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 获取随机User-Agent
function getRandomUserAgent() {
  if (!sessionState.userAgent) {
    sessionState.userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }
  return sessionState.userAgent;
}

// 智能获取Cookie - 无需登录账号
async function getSessionCookie() {
  // 检查缓存的Cookie是否还有效
  if (sessionState.cookie && Date.now() < sessionState.expiry) {
    return sessionState.cookie;
  }

  try {
    console.log('尝试获取新的会话Cookie...');
    
    // 方法1: 访问首页获取基础Cookie
    const response = await $fetch.get(appConfig.site, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // 提取Cookie
    const setCookieHeaders = response.headers['set-cookie'];
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      sessionState.cookie = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
      sessionState.expiry = Date.now() + (20 * 60 * 1000); // 20分钟缓存
      sessionState.sessionId = generateSessionId();
      console.log('成功获取会话Cookie');
      return sessionState.cookie;
    }

    // 方法2: 尝试访问分类页面获取Cookie
    const categoryUrl = `${appConfig.site}/?tagId=42204684250355`;
    const categoryResponse = await $fetch.get(categoryUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Referer': appConfig.site
      }
    });

    const categoryCookies = categoryResponse.headers['set-cookie'];
    if (categoryCookies && categoryCookies.length > 0) {
      sessionState.cookie = categoryCookies.map(cookie => cookie.split(';')[0]).join('; ');
      sessionState.expiry = Date.now() + (15 * 60 * 1000); // 15分钟缓存
      console.log('从分类页面获取到Cookie');
      return sessionState.cookie;
    }

  } catch (e) {
    console.warn('获取Cookie失败:', e.message);
  }

  return null;
}

// 构建请求头
function buildHeaders(url, extraHeaders = {}) {
  const headers = {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    ...extraHeaders
  };

  // 设置合适的Referer
  if (url.includes('/search')) {
    headers['Referer'] = appConfig.site;
  } else if (url !== appConfig.site) {
    headers['Referer'] = appConfig.site;
  }

  return headers;
}

// 智能网络请求 - 无需登录账号
async function smartFetch(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 获取Cookie（如果可能）
      const cookie = await getSessionCookie();
      
      const headers = buildHeaders(url, options.headers || {});
      
      // 如果有Cookie就添加
      if (cookie) {
        headers['Cookie'] = cookie;
      }

      const requestOptions = {
        ...options,
        headers
      };

      console.log(`第${attempt + 1}次请求: ${url}`);
      const response = await $fetch.get(url, requestOptions);
      
      // 检查响应是否正常
      if (response.data) {
        // 检查是否被重定向到登录页面
        if (response.data.includes('location.href') && response.data.includes('login')) {
          throw new Error('被重定向到登录页面');
        }
        
        // 检查是否返回了有效内容
        if (response.data.includes('topicItem') || response.data.includes('search') || url.includes('search')) {
          console.log('请求成功，返回有效内容');
          return response;
        }
      }

      // 如果内容不符合预期，清除Cookie重试
      if (attempt < maxRetries) {
        console.log('内容不符合预期，清除Cookie重试...');
        sessionState.cookie = null;
        sessionState.expiry = 0;
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        continue;
      }

      return response;

    } catch (error) {
      console.warn(`第${attempt + 1}次请求失败:`, error.message);
      
      if (attempt < maxRetries) {
        // 清除可能失效的Cookie和User-Agent
        sessionState.cookie = null;
        sessionState.userAgent = null;
        sessionState.expiry = 0;
        
        // 递增延迟
        await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
      } else {
        // 最后一次尝试：完全无Cookie访问
        if (attempt === maxRetries) {
          console.log('尝试无Cookie访问...');
          try {
            return await $fetch.get(url, {
              headers: buildHeaders(url, options.headers || {})
            });
          } catch (finalError) {
            console.error('所有请求方式都失败了:', finalError.message);
            throw finalError;
          }
        }
      }
    }
  }
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  
  try {
    const { data } = await smartFetch(url);
    const $ = cheerio.load(data);
    
    $('.topicItem').each((index, each) => {
      if ($(each).find('.cms-lock-solid').length > 0) return;
      const href = $(each).find('h2 a').attr('href');
      const title = $(each).find('h2 a').text();
      if (!href || !title) return;
      
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
        vod_remarks: tag || '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    });
    
    console.log(`成功获取${cards.length}个卡片`);
    return jsonify({ list: cards });
    
  } catch (error) {
    console.error('获取卡片列表失败:', error);
    return jsonify({ list: [] });
  }
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
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await smartFetch(url);
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

        // 策略二：<a>标签扫描
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

        // 策略三：纯文本URL扫描
        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://');
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }

        console.log(`提取到${tracks.length}个网盘链接`);
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
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  
  try {
    console.log(`搜索关键词: ${ext.text}, 页码: ${page}`);
    const { data } = await smartFetch(url);
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
        vod_remarks: tag || '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    });
    
    console.log(`搜索成功，找到${cards.length}个结果`);
    return jsonify({ list: cards });
    
  } catch (error) {
    console.error('搜索失败:', error);
    return jsonify({ list: [] });
  }
}
