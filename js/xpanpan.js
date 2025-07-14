/**
 * 【Discuz! 完整版】TVBox 分类+搜索（无死循环）
 * - 分类格式 100% 保留
 * - 搜索永远只返回 1 页
 * - 单结果也不重复
 * - 支持封面
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（完整一刀切）',
  site: 'https://www.wpzysq.com',
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=64;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22a7268045-fca9-47ce-8455-ac5e1c70f2f2%22%2C%22vd%22%3A2%2C%22stt%22%3A498%2C%22dr%22%3A498%2C%22expires%22%3A1752464945%2C%22ct%22%3A1752463145%7D;', // 如果走前端，留空
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

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
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

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = 1; // 搜索只要第一页

  if (!text) return jsonify({ list: [], page: 1, pagecount: 1 });

  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}`;
  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [], page: 1, pagecount: 1 });

  const $ = cheerio.load(data);
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href')?.trim();
    const title = $(el).find('a').text().trim();

    if (!href || !title) return;

    // 避免重复：看是否已存在
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

  // 关键：搜索页只返回一页，防止 TVBox 自动翻页死循环
  return jsonify({ list, page: 1, pagecount: 1 });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // 这里留空 => 纯前端没 Puppeteer 代理时，只能抓已解锁内容
  // 如果需要自动回帖，需改成调用你的 Puppeteer 后端
  return jsonify({ list: [] });
}

async function getPlayinfo() {
  return jsonify({ urls: [] });
}
