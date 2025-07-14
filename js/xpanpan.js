/**
 * Discuz! 自动回帖可见 — TVBox 全功能前端版
 * =============================================
 * - 分类：公开，无需登录
 * - 搜索：带 Cookie，支持登录态搜索
 * - 防止搜索翻页无限循环
 * - 封面：列表封面 + 详情封面可用
 * - 详情页：走 Puppeteer 后端自动回帖
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（完整版）',
  site: 'https://www.wpzysq.com', // ✅ 改成你的站点
  cookie: 'cookie_test=bdfKlqwUb_2Fc8CvYWudyqfzfsxFhaHZZdqOjNp76Qxn4NXKAc;bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=62;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22c238c6e8-e99f-4323-9466-df8d3e5e0f03%22%2C%22vd%22%3A1%2C%22stt%22%3A0%2C%22dr%22%3A0%2C%22expires%22%3A1752456926%2C%22ct%22%3A1752455126%7D;, // ✅ 必填，只给搜索用
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

// === 分类列表 ===
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

  // 🔒 防止分类分页死循环
  if (cards.length === 0) {
    return jsonify({ list: [] });
  }

  return jsonify({ list: cards });
}

// === 搜索（带 Cookie，防死循环） ===
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);
  if (!text) return jsonify({ list: [] });

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
    },
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

  // 🔒 防止搜索死循环
  if (cards.length === 0) {
    return jsonify({ list: [] });
  }

  return jsonify({ list: cards });
}

// === 详情页：走 Puppeteer 后端自动回帖，可解析详情封面 ===
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // 这里一定要改成你自己部署的 Puppeteer 后端地址
  const api = `http://你的服务器IP:3000/api/getTracks?url=${encodeURIComponent(url)}`;

  const { data, status } = await $fetch.get(api, {
    timeout: 20000,
  });

  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

async function getPlayinfo() {
  return jsonify({ urls: [] });
}
