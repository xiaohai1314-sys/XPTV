const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = require('cheerio'); // 如果是平台内置请换成 createCheerio()

const appConfig = {
  ver: 1,
  title: '网盘资源社',
  site: 'https://www.wpzysq.com',
  cookie: 'cookie_test=Gh_2Bfke4QdQEdAGJsZYM5dpa4WBLjlNy8D1XkutgFus5h9alm;bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=26;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%226c0c2ab0-47d6-4c53-a0c1-94866b143a21%22%2C%22vd%22%3A5%2C%22stt%22%3A18%2C%22dr%22%3A1%2C%22expires%22%3A1752370849%2C%22ct%22%3A1752369049%7D;', // ← 请替换成你自己的登录 Cookie
  tabs: [
    { name: '影视/剧集', ext: { id: 'forum-1.htm?page=' } },
    { name: '4K专区', ext: { id: 'forum-12.htm?page=' } },
    { name: '动漫区', ext: { id: 'forum-3.htm?page=' } },
  ],
};

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
      'Cookie': appConfig.cookie,
    },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const cards = [];
  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    const postId = href?.match(/thread-(\d+)/)?.[1] || '';
    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '',
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
  let { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
    },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`帖子请求失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  if (data.includes('您好，本贴含有特定内容，请回复后再查看')) {
    log('检测到需要回复，开始自动回复...');
    const replySuccess = await autoReply(url, appConfig.cookie, data);
    if (!replySuccess) {
      log('自动回复失败');
      return jsonify({ list: [] });
    }

    log('自动回复成功，等待页面刷新...');
    await waitForPageRefresh(3000);

    log('重新加载帖子详情...');
    const res = await $fetch.get(url, {
      headers: {
        'User-Agent': UA,
        'Cookie': appConfig.cookie,
      },
      timeout: 10000,
    });
    data = res.data;
  }

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

function extractPanLinks(html) {
  const quarkRegex = /https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+/g;
  const aliyunRegex = /https?:\/\/(?:www\.)?aliyundrive\.com\/s\/[a-zA-Z0-9]+/g;

  const quarkMatches = html.match(quarkRegex) || [];
  const aliyunMatches = html.match(aliyunRegex) || [];

  log(`夸克网盘链接: ${quarkMatches.length}`);
  log(`阿里云盘链接: ${aliyunMatches.length}`);

  return quarkMatches.concat(aliyunMatches);
}

async function autoReply(postUrl, cookie, html) {
  const { formhash, fid, tid } = extractFormhashAndIds(html, postUrl);
  if (!formhash || !fid || !tid) {
    log('自动回复: 缺少 formhash / fid / tid');
    return false;
  }

  const replyUrl = `${appConfig.site}/forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}&replysubmit=yes&infloat=yes&handlekey=fastpost`;

  const replyData = {
    formhash,
    message: '感谢楼主分享！',
    replysubmit: 'yes',
  };

  const { status } = await $fetch.post(replyUrl, {
    headers: {
      'User-Agent': UA,
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(replyData).toString(),
    timeout: 10000,
  });

  return status === 200;
}

function extractFormhashAndIds(html, postUrl) {
  const formhashMatch = html.match(/name="formhash" value="(.+?)"/);
  const fidMatch = html.match(/fid=(\d+)/);
  const tidMatch = postUrl.match(/thread-(\d+)-/) || html.match(/tid=(\d+)/);

  return {
    formhash: formhashMatch ? formhashMatch[1] : '',
    fid: fidMatch ? fidMatch[1] : '',
    tid: tidMatch ? tidMatch[1] : '',
  };
}

function waitForPageRefresh(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
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
      'Cookie': appConfig.cookie,
    },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`搜索失败: HTTP ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const cards = [];
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
