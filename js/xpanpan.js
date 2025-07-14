/**
 * Discuz! 自动回帖可见 — TVBox 保底纯前端示例
 * =============================================
 * - 分类完全一致
 * - 搜索正常，防死循环
 * - 先不跑 Puppeteer（后续可加）
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（保底版）',
  site: 'https://www.wpzysq.com',
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=35;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22389b0524-8c85-4073-ae4d-48c20c6f1d52%22%2C%22vd%22%3A7%2C%22stt%22%3A2778%2C%22dr%22%3A35%2C%22expires%22%3A1752415823%2C%22ct%22%3A1752414023%7D;', // ✅ 必须有（搜索要用）
  tabs: [
    {
      name: '影视/剧集',
      ext: {
        id: 'forum-1.htm?page='
      }
    },
    {
      name: '4K专区',
      ext: {
        id: 'forum-12.htm?page='
      }
    },
    {
      name: '动漫区',
      ext: {
        id: 'forum-3.htm?page='
      }
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
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }
    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
      });
    }
  });

  if (cards.length === 0) return jsonify({ list: [] });
  return jsonify({ list: cards });
}

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
      });
    }
  });

  if (cards.length === 0) return jsonify({ list: [] });
  return jsonify({ list: cards });
}

async function getTracks() {
  return jsonify({ list: [] });
}

async function getPlayinfo() {
  return jsonify({ urls: [] });
}
