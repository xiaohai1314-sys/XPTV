const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();
 
const appConfig = {
  ver: 2.1,
  title: '网盘资源社',
  site: 'https://www.wpzysq.com',
  cookie: $env?.COOKIE || 'cookie_test=Gh_2Bfke4QdQEdAGJsZYM5dpa4WBLjlNy8D1XkutgFus5h9alm;bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=26;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%226c0c2ab0-47d6-4c53-a0c1-94866b143a21%22%2C%22vd%22%3A5%2C%22stt%22%3A18%2C%22dr%22%3A1%2C%22expires%22%3A1752370849%2C%22ct%22%3A1752369049%7D;', // 推荐使用环境变量
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm?page=' },
    },
    {
      name: '4K专区',
      ext: { id: 'forum-12.htm?page=' },
    },
    {
      name: '动漫区',
      ext: { id: 'forum-3.htm?page=' },
    },
  ],
};
 
// 网盘识别器（核心改进）
class PanRecognizer {
  constructor() {
    this.pans = [
      { name: '夸克网盘', pattern: /(pan\.)?quark\.cn/, icon: '🚀' },
      { name: '阿里云盘', pattern: /aliyundrive\.com/, icon: '☁️' },
      { name: '百度网盘', pattern: /pan\.baidu\.com/, icon: '🔵' },
      { name: '蓝奏云', pattern: /lanzou\.com|lanzo\.cn/, icon: '📎' },
      { name: '123云盘', pattern: /123pan\.com/, icon: '📦' },
    ];
  }
 
  parse(links) {
    return links.map(link => {
      const pan = this.pans.find(p => p.pattern.test(link));
      return {
        name: pan ? `${pan.icon} ${pan.name}` : '未知网盘',
        pan: link,
        ext: {},
      };
    });
  }
}
 
// 调试日志
function log(msg) {
  try {
    $log(`[网盘资源社] ${new Date().toLocaleTimeString()} ${msg}`);
  } catch (_) {}
}
 
// 请求队列控制（防封IP）
const requestQueue = [];
let activeRequests = 0;
const MAX_CONCURRENT = 3;
 
async function queueRequest(url, options) {
  return new Promise((resolve) => {
    requestQueue.push({ url, options, resolve });
    processQueue();
  });
}
 
function processQueue() {
  while (activeRequests  {
        log(`请求失败: ${error.message}`);
        resolve({ status: 500, data: null });
      })
      .finally(() => {
        activeRequests--;
        processQueue();
      });
  }
}
 
// 智能等待（带随机延迟）
function waitRandom(min = 1500, max = 4000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  log(`随机延迟: ${delay}ms`);
  return new Promise(resolve => setTimeout(resolve, delay));
}
 
async function getConfig() {
  return jsonify(appConfig);
}
 
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;
  log(`抓取列表: ${url}`);
 
  const { data, status } = await queueRequest(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
      'X-Requested-With': 'XMLHttpRequest'
    },
    timeout: 10000,
  });
 
  if (status !== 200 || !data) {
    log(`请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }
 
  const $ = cheerio.load(data);
  let cards = [];
 
  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    const postId = href.match(/thread-(\d+)/)?.[1] || '';
    
    // 提取额外信息
    const date = $(el).find('.date').text().trim();
    const sizeTag = $(el).find('.size-tag').text().trim() || '未知大小';
 
    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: $(el).find('img').attr('src') || '',
        vod_remarks: `${date} | ${sizeTag}`,
        ext: {
          url: `${appConfig.site}/${href}`,
          postId: postId,
        },
      });
    }
  });
 
  log(`解析到 ${cards.length} 条帖子`);
  return jsonify({ list: cards });
}
 
async function getTracks(ext) {
  ext = argsify(ext);
  const { url, postId } = ext;
  if (!url) return jsonify({ list: [] });
 
  log(`加载帖子详情: ${url}`);
  
  // 首次请求
  let { data, status } = await queueRequest(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
      'Referer': `${appConfig.site}/`
    },
    timeout: 15000,
  });
 
  if (status !== 200 || !data) {
    log(`帖子请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }
 
  // 检测回复需求（改进逻辑）
  const needReply = data.includes('回复后再查看') || 
                   data.includes('本内容需回复可见') ||
                   data.includes('hiddenreply');
 
  if (needReply) {
    log('检测到需要回复，尝试自动回复...');
    const replySuccess = await autoReply(url, postId, appConfig.cookie);
    
    if (replySuccess) {
      log('自动回复成功，等待5秒后刷新页面...');
      await waitRandom(3000, 6000);  // 随机延迟更自然 
      
      // 重新加载页面
      const retryResult = await queueRequest(url, {
        headers: {
          'User-Agent': UA,
          'Cookie': appConfig.cookie,
          'X-Refresh': 'true'
        },
      });
      
      if (retryResult.status === 200) {
        data = retryResult.data;
        log('已获取回复后内容');
      } else {
        log(`重新加载失败: HTTP ${retryResult.status}`);
      }
    } else {
      log('自动回复失败，尝试解析现有内容');
    }
  }
 
  // 提取网盘链接（核心改进）
  const links = extractPanLinks(data);
  log(`提取到原始链接: ${links.length}条`);
  
  // 使用网盘识别器分类 
  const recognizer = new PanRecognizer();
  const tracks = recognizer.parse(links);
  
  log(`识别到网盘链接: ${tracks.length}条`);
  if (tracks.length === 0) {
    log('未找到有效链接，尝试备用解析方案');
    const backupLinks = extractFromContent(data);
    tracks.push(...recognizer.parse(backupLinks));
  }
 
  return jsonify({
    list: [
      {
        title: "资源列表",
        tracks: tracks.slice(0, 10), // 最多显示10条
      },
    ],
  });
}
 
// 自动回复（增强版）
async function autoReply(postUrl, tid, cookie) {
  try {
    // 获取formhash
    const { data: pageData } = await queueRequest(postUrl, {
      headers: {
        'User-Agent': UA,
        'Cookie': cookie,
        'Referer': appConfig.site 
      },
    });
 
    const formhash = pageData.match(/name="formhash" value="([^"]+)"/)?.[1];
    if (!formhash) {
      log('获取formhash失败，可能页面结构已变更');
      return false;
    }
 
    // 构造回复请求 
    const replyUrl = `${appConfig.site}/forum.php?mod=post&action=reply&replysubmit=yes`;
    const params = new URLSearchParams({
      formhash,
      message: '感谢分享！期待更多资源~',
      posttime: Math.floor(Date.now() / 1000),
      usesig: '1',
      tid: tid,
      handlekey: 'fastpost',
      subject: ''
    });
 
    // 发送回复
    const { status, headers } = await queueRequest(replyUrl, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': appConfig.site,
        'Referer': postUrl 
      },
      body: params.toString(),
    });
 
    // 验证结果
    return status === 302 && headers.location?.includes('tid=' + tid);
  } catch (e) {
    log(`自动回复异常: ${e.message}`);
    return false;
  }
}
 
// 精准链接提取（核心改进）
function extractPanLinks(html) {
  const $ = cheerio.load(html);
  const links = new Set();
  
  // 策略1：优先解析正文区域 
  const content = $('.t_fsz, .message, .post-content');
  content.find('a[href]').each((i, el) => {
    const href = $(el).attr('href')?.trim();
    if (href && /https?:\/\//.test(href)) {
      links.add(href);
    }
  });
 
  // 策略2：备用方案 - 解析隐藏内容 
  if (links.size === 0) {
    $('.hide, .locked, .replyview').find('a[href]').each((i, el) => {
      const href = $(el).attr('href')?.trim();
      href && links.add(href);
    });
  }
 
  // 策略3：提取文本中的链接（正则兜底）
  const textLinks = html.match(/(https?:\/\/[^\s"'<>()]{8,})/gi) || [];
  textLinks.forEach(link => links.add(link));
 
  return Array.from(links);
}
 
// 备用解析方案 
function extractFromContent(html) {
  const $ = cheerio.load(html);
  const links = [];
  
  // 查找常见资源描述关键词 
  const keywords = ['夸克', '阿里', '百度', '网盘', 'pan', 'cloud'];
  $('div, p').each((i, el) => {
    const text = $(el).text();
    if (keywords.some(k => text.includes(k))) {
      $(el).find('a').each((j, a) => {
        const href = $(a).attr('href');
        href && links.push(href);
      });
    }
  });
  
  return links;
}
 
async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}
 
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);
 
  if (!text) return jsonify({ list: [] });
 
  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;
  log(`搜索: ${url}`);
 
  const { data, status } = await queueRequest(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
      'X-Request-ID': Date.now().toString(36)
    },
    timeout: 10000,
  });
 
  if (status !== 200 || !data) {
    log(`搜索失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }
 
  const $ = cheerio.load(data);
  let cards = [];
 
  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    const date = $(el).find('.date').text().trim();
    
    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '',
        vod_remarks: date,
        ext: {
          url: `${appConfig.site}/${href}`,
        },
      });
    }
  });
 
  log(`搜索到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}
 
// 导出函数
module.exports = {
  getConfig,
  getCards,
  getTracks,
  getPlayinfo,
  search 
};
