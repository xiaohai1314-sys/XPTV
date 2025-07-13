/**
 * Discuz! 自动回帖可见 — TVBox 插件 完整最终版
 * =============================================
 * - tabs 保留原结构（多行缩进）
 * - 分类、分页、搜索、封面
 * - 详情页正文首图做海报
 * - Puppeteer 自动回帖
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（最终版）',
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

  // === 示例 1：和分类页一致
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

  // === 示例 2：如有不同结构可切换
  /*
  $('div.searchresult a').each((i, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().trim();
    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '', // 如有封面可抓
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    }
  });
  */

  return jsonify({ list: cards });
}

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
    if (pic.startsWith('/')) {
      pic = `${appConfig.site}${pic}`;
    } else {
      pic = `${appConfig.site}/${pic}`;
    }
  }

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

async function getPlayinfo() {
  return jsonify({ urls: [] });
}
