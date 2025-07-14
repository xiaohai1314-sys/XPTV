/**
 * Discuz! 自动回帖可见 — TVBox 插件 一刀切万能版
 * =============================================
 * - 分类 tabs 完全保留
 * - 分类页/搜索页双选择器
 * - 封面自适应
 * - 详情页正文首图封面
 * - Puppeteer 后端接口
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（万能一刀切）',
  site: 'https://www.wpzysq.com', // TODO: 改成你的域名
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=35;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22389b0524-8c85-4073-ae4d-48c20c6f1d52%22%2C%22vd%22%3A7%2C%22stt%22%3A2778%2C%22dr%22%3A35%2C%22expires%22%3A1752415823%2C%22ct%22%3A1752414023%7D;', // 不需要，前端不带
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
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }
    if (!pic) pic = '';

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

// === 搜索（双选择器：li + div.pbw） ===
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);

  if (!text) return jsonify({ list: [] });

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;

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
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }
    if (!pic) pic = '';

    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    }
  });

  // === 如果 li 没抓到，尝试 div.pbw ===
  if (cards.length === 0) {
    $('div.pbw a[href^="thread-"]').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      if (href && title) {
        cards.push({
          vod_id: href,
          vod_name: title,
          vod_pic: '', // div.pbw 一般没有封面
          vod_remarks: '',
          ext: { url: `${appConfig.site}/${href}` },
        });
      }
    });
  }

  return jsonify({ list: cards });
}

// === 详情页：正文首图封面 + Puppeteer ===
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });
  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);

  let pic = $('div#postlist img').first().attr('src') || '';
  if (pic && !pic.startsWith('http')) {
    pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
  }
  if (!pic) pic = '';

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

// === 播放占位 ===
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
