/**
 * 【Discuz! TVBox 完整版】
 * - 分类格式和原始完全一致，保证加载正常
 * - 搜索和列表请求均带 Cookie（需要你填）
 * - 封面支持，避免重复
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（登录态版）',
  site: 'https://www.wpzysq.com',
  
  // ==== 【这里必须填你的有效登录 Cookie】====
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=64;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22a7268045-fca9-47ce-8455-ac5e1c70f2f2%22%2C%22vd%22%3A2%2C%22stt%22%3A498%2C%22dr%22%3A498%2C%22expires%22%3A1752464945%2C%22ct%22%3A1752463145%7D;',
  
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm?page=' }, // 分类ID请保持和站点一致
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

// 获取分类配置
async function getConfig() {
  return jsonify(appConfig);
}

// 获取分类分页列表
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,      // 【这里必须带上Cookie】
      'Referer': appConfig.site,       // 推荐带上Referer
    },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href')?.trim();
    const title = $(el).find('a').text().trim();

    if (!href || !title) return;

    // 获取封面，如果有
    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }

    // 去重（谨防重复）
    if (list.find(item => item.vod_id === href)) return;

    list.push({
      vod_id: href,
      vod_name: title,
      vod_pic: pic,
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    });
  });

  return jsonify({ list });
}

// 搜索功能
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = 1; // 搜索只返回第一页，避免无限循环

  if (!text) return jsonify({ list: [], page: 1, pagecount: 1 });

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}`;

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,      // 【这里必须带上Cookie】
      'Referer': appConfig.site,
    },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [], page: 1, pagecount: 1 });

  const $ = cheerio.load(data);
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href')?.trim();
    const title = $(el).find('a').text().trim();

    if (!href || !title) return;
    if (list.find(item => item.vod_id === href)) return;

    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }

    list.push({
      vod_id: href,
      vod_name: title,
      vod_pic: pic,
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    });
  });

  // 固定只返回一页，防止无限翻页
  return jsonify({ list, page: 1, pagecount: 1 });
}

// 详情页接口（需要后端自动回帖的可接入你的代理）
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // TODO: 如果有后端代理自动回帖，可以写代理地址
  // 纯前端时，只能返回空或手动解锁内容
  return jsonify({ list: [] });
}

// 播放信息占位
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
