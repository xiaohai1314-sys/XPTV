/**
 * Discuz! 自动回帖可见 — TVBox 插件 完整最终版
 * =============================================
 * - tabs 分类格式 100% 原样
 * - 分类/搜索/分页/封面/详情页封面
 * - Puppeteer 自动回帖
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（最终完整版）',
  site: 'https://www.wpzysq.com', // TODO: 改成你的域名
  cookie: '', // 不用填
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

// === 分类配置 ===
async function getConfig() {
  return jsonify(appConfig);
}

// === 分类 / 分页 ===
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });
  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);
  const cards = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();

    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      if (pic.startsWith('/')) {
        pic = `${appConfig.site}${pic}`;
      } else {
        pic = `${appConfig.site}/${pic}`;
      }
    }
    if (!pic) pic = ''; // 保底

    const postId = href.match(/thread-(\d+)/)?.[1] || '';

    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}`, postId },
      });
    }
  });

  return jsonify({ list: cards });
}

// === 搜索 ===
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);

  if (!text) return jsonify({ list: [] });

  // 登录并获取Cookie
  const cookie = await login();

  if (!cookie) {
    console.error('Login failed. Cannot perform search without a valid session.');
    return jsonify({ list: [] });
  }

  // 构造搜索 URL
  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Cookie': cookie },
    timeout: 10000,
  });

  if (status !== 200) {
    console.error(`Search request failed with status: ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const cards = [];

  $('ul.list-unstyled.threadlist > li.media.thread').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('div.media-body > div.style3_subject > a').text().trim();

    let pic = $(el).find('img.avatar-3').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      if (pic.startsWith('/')) {
        pic = `${appConfig.site}${pic}`;
      } else {
        pic = `${appConfig.site}/${pic}`;
      }
    }
    if (!pic) pic = ''; // 保底

    const postId = href.match(/thread-(\d+)/)?.[1] || '';

    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}`, postId },
      });
    }
  });

  if (cards.length === 0) {
    console.warn('No search results found. Please check the HTML structure and selectors.');
  }

  return jsonify({ list: cards });
}

// === 登录 ===
async function login() {
  const loginUrl = `${appConfig.site}/member.php?mod=logging&action=login`;
  const loginData = {
    username: '1083328569@qq.com', // 替换为你的用户名
    password: 'xiaohai1314', // 替换为你的密码
    loginfield: 'username',
    cookietime: '2592000',
    referer: appConfig.site,
    questionid: '0',
    answer: '',
  };

  const { data, status } = await $fetch.post(loginUrl, loginData, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });

  if (status !== 200) {
    console.error(`Login request failed with status: ${status}`);
    return null;
  }

  const $ = cheerio.load(data);
  const cookie = $fetch.getCookie();

  if (!cookie) {
    console.error('Failed to obtain session cookie after login.');
    return null;
  }

  return cookie;
}

// === 详情页：自动回帖 + 正文首图封面 ===
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // 先抓页面自己解析封面
  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });
  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);

  let pic = $('div#postlist img').first().attr('src') || '';
  if (pic && !pic.startsWith('http')) {
    if (pic.startsWith('/')) {
      pic = `${appConfig.site}${pic}`;
    } else {
      pic = `${appConfig.site}/${pic}`;
    }
  }
  if (!pic) pic = ''; // 保底

  // === TODO: 改成你的 Puppeteer 后端
  const api = `http://你的服务器IP:3000/api/getTracks?url=${encodeURIComponent(url)}`;

  const { data: tracksData, status: apiStatus } = await $fetch.get(api, {
    timeout: 20000,
  });
  if (apiStatus !== 200) return jsonify({ list: [] });

  return jsonify({
    ...tracksData,
    cover: pic,
  });
}

// === 播放信息（占位） ===
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
