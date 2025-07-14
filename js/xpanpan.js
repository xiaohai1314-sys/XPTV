/**
 * 【方案】TVBox + Puppeteer 自动回帖示例
 * ========================================
 * - 分类和搜索完全保留
 * - 详情页自动走后端 Puppeteer
 * - 局域网访问，前端可在手机 TVBox 使用
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（局域网示例）',
  site: 'https://www.wpzysq.com',
  cookie: '', // 这里 cookie 不需要
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

async function getConfig() {
  return jsonify(appConfig);
}

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

  return jsonify({ list: cards, page: page, pagecount: 1 });
}

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
      if (pic.startsWith('/')) {
        pic = `${appConfig.site}${pic}`;
      } else {
        pic = `${appConfig.site}/${pic}`;
      }
    }

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

  return jsonify({ list: cards, page: page, pagecount: 1 });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // ⚠️ 注意：这里写成你的电脑局域网 IP
  const api = `http://192.168.10.111:3000/api/getTracks?url=${encodeURIComponent(url)}`;

  const { data, status } = await $fetch.get(api, {
    timeout: 20000,
  });

  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

async function getPlayinfo() {
  return jsonify({ urls: [] });
}
