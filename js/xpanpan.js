/**
 * Discuz! 自动回帖可见 — TVBox 插件完整版
 * =============================================
 * - 分类结构完全一致（保留 tabs）
 * - formhash 自动抓
 * - 自动回帖 + 刷新
 * - 封面可用（如有）
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（完全版）',
  site: 'https://www.wpzysq.com', // TODO: 必填，带 https://
  cookie: '', // TODO: 无需填，留空即可，走后端代理
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm?page=' }, // TODO: 替换为你的分类 ID
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

    // === 封面图 ===
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
        vod_remarks: '', // 可选备注
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

  return jsonify({ list: cards });
}

// === 详情页：自动回帖可见 ===
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // === TODO: 改成你的 Puppeteer 后端代理 ===
  const api = `http://你的服务器IP:3000/api/getTracks?url=${encodeURIComponent(url)}`;

  const { data, status } = await $fetch.get(api, {
    timeout: 20000,
  });

  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

// === 播放信息（占位） ===
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
