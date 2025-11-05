/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v39 (稳定改进版)
 *
 * 核心策略:
 * 1. 基于V35的稳定架构（分类列表已验证可用）
 * 2. 为搜索功能添加Cookie支持
 * 3. 移除所有可能导致崩溃的复杂逻辑（心跳、缓存等）
 * 4. 保持最简单可靠的实现
 * =================================================================
 */

const cheerio = createCheerio(); 

// --- 全局配置 ---
const UA = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36";

// ★★★ 搜索功能专用Cookie（从浏览器复制） ★★★
const SEARCH_COOKIE = 'JSESSIONID=269EC54DE80DED533FEF79E49CA11641; cms_token=e35b5a9313314aa4a923a12abe5068e2; cf_clearance=RgUzf3d4rwnhD7mH3Y0Y.74wV2lo60wKZ2Swya2HJjQ-1762315496-1.2.1.1-awc_spWMZ_cmqjkmp2EBKqJvqatxyzrGU1M_MQEZi87g540gRxsv92X7I4pp5mqYIju2OleiDMUWxP5CMy8u.PDL9dzj8Ciq3iSUWa.8enzVBRGn6Go_G8vBd5gBH18ROpesZhK3AQySL2BP4EiRFLSpTDR35NAnKBKjR9KMunlTv.e72L.uq5_br6d2HRqdnXo9U2gSYHVT8ISZpH_s4X0RkBk_tYKLaZMJCvi8xAU; cms_accessToken=939897faef1d402fa90901fdde04b916; cms_refreshToken=5e056766fe144c37887d11c8320e8d6b';

const appConfig = {
  ver: 39.0,
  title: '雷鲸 (稳定版)',
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

// --- 播放器接口函数 ---

async function init(cfg) {
  // 极简初始化，不做任何网络请求
  console.log("雷鲸V39稳定版已加载");
}

async function getConfig() {
  return jsonify(appConfig);
}

// --- 搜索功能 (需要Cookie) ---
async function search(ext) {
  ext = argsify(ext);
  
  // Cookie验证
  if (!SEARCH_COOKIE || SEARCH_COOKIE.length < 100 || !SEARCH_COOKIE.includes('JSESSIONID')) {
    return jsonify({
      list: [{
        vod_id: 'no_cookie',
        vod_name: '⚠️ 需要配置搜索Cookie',
        vod_remarks: '请编辑脚本填入SEARCH_COOKIE',
        vod_pic: ''
      }]
    });
  }

  try {
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const requestUrl = `${appConfig.site}/search?keyword=${text}&page=${page}`;

    const htmlData = await $fetch.get(requestUrl, {
      headers: {
        'User-Agent': UA,
        'Cookie': SEARCH_COOKIE,
        'Referer': appConfig.site + '/',
      }
    });

    // 快速失败检测
    if (!htmlData || typeof htmlData !== 'string' || htmlData.length < 200) {
      return jsonify({
        list: [{
          vod_id: 'empty',
          vod_name: '⚠️ 服务器无响应',
          vod_remarks: '请检查网络连接'
        }]
      });
    }

    const $ = cheerio.load(htmlData);
    const pageTitle = $('title').text();

    // Cloudflare拦截检测
    if (htmlData.includes('Just a moment') || 
        htmlData.includes('Checking your browser') ||
        htmlData.includes('cf-browser-verification')) {
      return jsonify({
        list: [{
          vod_id: 'cloudflare',
          vod_name: '⚠️ Cloudflare拦截',
          vod_remarks: 'cf_clearance已过期，请更新Cookie',
          vod_pic: ''
        }]
      });
    }

    // 登录检测
    if (pageTitle.includes('登录') || pageTitle.includes('Login')) {
      return jsonify({
        list: [{
          vod_id: 'login',
          vod_name: '⚠️ Cookie已失效',
          vod_remarks: '请从浏览器获取新的Cookie',
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
      
      // 过滤非视频内容
      if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) {
        return;
      }
      
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '',
        vod_remarks: tag,
        ext: { url: `${appConfig.site}/${href}` }
      });
    });

    // 无结果处理
    if (cards.length === 0 && htmlData.includes('没有找到')) {
      return jsonify({
        list: [{
          vod_id: 'no_result',
          vod_name: '🔍 未找到结果',
          vod_remarks: '尝试其他关键词'
        }]
      });
    }

    return jsonify({ list: cards });

  } catch (e) {
    return jsonify({
      list: [{
        vod_id: 'error',
        vod_name: '⚠️ 搜索失败',
        vod_remarks: e.message || '请求异常'
      }]
    });
  }
}

// --- 分类列表 (不需要Cookie，V35已验证可用) ---
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  try {
    const requestUrl = `${appConfig.site}/${id}&page=${page}`;
    
    // 分类页面不需要Cookie
    const htmlData = await $fetch.get(requestUrl, { 
      headers: { 'User-Agent': UA } 
    });

    if (!htmlData || typeof htmlData !== 'string' || htmlData.length < 200) {
      return jsonify({ list: [] });
    }

    const $ = cheerio.load(htmlData);

    $('.topicItem').each((_, each) => {
      // 跳过需要权限的内容
      if ($(each).find('.cms-lock-solid').length > 0) {
        return;
      }
      
      const href = $(each).find('h2 a').attr('href');
      const title = $(each).find('h2 a').text();
      const tag = $(each).find('.tag').text();
      
      // 过滤非视频内容
      if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) {
        return;
      }
      
      // 提取剧名（去除多余标记）
      const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
      const match = title.match(regex);
      const dramaName = match ? match[1] : title;
      
      cards.push({
        vod_id: href,
        vod_name: dramaName,
        vod_pic: '',
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` }
      });
    });
    
    return jsonify({ list: cards });
    
  } catch (e) {
    console.error('获取分类失败:', e.message);
    return jsonify({ list: [] });
  }
}

// --- 播放信息（占位函数） ---
async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

// --- 网盘链接提取辅助函数 ---
function getProtocolAgnosticUrl(rawUrl) {
  if (!rawUrl) return null;
  const cleaned = rawUrl.replace(/（访问码[:：\uff1a][a-zA-Z0-9]{4,6}）/g, '');
  const match = cleaned.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
  return match ? match[0] : null;
}

// --- 详情页网盘链接获取 ---
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();

  try {
    const requestUrl = ext.url;
    const htmlData = await $fetch.get(requestUrl, { 
      headers: { 'User-Agent': UA } 
    });
    
    if (!htmlData || typeof htmlData !== 'string') {
      return jsonify({ list: [] });
    }

    const $ = cheerio.load(htmlData);
    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    // 方式1: 精确匹配（URL + 访问码）
    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      
      tracks.push({ 
        name: pageTitle, 
        pan: panUrl, 
        ext: { accessCode: '' } 
      });
      
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    // 方式2: 提取<a>标签中的链接
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const $el = $(el);
      let href = $el.attr('href');
      if (!href) return;
      
      let agnosticUrl = getProtocolAgnosticUrl(href);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) return;
      
      href = href.replace('http://', 'https://');
      let trackName = $el.text().trim() || pageTitle;
      
      tracks.push({ 
        name: trackName, 
        pan: href, 
        ext: { accessCode: '' } 
      });
      
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    });

    // 方式3: 正则提取所有天翼云盘URL
    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<>）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let accessCode = '';
      
      // 尝试提取附近的访问码
      const codeMatch = bodyText.slice(match.index, match.index + 100)
        .match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/);
      if (codeMatch) accessCode = codeMatch[1];
      
      panUrl = panUrl.trim().replace(/[）\)]+$/, '');
      if (accessCode) panUrl = `${panUrl}（访问码：${accessCode}）`;
      
      const agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      
      tracks.push({ 
        name: pageTitle, 
        pan: panUrl, 
        ext: { accessCode: '' } 
      });
      
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    return tracks.length > 0
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    console.error('获取详情页失败:', e.message);
    return jsonify({
      list: [{
        title: '错误',
        tracks: [{ 
          name: '加载失败: ' + e.message, 
          pan: 'about:blank' 
        }]
      }]
    });
  }
}
