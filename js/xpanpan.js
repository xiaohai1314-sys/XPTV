const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 3, // 版本号更新
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
  const { data: firstResponse, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 15000,
  });

  if (status !== 200) {
    log(`帖子请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  // 检查资源是否失效
  if (firstResponse.includes('有人标记失效')) {
    log('资源已标记失效，跳过');
    return jsonify({ list: [] });
  }

  // 检查是否需要回复
  let finalHtml = firstResponse;
  if (firstResponse.includes('请回复后再查看')) {
    log('需要回复解锁内容，尝试模拟回复...');
    
    try {
      const $ = cheerio.load(firstResponse);
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
            timeout: 15000
          });
          
          if (replyStatus === 200 || replyStatus === 302) {
            log(`模拟回复成功 (${randomReply})`);
            
            // 获取重定向URL（如果有）
            let redirectUrl = url;
            if (replyStatus === 302 && headers.location) {
              redirectUrl = new URL(headers.location, appConfig.site).href;
              log(`重定向到: ${redirectUrl}`);
            }
            
            // 重新获取页面内容
            const { data: newData } = await $fetch.get(redirectUrl, {
              headers: { 'User-Agent': UA },
              timeout: 15000
            });
            
            finalHtml = newData;
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
    log('未找到有效网盘链接，尝试备用提取方法...');
    const backupLinks = extractBackupPanLinks(finalHtml);
    links.push(...backupLinks);
  }

  log(`找到 ${links.length} 个网盘链接`);
  
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

// 优化后的链接提取函数
function extractPanLinks(html) {
  const $ = cheerio.load(html);
  const links = [];
  
  // 1. 查找隐藏区域的网盘链接
  const hiddenContainers = $('#hiddenlinks, .replyview, .hidecont, .locked');
  hiddenContainers.each((i, container) => {
    const text = $(container).text();
    const matches = text.match(/(https?:\/\/[^\s]+)/g) || [];
    matches.forEach(link => {
      if (isValidPanLink(link)) {
        links.push(link);
      }
    });
  });
  
  // 2. 查找所有网盘链接按钮
  $('.wpzysq-btn, .pan-btn, .downbtn').each((i, btn) => {
    const link = $(btn).attr('href') || '';
    if (isValidPanLink(link)) {
      links.push(link);
    }
  });
  
  // 3. 查找所有包含"网盘"或"下载"的链接
  $('a').each((i, el) => {
    const link = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();
    
    if (isValidPanLink(link) {
      links.push(link);
    }
    // 检查文本中包含"网盘"但可能没有正确格式化的链接
    else if (text.includes('网盘') || text.includes('下载')) {
      const textLinks = text.match(/(https?:\/\/[^\s]+)/g) || [];
      textLinks.forEach(tl => {
        if (isValidPanLink(tl)) {
          links.push(tl);
        }
      });
    }
  });
  
  // 去重处理
  return [...new Set(links)];
}

// 备用提取方法 - 针对特殊格式
function extractBackupPanLinks(html) {
  const links = [];
  const regex = /(?:夸克|阿里|网盘).*?(https?:\/\/[a-zA-Z0-9\-\.\/]+)/g;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    const link = match[1];
    if (isValidPanLink(link)) {
      links.push(link);
    }
  }
  
  return links;
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
  
  // 排除图片等无关资源
  const invalidExtensions = ['.jpg', '.png', '.gif', '.jpeg', '.webp', '.css', '.js'];
  
  // 检查是否为有效链接
  const isValid = validDomains.some(domain => link.includes(domain)) &&
         !invalidExtensions.some(ext => link.includes(ext)) &&
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

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}`;
  log(`搜索: ${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`搜索失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  let cards = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    if (href && title) {
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

  return jsonify({ list: cards });
}
