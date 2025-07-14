/**
 * Discuz! 自动回帖可见 — TVBox 纯前端插件【最终版】
 * =============================================
 * - 分类结构保留【和原版一致】
 * - 搜索只跑一页，不死循环
 * - 内页海报支持（帖子详情页提取）
 * - Puppeteer 后端自动回帖可见
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（最终版）',
  site: 'https://www.wpzysq.com', // ✅ 替换成你的站点域名
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=63;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22a7268045-fca9-47ce-8455-ac5e1c70f2f2%22%2C%22vd%22%3A1%2C%22stt%22%3A0%2C%22dr%22%3A0%2C%22expires%22%3A1752464447%2C%22ct%22%3A1752462647%7D;', // ✅ 如走 Puppeteer，可空
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

// === 首页/分类列表 ===
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
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();

    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }

    const postId = href.match(/thread-(\d+)/)?.[1] || '';

    if (href && title) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}`, postId },
      });
    }
  });

  return jsonify({ list });
}

// === 搜索，只跑第一页 ===
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = 1;

  if (!text) return jsonify({ list: [], page: 1, pagecount: 1 });

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}`;
  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
    },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [], page: 1, pagecount: 1 });

  const $ = cheerio.load(data);
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();

    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }

    if (href && title) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    }
  });

  // ✅ 告诉 TVBox：只一页
  return jsonify({ list, page: 1, pagecount: 1 });
}

// === 详情页 — 内页海报 / 自动回帖可见 ===
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // 🔑 这里一定是你自己部署的 Puppeteer 服务地址
  const api = `http://你的服务器IP:3000/api/getTracks?url=${encodeURIComponent(url)}`;
  const { data, status } = await $fetch.get(api, {
    timeout: 20000,
  });
  if (status !== 200) return jsonify({ list: [] });

  // Puppeteer 端要把帖子详情页封面也返回：示例
  // return { list: [{ title: '资源', tracks: [...], pic: 'http://xx.jpg' }] }
  return jsonify(data);
}

// === 播放信息（可留空） ===
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
