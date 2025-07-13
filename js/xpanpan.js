/**
 * 【方案 A 加强版】
 * Discuz! 自动回帖可见 — 分类结构完全一致版
 * =============================================
 * - 分类格式完全和最初一致
 * - formhash 实时抓
 * - message 随机防刷
 * - 回帖后最多刷新 5 次
 * - sleep 防频率封
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（方案A加强版）',
  site: 'https://www.wpzysq.com',
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=35;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22389b0524-8c85-4073-ae4d-48c20c6f1d52%22%2C%22vd%22%3A7%2C%22stt%22%3A2778%2C%22dr%22%3A35%2C%22expires%22%3A1752415823%2C%22ct%22%3A1752414023%7D;', // 必须换！
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

  log(`访问帖子: ${url}`);

  let { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Cookie': appConfig.cookie },
    timeout: 10000,
  });

  if (status !== 200) {
    log(`请求失败: ${status}`);
    return jsonify({ list: [] });
  }

  if (data.includes('您好，本帖含有特定内容，请回复后再查看。')) {
    log('检测到锁帖，尝试自动回帖');

    const formhash = data.match(/name="formhash" value="(.+?)"/)?.[1];
    const fid = data.match(/fid=(\d+)/)?.[1] || '1';
    const tid = url.match(/thread-(\d+)\.htm/)?.[1] || '';

    if (!formhash || !tid) {
      log(`自动回帖失败：formhash=${formhash}, tid=${tid}`);
      return jsonify({ list: [] });
    }

    const ok = await autoReply(formhash, fid, tid, url);
    if (!ok) {
      log('回帖失败，停止');
      return jsonify({ list: [] });
    }

    for (let i = 0; i < 5; i++) {
      await sleep(2000);
      log(`第 ${i + 1} 次尝试刷新...`);
      const re = await $fetch.get(url, {
        headers: { 'User-Agent': UA, 'Cookie': appConfig.cookie },
        timeout: 10000,
      });
      if (re.status === 200 && !re.data.includes('您好，本帖含有特定内容，请回复后再查看。')) {
        data = re.data;
        log('✅ 刷新后已解锁');
        break;
      } else {
        log(`仍未解锁`);
      }
    }

    if (data.includes('您好，本帖含有特定内容，请回复后再查看。')) {
      log('多次刷新仍未解锁，退出');
      return jsonify({ list: [] });
    }
  } else {
    log('页面已解锁，直接抓取');
  }

  const links = extractPanLinks(data);
  const tracks = links.map(link => ({
    name: '网盘链接',
    pan: link,
    ext: {},
  }));

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function autoReply(formhash, fid, tid, referer) {
  const replyUrl = `${appConfig.site}/forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}&replysubmit=yes&infloat=yes&handlekey=fastpost`;
  const rand = `感谢分享！${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const body = new URLSearchParams({
    formhash: formhash,
    message: rand,
    replysubmit: 'yes',
    infloat: 'yes',
    handlekey: 'fastpost',
  }).toString();

  const { data, status } = await $fetch.post(replyUrl, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': referer,
      'Origin': appConfig.site,
    },
    body,
    timeout: 10000,
  });

  log(`回帖状态: ${status}`);
  if (status === 200 && data.includes('succeedhandle_fastpost')) {
    log(`回帖成功 ✅`);
    return true;
  } else {
    log(`回帖失败，返回内容: ${data.slice(0, 200)}`);
    return false;
  }
}

function extractPanLinks(html) {
  const $ = cheerio.load(html);
  const links = [];
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    if (
      href &&
      href.startsWith('http') &&
      /(pan|drive|aliyun|baidu|quark|lanzou|cloud)/.test(href) &&
      href.length > 30
    ) {
      links.push(href);
    }
  });
  return [...new Set(links)];
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
