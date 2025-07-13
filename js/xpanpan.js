const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const cheerio = createCheerio();
 
const appConfig = {
  ver: 3,
  title: '网盘资源社',
  site: 'https://www.wpzysq.com', 
  cookie: 'cookie_test=bdfKlqwUb_2Fc8CvYWudyqfzfsxFhaHZZdqOjNp76Qxn4NXKAc;bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=28;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%226e94485a-626f-46ec-b34a-0a9efd23d434%22%2C%22vd%22%3A1%2C%22stt%22%3A0%2C%22dr%22%3A0%2C%22expires%22%3A1752404250%2C%22ct%22%3A1752402450%7D;', // 必须替换为有效cookie 
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm?page='  }
    },
    {
      name: '4K专区',
      ext: { id: 'forum-12.htm?page='  }
    },
    {
      name: '动漫区',
      ext: { id: 'forum-3.htm?page='  }
    },
    // 其他分类...
  ]
};
 
// 增强版日志系统 
function log(msg, type = 'info') {
  const prefix = {
    error: '❌ [ERROR]',
    warn: '⚠️ [WARN]',
    info: 'ℹ️ [INFO]' 
  }[type] || 'ℹ️ [INFO]';
  try {
    $log(`${prefix} ${new Date().toISOString()} ${msg}`);
    if (type === 'error') console.trace(); 
  } catch (_) {}
}
 
// 配置获取（保持不变）
async function getConfig() {
  return jsonify(appConfig);
}
 
// 获取帖子列表（优化请求头）
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`; 
  log(`Fetching list: ${url}`);
 
  const { data, status, headers } = await $fetch.get(url,  {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie, 
      'Referer': appConfig.site, 
      'Accept-Language': 'zh-CN,zh;q=0.9'
    },
    timeout: 20000
  });
 
  if (status !== 200) {
    log(`List request failed with status ${status}`, 'error');
    return jsonify({ list: [] });
  }
 
  // 更新cookie（关键修复点）
  if (headers['set-cookie']) {
    appConfig.cookie  = headers['set-cookie'];
    log('Cookie updated from response headers');
  }
 
  const $ = cheerio.load(data); 
  const cards = [];
 
  $('li[data-href^="thread-"]').each((i, el) => {
    const $el = $(el);
    cards.push({ 
      vod_id: $el.attr('data-href'), 
      vod_name: $el.find('a').first().text().trim(), 
      vod_pic: $el.find('img').attr('src')  || '',
      ext: {
        url: new URL($el.attr('data-href'),  appConfig.site).href, 
        updateTime: $el.find('.date').text().trim() 
      }
    });
  });
 
  log(`Found ${cards.length}  valid posts`);
  return jsonify({ list: cards });
}
 
// 核心修复：回帖后链接提取
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });
 
  log(`Processing post: ${url}`);
  let response = await $fetch.get(url,  {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie, 
      'Referer': new URL(url).origin
    },
    timeout: 25000
  });
 
  // 检查是否需要回复 
  if (response.data.includes(' 请回复后再查看')) {
    log('Post requires reply, attempting auto-reply...');
    const replySuccess = await autoReply(url, appConfig.cookie); 
    
    if (!replySuccess) {
      log('Auto-reply failed', 'error');
      return jsonify({ list: [] });
    }
 
    // 关键修复：等待3秒确保服务器处理完成 
    await new Promise(resolve => setTimeout(resolve, 3000));
 
    // 重新加载页面（携带更新后的cookie）
    response = await $fetch.get(url,  {
      headers: {
        'User-Agent': UA,
        'Cookie': appConfig.cookie, 
        'Referer': url
      }
    });
 
    // 二次验证 
    if (response.data.includes(' 正在审核')) {
      log('Post is under review after reply', 'warn');
      return jsonify({ list: [] });
    }
  }
 
  // 增强版链接提取
  const links = extractLinks(response.data); 
  if (links.length  === 0) {
    // 调试辅助：保存HTML供分析
    if (typeof $fs !== 'undefined') {
      $fs.writeFileSync('debug.html',  response.data); 
      log('No links found, saved HTML to debug.html',  'warn');
    }
  }
 
  return jsonify({
    list: [{
      title: "资源链接",
      tracks: links.map(link  => ({
        name: detectPanType(link),
        pan: link,
        ext: { verified: true }
      }))
    }]
  });
}
 
// 增强版自动回复 
async function autoReply(postUrl, cookie) {
  try {
    const replyUrl = new URL('forum.php?mod=post&action=reply',  new URL(postUrl).origin);
    log(`Preparing reply to: ${replyUrl.href}`); 
 
    // 获取formhash 
    const { data: formPage } = await $fetch.get(replyUrl.href,  {
      headers: { 'Cookie': cookie }
    });
    
    const formhash = formPage.match(/name="formhash"  value="([^"]+)"/)?.[1];
    if (!formhash) throw new Error('Formhash not found');
 
    // 随机回复内容（降低被封风险）
    const messages = [
      '感谢分享！',
      '资源很棒，谢谢！',
      '已收藏，辛苦了！'
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)]; 
 
    // 提交回复 
    const { status, data } = await $fetch.post(replyUrl.href,  {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'Origin': replyUrl.origin, 
        'Referer': postUrl
      },
      body: new URLSearchParams({
        formhash,
        message: randomMessage,
        usesig: '1',
        submit: 'true'
      }),
      timeout: 15000 
    });
 
    // 验证回复成功（不同论坛可能返回不同）
    const success = status === 200 && (
      data.includes(' 回复成功') || 
      data.includes(' 发表回复') ||
      data.includes(' 秒后跳转')
    );
 
    if (!success) {
      log(`Reply failed. Status: ${status}, Response: ${data.slice(0,  200)}`, 'error');
      return false;
    }
 
    log('Reply successfully submitted');
    return true;
  } catch (e) {
    log(`Auto-reply error: ${e.message}`,  'error');
    return false;
  }
}
 
// 增强版链接提取
function extractLinks(html) {
  const linkPatterns = [
    // 夸克网盘
    /https?:\/\/(?:pan\.)?quark\.cn\/[^\s"<>]+/gi,
    // 阿里云盘
    /https?:\/\/www\.aliyundrive\.com\/s\/[^\s"<>]+/gi,
    // 百度网盘（含提取码）
    /https?:\/\/pan\.baidu\.com\/[^\s"<>]+(?:\s*密码\s*:\s*[a-zA-Z0-9]{4})?/gi,
    // 通用http/https链接（严格模式）
    /https?:\/\/[^\s"<>]{10,}(?=\s|"|'|<|$)/gi 
  ];
 
  const links = [];
  for (const pattern of linkPatterns) {
    const matches = html.match(pattern)  || [];
    matches.forEach(match  => {
      // 清理链接前后的无效字符
      const cleanLink = match 
        .replace(/^["']+|["']+$/g, '')
        .replace(/&amp;/g, '&');
      
      if (cleanLink.length  > 10) {
        links.push(cleanLink); 
      }
    });
  }
 
  // 去重并过滤无效链接 
  return [...new Set(links)].filter(link => {
    return !link.includes('example.com')  && 
           !link.endsWith('.css')  && 
           !link.endsWith('.js'); 
  });
}
 
// 网盘类型检测 
function detectPanType(url) {
  const panTypes = {
    'quark.cn':  '夸克网盘',
    'aliyundrive.com':  '阿里云盘',
    'baidu.com':  '百度网盘'
  };
 
  for (const [domain, name] of Object.entries(panTypes))  {
    if (url.includes(domain))  return name;
  }
  return '未知网盘';
}
 
// 其他必要功能 
async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}
 
async function search(ext) {
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  
  if (!text.trim())  {
    return jsonify({ list: [] });
  }
 
  const searchUrl = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`; 
  const { data, status } = await $fetch.get(searchUrl,  {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie  
    }
  });
 
  if (status !== 200) {
    return jsonify({ list: [] });
  }
 
  const $ = cheerio.load(data); 
  const results = [];
 
  $('.search-result-item').each((i, el) => {
    const $el = $(el);
    results.push({ 
      vod_id: $el.attr('data-threadid'), 
      vod_name: $el.find('.title').text().trim(), 
      vod_pic: $el.find('img').attr('src')  || '',
      ext: {
        url: new URL($el.find('a').attr('href'),  appConfig.site).href, 
        date: $el.find('.date').text().trim() 
      }
    });
  });
 
  return jsonify({ list: results });
}
