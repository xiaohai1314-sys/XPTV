/**
 * 【Discuz! TVBox 完整示例】
 * - 分类：前端多页
 * - 搜索：后端 Puppeteer（自动带 Cookie）
 * - 详情：后端 Puppeteer（自动回帖）
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（最终版）',
  site: 'https://www.wpzysq.com',
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=74;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22698dcb85-179f-41e4-8790-8ff6c911b90c%22%2C%22vd%22%3A2%2C%22stt%22%3A6%2C%22dr%22%3A6%2C%22expires%22%3A1752501516%2C%22ct%22%3A1752499716%7D', // 不要填！后端带
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm?page=' }, // 和你原来一样
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

// === 分类：前端
async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const page = parseInt(ext.page) || 1;
  const id = ext.id;
  const url = `${appConfig.site}/${id}${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [], page: page, pagecount: page });

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

  return jsonify({ list: cards, page: page, pagecount: 999 }); // 可翻页
}

// === 搜索：走后端 Puppeteer
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) return jsonify({ list: [], page: 1, pagecount: 1 });

  const url = `http://192.168.1.6:3000/api/search?q=${encodeURIComponent(text)}`;
  const { data, status } = await $fetch.get(url, { timeout: 20000 });
  if (status !== 200) return jsonify({ list: [], page: 1, pagecount: 1 });

  return jsonify(data);
}

// === 详情：走后端 Puppeteer
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const api = `http://192.168.1.6:3000/api/getTracks?url=${encodeURIComponent(url)}`;
  const { data, status } = await $fetch.get(api, { timeout: 20000 });
  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

async function getPlayinfo() {
  return jsonify({ urls: [] });
}
