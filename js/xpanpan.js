/**
 * Discuz! TVBox 插件 完整版
 * - 分类结构和你原脚本完全一致（tabs里的id格式没变）
 * - 搜索只返回第一页，防止死循环
 * - 列表、搜索请求均带登录Cookie
 * - 支持封面抓取（如有）
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（稳定登录版）',
  site: 'https://www.wpzysq.com',

  // ==== 【这里填写你的有效登录 Cookie】====
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=64;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22a7268045-fca9-47ce-8455-ac5e1c70f2f2%22%2C%22vd%22%3A2%2C%22stt%22%3A498%2C%22dr%22%3A498%2C%22expires%22%3A1752464945%2C%22ct%22%3A1752463145%7D;',

  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm?page=' }, // 分类ID格式保持原样，不能改！
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

// 分类分页列表
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
      'Referer': appConfig.site,
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

    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }

    // 防重复
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

// 搜索，只返回第1页防止死循环
async function search(ext) {
  ext = argsify(ext);
  const keyword = ext.text || '';
  if (!keyword) return jsonify({ list: [], page: 1, pagecount: 1 });

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(keyword)}`;

  const { data, status } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Cookie': appConfig.cookie,
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

  // 固定返回第一页，避免无限翻页
  return jsonify({ list, page: 1, pagecount: 1 });
}

// 详情页获取（目前留空，或根据你需求对接自动回帖后端）
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // TODO: 这里对接你自己的自动回帖后端API地址，或者前端无法拿到被锁资源
  return jsonify({ list: [] });
}

// 播放信息占位
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
