const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社',
  site: 'https://www.wpzysq.com',
  cookie: 'bbs_sid=e38l80spcgnafbi1lss7v1r345; __mxau__c1-WWwEoLo0=3f12f674-b707-418a-bb0e-5dfbaa51b8b7; __mxaf__c1-WWwEoLo0=1752288379; bbs_token=QZA31B9BZ8CLeeTC8y9Z9qnjfr2hndnHL7JQP8F61oQ91ls4SIXqwfvLvSCXCcKxEkyJXqMttbc1bEt2_2BQztNjjyR8Q_3D; __mxas__c1-WWwEoLo0=%7B%22sid%22%3A%227507edde-c2cc-4fee-8366-7d3a05d32aad%22%2C%22vd%22%3A2%2C%22stt%22%3A81%2C%22dr%22%3A81%2C%22expires%22%3A1752326274%2C%22ct%22%3A1752324474%7D; __mxav__c1-WWwEoLo0=89', // 替换为你的 cookie
  tabs: [
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
  ],
};

// 调试日志
function log(msg) {
  try {
    $log(`[网盘资源社] ${msg}`);
  } catch (_) {}
}

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;
  log(`抓取列表: ${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie, // 使用 cookie
    },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  let cards = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    const postId = href.match(/thread-(\d+)/)?.[1] || '';

    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '', // 没有缩略图时可为空
        vod_remarks: '',
        ext: {
          url: `${appConfig.site}/${href}`,
          postId: postId,
        },
      });
    }
  });

  log(`解析到 ${cards.length} 条帖子`);
  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  log(`加载帖子详情: ${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie, // 使用 cookie
    },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`帖子请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  // 检查是否需要回复
  if (data.includes('本贴含有特定内容，请回复后再查看')) {
    log('检测到需要回复，自动回复中...');
    const replySuccess = await autoReply(ext);
    if (!replySuccess) {
      log('自动回复失败');
      return jsonify({ list: [] });
    }
    log('自动回复成功，重新加载帖子详情');
    const { data: newData, status: newStatus } = await $fetch.get(url, {
      headers: {
        'User-Agent': UA,
        'Cookie': appConfig.cookie, // 使用 cookie
      },
      timeout: 10000,
    });
    if (newStatus !== 200) {
      log(`帖子重新加载失败: HTTP ${newStatus}`);
      return jsonify({ list: [] });
    }
    data = newData;
  }

  // 提取网盘链接
  const links = extractPanLinks(data);
  const tracks = links.map(link => ({
    name: "网盘链接",
    pan: link,
    ext: {},
  }));

  return jsonify({
    list: [
      {
        title: "资源列表",
        tracks: tracks,
      },
    ],
  });
}

async function autoReply(ext) {
  const { url, postId } = ext;
  const replyContent = [
    '感谢楼主的分享！',
    '资源太棒了，感谢分享！',
    '非常需要这个资源，感谢！'
  ][Math.floor(Math.random() * 3)]; // 随机选择一条回复内容

  const replyUrl = `${appConfig.site}/reply.htm?tid=${postId}`;
  const replyData = {
    message: replyContent,
    submit: '发表回复',
  };

  const { status } = await $fetch.post(replyUrl, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie, // 使用 cookie
    },
    body: replyData,
    timeout: 10000,
  });

  return status === 200;
}

function extractPanLinks(html) {
  const linkRegex = /(https?:\/\/[^\s'"]+)/g;
  const matches = html.match(linkRegex) || [];

  return matches.filter(link =>
    (link.includes('quark.cn') || link.includes('aliyundrive.com'))
  );
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);

  if (!text) {
    log("无关键词");
    return jsonify({ list: [] });
  }

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;
  log(`搜索: ${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie, // 使用 cookie
    },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`搜索失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  let cards = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '',
        vod_remarks: '',
        ext: {
          url: `${appConfig.site}/${href}`,
        },
      });
    }
  });

  return jsonify({ list: cards });
}
