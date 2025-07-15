const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();
const site = 'http://192.168.1.6:3000/api'; // 你本地后端地址

const tabs = [
  {
    name: '影视/剧集',
    ext: {
      id: 'forum-1.htm?page=',
    },
  },
  {
    name: '4K专区',
    ext: {
      id: 'forum-12.htm?page=',
    },
  },
  {
    name: '动漫区',
    ext: {
      id: 'forum-3.htm?page=',
    },
  },
];

// ✅ 插件配置信息
async function getConfig() {
  return jsonify({
    ver: 1,
    title: '网盘资源社（走本地后端）',
    tabs: tabs
  });
}

// ✅ 分类页：走后端 /api/vod
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${site}/vod?type_id=${id}&page=${page}`;
  $log(`[分类] 请求：${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    timeout: 10000
  });

  if (status !== 200) {
    $log(`[分类] 失败：HTTP ${status}`);
    return jsonify({ list: [] });
  }

  let json;
  try {
    json = JSON.parse(data);
  } catch (e) {
    $log('[分类] JSON 解析失败');
    return jsonify({ list: [] });
  }

  return jsonify({ list: json.list || [] });
}

// ✅ 详情页：走后端 /api/detail
async function getTracks(ext) {
  ext = argsify(ext);
  const { vod_id } = ext;
  const url = `${site}/detail?id=${vod_id}`;
  $log(`[详情] 请求：${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    timeout: 10000
  });

  if (status !== 200) {
    $log(`[详情] 失败：HTTP ${status}`);
    return jsonify({ list: [] });
  }

  let json;
  try {
    json = JSON.parse(data);
  } catch (e) {
    $log('[详情] JSON 解析失败');
    return jsonify({ list: [] });
  }

  const item = json.list?.[0];
  if (!item || !item.vod_play_url) {
    return jsonify({ list: [] });
  }

  return jsonify({
    list: [
      {
        title: item.vod_name,
        tracks: [
          {
            name: "网盘链接",
            pan: item.vod_play_url,
            ext: {}
          }
        ]
      }
    ]
  });
}

// ✅ 搜索：走后端 /api/search
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) {
    $log('[搜索] 无关键词');
    return jsonify({ list: [] });
  }

  const url = `${site}/search?keyword=${encodeURIComponent(text)}`;
  $log(`[搜索] 请求：${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    timeout: 10000
  });

  if (status !== 200) {
    $log(`[搜索] 失败：HTTP ${status}`);
    return jsonify({ list: [] });
  }

  let json;
  try {
    json = JSON.parse(data);
  } catch (e) {
    $log('[搜索] JSON 解析失败');
    return jsonify({ list: [] });
  }

  return jsonify({ list: json.list || [] });
}

// ✅ 播放（空实现）
async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}
