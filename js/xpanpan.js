const appConfig = {
  ver: 1,
  title: '网盘资源社',
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
  ],
};

// 获取配置信息
async function getConfig() {
  return jsonify(appConfig);
}

// 获取分类页面的卡片信息
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;

  try {
    const { data, status } = await $fetch.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });

    if (status !== 200) {
      console.error(`Failed to fetch data from ${url}, status: ${status}`);
      return jsonify({ list: [] });
    }

    const $ = createCheerio().load(data);
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
          ext: { url: `${appConfig.site}/${href}`, postId: href.match(/thread-(\d+)/)?.[1] || '' },
        });
      }
    });

    return jsonify({ list: cards });
  } catch (error) {
    console.error(`Error fetching cards: ${error.message}`);
    return jsonify({ list: [] });
  }
}

// 搜索功能
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);
  if (!text) return jsonify({ list: [], page: 1, pagecount: 1 });

  const api = `http://192.168.10.111:3000/api/search?keyword=${encodeURIComponent(text)}&page=${page}`;

  try {
    const { data, status } = await $fetch.get(api, { timeout: 20000 });
    if (status !== 200) {
      console.error(`Failed to fetch search results from ${api}, status: ${status}`);
      return jsonify({ list: [], page: 1, pagecount: 1 });
    }

    return jsonify(data);
  } catch (error) {
    console.error(`Error fetching search results: ${error.message}`);
    return jsonify({ list: [], page: 1, pagecount: 1 });
  }
}

// 获取资源链接
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const api = `http://192.168.10.111:3000/api/getTracks?url=${encodeURIComponent(url)}`;

  try {
    const { data, status } = await $fetch.get(api, { timeout: 20000 });
    if (status !== 200) {
      console.error(`Failed to fetch tracks from ${api}, status: ${status}`);
      return jsonify({ list: [] });
    }

    return jsonify(data);
  } catch (error) {
    console.error(`Error fetching tracks: ${error.message}`);
    return jsonify({ list: [] });
  }
}

// 获取播放信息（示例中未实现具体逻辑）
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
