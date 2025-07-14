const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（自动回帖增强版）',
  site: 'https://www.wpzysq.com',
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=74;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22698dcb85-179f-41e4-8790-8ff6c911b90c%22%2C%22vd%22%3A2%2C%22stt%22%3A6%2C%22dr%22%3A6%2C%22expires%22%3A1752501516%2C%22ct%22%3A1752499716%7D;',
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

function log(msg) {
  try { $log(`[网盘资源社] ${msg}`); } catch (_) {}
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
    headers: { 'User-Agent': UA, 'Cookie': appConfig.cookie },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`请求失败: ${status}`);
    return jsonify({ list: [] });
  }

  const $ = cheerio.load(data);
  const cards = [];
  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    const postId = href.match(/thread-(\d+)/)?.[1] || '';
    if (href && title) {
      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '',
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}`, postId },
      });
    }
  });

  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  log(`加载帖子: ${url}`);

  let { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Cookie': appConfig.cookie },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`请求失败: ${status}`);
    return jsonify({ list: [] });
  }

  if (data.includes('您好，本帖含有特定内容，请回复后再查看。')) {
    log('检测到锁帖提示，尝试自动回帖');

    const formhash = data.match(/name="formhash" value="(.+?)"/)?.[1];
    const fid = data.match(/fid=(\d+)/)?.[1] || '1';
    const tid = url.match(/thread-(\d+)\.htm/)?.[1] || '';

    if (!formhash || !tid) {
      log(`自动回帖失败：formhash=${formhash}, tid=${tid}`);
      return jsonify({ list: [] });
    }

    const ok = await autoReply(formhash, fid, tid);
    if (!ok) {
      log('回帖失败，停止刷新');
      return jsonify({ list: [] });
    }

    log('回帖成功，刷新帖子页面');

    // 允许多次刷新尝试拿新内容
    for (let i = 0; i < 3; i++) {
      const re = await $fetch.get(url, {
        headers: { 'User-Agent': UA, 'Cookie': appConfig.cookie },
        timeout: 10000,
      });
      if (re.status === 200 && !re.data.includes('您好，本帖含有特定内容，请回复后再查看。')) {
        data = re.data;
        log(`刷新成功，已解锁`);
        break;
      }
      log(`第 ${i + 1} 次刷新仍未解锁`);
      await sleep(1000);
    }

    // 最终还没解锁就放弃
    if (data.includes('您好，本帖含有特定内容，请回复后再查看。')) {
      log('多次刷新后仍未解锁，退出');
      return jsonify({ list: [] });
    }
  } else {
    log('未检测到锁帖提示，直接抓取');
  }

  const links = extractPanLinks(data);
  const tracks = links.map(link => ({
    name: '网盘链接',
    pan: link,
    ext: {},
  }));

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function autoReply(formhash, fid, tid) {
  const replyUrl = `${appConfig.site}/forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}&replysubmit=yes&infloat=yes&handlekey=fastpost`;
  const randomTail = Math.random().toString(36).substr(2, 5);
  const body = new URLSearchParams({
    formhash: formhash,
    message: `感谢分享！${randomTail}`,
    replysubmit: 'yes',
    infloat: 'yes',
    handlekey: 'fastpost',
  }).toString();

  log(`回帖数据: ${body}`);

  const { data, status } = await $fetch.post(replyUrl, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `${appConfig.site}/thread-${tid}.htm`,
    },
    body,
    timeout: 10000,
  });

  log(`回帖状态: ${status}`);
  if (status === 200 && data.includes('succeedhandle_fastpost')) {
    log('自动回帖成功 ✅');
    return true;
  } else {
    log(`回帖未成功，返回内容: ${data.slice(0, 200)}`);
    return false;
  }
}

function extractPanLinks(html) {
  const $ = cheerio.load(html);
  const realLinks = [];
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    if (
      href &&
      /(pan|drive|aliyun|baidu|quark|lanzou|cloud)/.test(href) &&
      href.startsWith('http') &&
      href.length > 30
    ) {
      realLinks.push(href);
    }
  });
  return [...new Set(realLinks)];
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = Math.max(1, parseInt(ext.page) || 1);

  if (!text) return jsonify({ list: [] });

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;
  log(`搜索: ${url}`);

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Cookie': appConfig.cookie },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [] });

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
        ext: { url: `${appConfig.site}/${href}` },
      });
    }
  });

  return jsonify({ list: cards });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
