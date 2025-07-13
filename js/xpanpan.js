const axios = require('axios'); // 引入axios库进行HTTP请求
const cheerio = require('cheerio'); // 引入cheerio库解析HTML

// 配置
const appConfig = {
  ver: 1,
  title: '网盘资源社',
  site: 'https://www.wpzysq.com', // 网站URL
  cookie: 'your_cookie_here', // 替换为你的cookie
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
    console.log(`[网盘资源社] ${msg}`);
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

  const { data, status } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0.0 Safari/537.36',
      'Cookie': appConfig.cookie, // 使用 cookie
    },
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
        vod_pic: '', // 没有缩略图时可为空
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

  const { data, status } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Cookie': appConfig.cookie, // 使用 cookie
    },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`帖子请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  // 提取网盘链接
  const links = extractPanLinks(data);
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

function extractPanLinks(html) {
  const $ = cheerio.load(html);
  const links = [];

  // 提取夸克网盘链接
  const quarkLinks = $('a[href^="https://pan.quark.cn/s/"]').map((i, el) => $(el).attr('href')).get();
  links.push(...quarkLinks);

  // 提取阿里云盘链接
  const aliyunLinks = $('a[href^="https://www.aliyundrive.com/s/"]').map((i, el) => $(el).attr('href')).get();
  links.push(...aliyunLinks);

  // 提取迅雷链接
  const xunleiLinks = $('a[href^="https://pan.xunlei.com/s/"]').map((i, el) => $(el).attr('href')).get();
  links.push(...xunleiLinks);

  // 提取百度网盘链接
  const baiduLinks = $('a[href^="https://pan.baidu.com/s/"]').map((i, el) => $(el).attr('href')).get();
  links.push(...baiduLinks);

  return [...new Set(links)]; // 去重
}

// 等待页面刷新
function waitForPageRefresh(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

// 模拟自动回复
async function autoReply(postUrl, cookie) {
  const replyUrl = new URL('forum.php?mod=post&action=reply&fid=', postUrl).toString();
  const replyData = {
    formhash: '', // 需要从页面中提取
    message: '感谢楼主的分享！',
    infloat: 'yes',
    handlekey: 'fastpost',
  };

  const { status } = await axios.post(replyUrl, new URLSearchParams(replyData).toString(), {
    headers: {
     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
     'Cookie': cookie,
     'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });

  return status === 200;
}

// 配置
async function getConfig() {
  return jsonify(appConfig);
}

// 获取卡片列表
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;
  log(`抓取列表: ${url}`);

  const { data, status } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Cookie': appConfig.cookie, // 使用 cookie
    },
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
        vod_pic: '', // 没有缩略图时可为空
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

  const { data, status } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Cookie': appConfig.cookie, // 使用 cookie
    },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`帖子请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  

