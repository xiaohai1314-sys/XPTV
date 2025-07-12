const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 4, // 版本号更新
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

  // 请求页面内容
  const { data: html, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`帖子请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  // 检查资源是否失效
  if (html.includes('有人标记失效')) {
    log('资源已标记失效，跳过');
    return jsonify({ list: [] });
  }

  // 直接提取网盘链接
  const links = extractPanLinks(html);
  
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

// 简化链接提取函数
function extractPanLinks(html) {
  const $ = cheerio.load(html);
  const links = [];
  
  // 1. 查找所有网盘链接按钮
  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().toLowerCase();
    
    // 检查链接是否符合要求
    if (isValidPanLink(href)) {
      links.push(href);
    }
    // 检查文本中是否包含网盘链接
    else if (text.includes('夸克') || text.includes('阿里') || text.includes('网盘')) {
      const match = text.match(/(https?:\/\/[^\s]+)/);
      if (match && isValidPanLink(match[0])) {
        links.push(match[0]);
      }
    }
  });
  
  // 2. 在隐藏内容区域查找
  const hiddenContainers = $('#hiddenlinks, .replyview, .hidecont, .locked');
  if (hiddenContainers.length > 0) {
    hiddenContainers.each((i, container) => {
      const text = $(container).text();
      const matches = text.match(/(https?:\/\/[^\s]+)/g) || [];
      matches.forEach(link => {
        if (isValidPanLink(link)) {
          links.push(link);
        }
      });
    });
  }
  
  // 去重处理
  return [...new Set(links)];
}

// 网盘链接验证
function isValidPanLink(link) {
  // 只保留夸克和阿里云盘
  const validDomains = [
    'quark.cn', 
    'aliyundrive.com', 
    'alipan.com'
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
