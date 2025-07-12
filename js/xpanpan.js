const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 7, // 版本号更新
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
  const { url, postId } = ext;
  if (!url) return jsonify({ list: [] });

  log(`加载帖子详情: ${url}`);

  // 第一次请求：检查是否需要回复
  const { data: firstResponse, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 15000,
  });

  if (status !== 200) {
    log(`帖子请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  // 如果页面提示需要回复，先执行回复操作
  if (firstResponse.includes('请回复后再查看')) {
    log('检测到需要回复的帖子，尝试模拟回复...');
    const replySuccess = await simulateReply(url, postId);
    
    if (!replySuccess) {
      log('回复失败，返回空结果');
      return jsonify({ list: [] });
    }
    
    // 等待3秒让页面刷新
    log('等待页面刷新...');
    await delay(3000);
  }

  // 第二次请求：提取网盘链接
  log('重新加载页面提取链接...');
  const { data: finalHtml } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 15000,
  });

  // 全局扫描网盘链接
  const links = extractAllPanLinks(finalHtml);
  
  if (links.length === 0) {
    log('未找到有效网盘链接');
  } else {
    log(`找到 ${links.length} 个网盘链接`);
  }

  const tracks = links.map(link => ({
    name: getPanName(link),
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

// 模拟回复功能（独立函数）
async function simulateReply(url, postId) {
  try {
    log(`获取回复表单: ${url}`);
    const { data: formPage } = await $fetch.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });
    
    const $ = cheerio.load(formPage);
    const form = $('#fastpostform');
    
    if (form.length === 0) {
      log('未找到回复表单');
      return false;
    }
    
    // 获取表单参数
    const formhash = form.find('input[name="formhash"]').val();
    const tid = form.find('input[name="tid"]').val();
    const fid = form.find('input[name="fid"]').val();
    
    if (!formhash || !tid) {
      log('缺少必要的表单参数');
      return false;
    }
    
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
    
    log(`提交回复到: ${actionUrl}`);
    const { status: replyStatus } = await $fetch.post(actionUrl, {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': url
      },
      body: postData.toString(),
      timeout: 20000
    });
    
    if (replyStatus === 200 || replyStatus === 302) {
      log(`模拟回复成功 (${randomReply})`);
      return true;
    } else {
      log(`回复失败: HTTP ${replyStatus}`);
      return false;
    }
  } catch (e) {
    log('模拟回复出错: ' + e.message);
    return false;
  }
}

// 全局扫描网盘链接
function extractAllPanLinks(html) {
  // 使用正则表达式全局匹配所有链接
  const linkRegex = /https?:\/\/[^\s'"]+/g;
  const allLinks = html.match(linkRegex) || [];
  
  // 过滤有效的网盘链接
  const panLinks = allLinks.filter(link => isValidPanLink(link));
  
  // 去重处理
  return [...new Set(panLinks)];
}

// 精确的网盘链接验证
function isValidPanLink(link) {
  // 排除常见非网盘链接
  if (link.includes('.css') || link.includes('.js') || 
      link.includes('.png') || link.includes('.jpg') || 
      link.includes('.gif') || link.includes('gravatar')) {
    return false;
  }
  
  // 夸克网盘匹配
  const isQuark = /https?:\/\/(?:[a-z]+\.)?quark\.cn\/[a-z0-9]+/i.test(link);
  
  // 阿里云盘匹配
  const isAli = /https?:\/\/(?:[a-z]+\.)?(?:aliyundrive|alipan)\.com\/[s]?\/[a-zA-Z0-9]+/i.test(link);
  
  return isQuark || isAli;
}

// 获取网盘名称
function getPanName(link) {
  if (link.includes('quark.cn')) {
    return "夸克网盘";
  } else if (link.includes('aliyundrive.com') || link.includes('alipan.com')) {
    return "阿里云盘";
  }
  return "网盘链接";
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

  // 主选择器：尝试匹配搜索结果项
  $('.threadlist li, li.thread, li.search, .thread').each((i, el) => {
    const linkEl = $(el).find('a.subject');
    const href = linkEl.attr('href') || '';
    const title = linkEl.text().trim();
    
    if (href && title && href.includes('thread')) {
      const fullUrl = href.startsWith('http') ? href : `${appConfig.site}/${href}`;
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '',
        vod_remarks: '',
        ext: {
          url: fullUrl,
          postId: href.match(/thread-(\d+)/)?.[1] || '',
        },
      });
    }
  });

  // 备用选择器：直接查找所有主题链接
  if (cards.length === 0) {
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const title = $(el).text().trim();
      
      if (href.includes('thread-') && title) {
        const fullUrl = href.startsWith('http') ? href : `${appConfig.site}/${href}`;
        cards.push({
          vod_id: href,
          vod_name: title,
          vod_pic: '',
          vod_remarks: '',
          ext: {
            url: fullUrl,
            postId: href.match(/thread-(\d+)/)?.[1] || '',
          },
        });
      }
    });
  }

  log(`搜索到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}
