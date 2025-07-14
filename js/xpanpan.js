/**
 * 【网盘资源社】前端 JS
 * - 配套严格后端
 * - 分类格式按你的要求
 * - 搜索调用本地后端
 */

const appConfig = {
  ver: 1,
  title: '网盘资源社（完全版）',
  site: 'https://www.wpzysq.com',
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
    // 如果有更多区，自行按格式添加
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
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  });
  if (status !== 200) return jsonify({ list: [] });

  const $ = createCheerio().load(data);
  const cards = [];

  $('li[data-href^="thread-"]').each((_, el) => {
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

  return jsonify({ list: cards });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);
  if (!text) return jsonify({ list: [] });

  const url = `http://192.168.1.6:3000/api/search?keyword=${encodeURIComponent(text)}&page=${page}`;

  const { data, status } = await $fetch.get(url, { timeout: 20000 });
  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

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
