/**
 * 【Discuz! 完整示例 — 绝对锁死版】
 * ========================================
 * 分类结构 = 原格式 forum-xxx.htm?page=
 * 搜索锁死 = 不带 page，不循环
 * Cookie = 如需登录，填在 appConfig.cookie
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（锁死最终版）',
  site: 'https://www.wpzysq.com',
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=64;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22a7268045-fca9-47ce-8455-ac5e1c70f2f2%22%2C%22vd%22%3A2%2C%22stt%22%3A498%2C%22dr%22%3A498%2C%22expires%22%3A1752464945%2C%22ct%22%3A1752463145%7D;', // 👉 TODO: 有账号要登录时，填这里
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

// === 分类结构 ===
async function getConfig() {
  return jsonify(appConfig);
}

// === 列表分页 ===
async function getCards(ext) {
  ext = argsify(ext);
  const page = ext.page || 1;
  const id = ext.id;
  const url = `${appConfig.site}/${id}${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
    },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href')?.trim();
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

  return jsonify({ list });
}

// === 真·锁死搜索 ===
async function search(ext) {
  ext = argsify(ext);
  const keyword = ext.text?.trim() || '';

  if (!keyword) return jsonify({ list: [], page: 1, pagecount: 1 });

  // 不拼 page，Discuz! 搜索通常是单页
  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(keyword)}`;

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
      'Referer': appConfig.site,
    },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [], page: 1, pagecount: 1 });

  const $ = cheerio.load(data);
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href')?.trim();
    const title = $(el).find('a').text().trim();
    let pic = $(el).find('img').attr('src') || '';

    if (pic && !pic.startsWith('http')) {
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }

    if (href && title && !list.find(item => item.vod_id === href)) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    }
  });

  return jsonify({ list, page: 1, pagecount: 1 }); // ✅ 真锁死
}

// === 详情页 — 你可对接 Puppeteer 后端 ===
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const api = `http://你的后端IP:3000/api/getTracks?url=${encodeURIComponent(url)}`;

  const { data, status } = await $fetch.get(api, { timeout: 20000 });
  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

async function getPlayinfo() {
  return jsonify({ urls: [] });
}
