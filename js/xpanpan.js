const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 5, // 版本号更新
  title: '网盘资源社',
  site: 'https://www.wpzysq.com',
  tabs: [
    {
      name: '影视/剧集',
      ext: {
        id: 'forum-1.htm?page=',
      },
    },
    {
      name: '4K专区',
      ext: {
        id: 'forum-12.htm?page=',
      },
    },
    {
      name: '动漫区',
      ext: {
        id: 'forum-3.htm?page=',
      },
    },
  ],
};

// 调试日志
function log(msg) {
  try {
    $log(`[网盘资源社] ${msg}`);
  } catch (_) {}
}

// 延时函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;
  log(`抓取列表: ${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  let cards = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    const postId = href.match(/thread-(\d+)/)?.[1] || '';

    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '',
        vod_remarks: '',
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
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  log(`加载帖子详情: ${url}`);

  // 第一次请求获取原始页面
  let finalHtml = '';
  let response = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 15000,
  });

  if (response.status !== 200) {
    log(`帖子请求失败: HTTP ${response.status}`);
    return jsonify({ list: [] });
  }

  finalHtml = response.data;

  // 检查是否需要回复
  if (finalHtml.includes('请回复后再查看')) {
    log('需要回复解锁内容，尝试模拟回复...');
    
    try {
      const $ = cheerio.load(finalHtml);
      const form = $('#fastpostform');
      if (form.length > 0) {
        // 获取表单参数
        const formhash = form.find('input[name="formhash"]').val();
        const tid = form.find('input[name="tid"]').val();
        const fid = form.find('input[name="fid"]').val();
        
        if (formhash && tid) {
          // 快捷回复内容池
          const replies = [
            "感谢楼主的分享！",
            "资源太棒了，感谢分享！",
            "非常需要这个资源，感谢！"
          ];
          
          // 随机选择一条回复
          const randomReply = replies[Math.floor(Math.random() * replies.length)];
          
          // 构建POST数据
          const postData = new URLSearchParams({
            formhash: formhash,
            tid: tid,
            fid: fid || '',
            message: randomReply,
            fastpost: 'true',
            usesig: 'true',
            subject: ''
          });
          
          // 获取表单action URL
          let actionUrl = form.attr('action');
          if (!actionUrl.startsWith('http')) {
            actionUrl = new URL(actionUrl, appConfig.site).href;
          }
          
          // 提交回复
          const { status: replyStatus, headers } = await $fetch.post(actionUrl, {
            headers: {
              'User-Agent': UA,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Referer': url
            },
            body: postData.toString(),
            timeout: 20000
          });
          
          if (replyStatus === 200 || replyStatus === 302) {
            log(`模拟回复成功 (${randomReply})，等待页面刷新...`);
            
            // 等待1-2秒让页面刷新
            await delay(1500);
            
            // 重新获取页面内容
            response = await $fetch.get(url, {
              headers: { 'User-Agent': UA },
              timeout: 15000
            });
            
            finalHtml = response.data;
            log('页面刷新完成，开始提取链接');
          } else {
            log(`回复失败: HTTP ${replyStatus}`);
          }
        }
      }
    } catch (e) {
      log('模拟回复出错: ' + e.message);
    }
  }

  // 提取网盘链接
  const links = extractPanLinks(finalHtml);
  
  if (links.length === 0) {
    log('未找到有效网盘链接');
  } else {
    log(`找到 ${links.length} 个网盘链接`);
  }

  const tracks = links.map(link => ({
    name: "网盘链接",
    pan: link,
    ext: {},
  }));

  return jsonify({
    list: [
      {
        title: "资源列表",
        tracks: tracks,
      },
    ],
  });
}

// 扩展网盘链接搜索范围
function extractPanLinks(html) {
  const $ = cheerio.load(html);
  const links = [];
  
  // 方法1: 查找所有可能的网盘链接元素
  $('a[href*="//"], .wpzysq-btn, .pan-btn, .downbtn, .button, .btn').each((i, el) => {
    const href = $(el).attr('href') || '';
    if (isValidPanLink(href)) {
      links.push(href);
    }
  });
  
  // 方法2: 在文本内容中搜索网盘链接
  const textLinks = html.match(/https?:\/\/[^\s'"]+/g) || [];
  textLinks.forEach(link => {
    if (isValidPanLink(link)) {
      links.push(link);
    }
  });
  
  // 方法3: 在特定区域搜索（如隐藏区域）
  const specialSections = $('#hiddenlinks, .replyview, .hidecont, .locked, .postmessage, .t_f');
  specialSections.each((i, section) => {
    const text = $(section).text();
    const matches = text.match(/https?:\/\/[^\s]+/g) || [];
    matches.forEach(match => {
      if (isValidPanLink(match)) {
        links.push(match);
      }
    });
  });
  
  // 去重处理
  return [...new Set(links)];
}

// 网盘链接验证
function isValidPanLink(link) {
  // 只保留夸克和阿里云盘
  const validDomains = [
    'quark.cn', 
    'aliyundrive.com', 
    'alipan.com',
    'pan.quark.cn',
    'www.aliyundrive.com',
    'www.alipan.com'
  ];
  
  // 检查是否为有效链接
  const isValid = validDomains.some(domain => link.includes(domain)) &&
         link.startsWith('http');
  
  return isValid;
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);

  if (!text) {
    log("无关键词");
    return jsonify({ list: [] });
  }

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;
  log(`搜索: ${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 15000,
  });

  if (status !== 200) {
    log(`搜索失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  let cards = [];

  // 修复搜索结果的解析
  $('.threadlist li, li[data-href^="thread-"]').each((i, el) => {
    const linkEl = $(el).find('a').first();
    const href = linkEl.attr('href') || '';
    const title = linkEl.text().trim();
    
    if (href && title && href.startsWith('thread-')) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '',
        vod_remarks: '',
        ext: {
          url: `${appConfig.site}/${href}`,
        },
      });
    }
  });

  log(`搜索到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}
