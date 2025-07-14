/**
 * 【网盘资源社 TVBox 完整脚本】
 * - 分类结构完全一致（论坛原始格式）
 * - 列表分页正常
 * - 搜索只拉一页，锁死翻页，去重防重复
 * - 支持登录Cookie
 * - 封面抓取（帖子列表内的图片）
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社（锁死搜索完整版）',
  site: 'https://www.wpzysq.com',    // TODO: 你的网站域名，带https://
  cookie: 'bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=LPuPN4pJ4Bamk_2B8KJmGgHdh4moFy3UK_2BgfbFFgqeS8UuSRIfpWhtx75xj3AhcenM6a_2B6gpiqj8WPO9bJI5cQyOBJfM0_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=64;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%22a7268045-fca9-47ce-8455-ac5e1c70f2f2%22%2C%22vd%22%3A2%2C%22stt%22%3A498%2C%22dr%22%3A498%2C%22expires%22%3A1752464945%2C%22ct%22%3A1752463145%7D;',                       // TODO: 登录后复制有效Cookie，搜索登录必填，否则留空
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm?page=' },  // TODO: 分类ID，保持和站点一致
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

// 获取列表，支持分页
async function getCards(ext) {
  ext = argsify(ext);
  const page = ext.page || 1;
  const id = ext.id;
  const url = `${appConfig.site}/${id}${page}`;

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Cookie': appConfig.cookie },
    timeout: 10000,
  });

  if (status !== 200) return jsonify({ list: [] });

  const $ = cheerio.load(data);
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href')?.trim();
    const title = $(el).find('a').text().trim();

    // 抓封面图
    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }

    if (href && title) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    }
  });

  return jsonify({ list });
}

// 搜索接口 - 只请求第一页，锁死分页，去重防止重复
async function search(ext) {
  ext = argsify(ext);
  const keyword = ext.text?.trim() || '';
  if (!keyword) return jsonify({ list: [], page: 1, pagecount: 1 });

  // 搜索URL不带分页参数，确保只请求第一页
  const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(keyword)}`;

  const { data, status } = await $fetch.get(url, {
    headers: { 'User-Agent': UA, 'Cookie': appConfig.cookie },
    timeout: 10000,
  });
  if (status !== 200) return jsonify({ list: [], page: 1, pagecount: 1 });

  const $ = cheerio.load(data);
  const list = [];

  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href')?.trim();
    const title = $(el).find('a').text().trim();

    // 抓封面图
    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http')) {
      pic = pic.startsWith('/') ? `${appConfig.site}${pic}` : `${appConfig.site}/${pic}`;
    }

    // 去重
    if (href && title && !list.find(x => x.vod_id === href)) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    }
  });

  return jsonify({ list, page: 1, pagecount: 1 });
}

// 详情页资源列表 - 需要配合后端 Puppeteer 代理解析
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // TODO: 这里换成你的Puppeteer代理地址，确保能解析详情页资源
  const api = `http://你的服务器IP:3000/api/getTracks?url=${encodeURIComponent(url)}`;

  const { data, status } = await $fetch.get(api, { timeout: 20000 });
  if (status !== 200) return jsonify({ list: [] });

  return jsonify(data);
}

// 播放信息占位，通常不需要修改
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
