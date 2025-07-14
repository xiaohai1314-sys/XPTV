const appConfig = {
  ver: 1,
  title: '网盘资源社',
  site: 'https://www.wpzysq.com',
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm' },
    },
    {
      name: '4K专区',
      ext: { id: 'forum-12.htm' },
    },
    {
      name: '动漫区',
      ext: { id: 'forum-3.htm' },
    },
  ],
};

async function getConfig() {
  return jsonify(appConfig);
}

// 修复分类重复问题
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  
  const api = `http://localhost:3000/api/category?id=${encodeURIComponent(id)}&page=${page}`;

  const { data, status } = await $fetch.get(api, { timeout: 30000 });
  if (status !== 200) return jsonify({ list: [] });
  
  return jsonify(data);
}

// 修复搜索功能
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);
  if (!text) return jsonify({ list: [] });

  const api = `http://192.168.10.111:3000/api/search?keyword=${encodeURIComponent(text)}&page=${page}`;

  const { data, status } = await $fetch.get(api, { timeout: 30000 });
  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

// 修复网盘链接提取
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const api = `http://192.168.10.111:3000/api/getTracks?url=${encodeURIComponent(url)}`;

  const { data, status } = await $fetch.get(api, { timeout: 30000 });
  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

async function getPlayinfo() {
  return jsonify({ urls: [] });
}
