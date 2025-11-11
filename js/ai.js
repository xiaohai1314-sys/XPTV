/**
 * ==============================================================================
 * 适配 wjys.cc (万佳影视) 的最终脚本 (版本 5 - 线路过滤增强版)
 *
 * ✅ 核心修复内容：
 * 1. 修复播放源提取结构（基于 #glist-ID 对应关系）
 * 2. 排除“下载观看”、“迅雷下载”等无效线路
 * 3. 保留 V4 中所有搜索、卡片、播放修复逻辑
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  'Referer': 'https://www.wjys.cc/',
  'Origin': 'https://www.wjys.cc',
  'User-Agent': UA,
};

// 1️⃣ 基本配置
const appConfig = {
  ver: 5,
  title: "万佳影视",
  site: "https://www.wjys.cc",
  tabs: [
    { name: '首页', ext: { url: '/' } },
    { name: '电影', ext: { url: '/vodtype/dy.html' } },
    { name: '剧集', ext: { url: '/vodtype/juji.html' } },
    { name: '综艺', ext: { url: '/vodtype/zongyi.html' } },
    { name: '动漫', ext: { url: '/vodtype/dongman.html' } }
  ]
};

async function getConfig() {
  return jsonify(appConfig);
}

// 2️⃣ 首页 & 分类卡片
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
    if (urlPath === '/') return jsonify({ list: [] });
    urlPath = urlPath.replace('.html', `/page/${page}.html`);
  }

  const fullUrl = appConfig.site + urlPath;
  const { data } = await $fetch.get(fullUrl, { headers });
  const $ = cheerio.load(data);

  $('div.module-list div.module-item').each((_, each) => {
    const picContainer = $(each).find('div.module-item-pic');
    const thumbLink = picContainer.find('a');
    const pic = picContainer.find('img').attr('data-src');
    const titleLink = $(each).find('a.module-item-title');

    if (pic) {
      cards.push({
        vod_id: thumbLink.attr('href'),
        vod_name: titleLink.text().trim(),
        vod_pic: pic,
        vod_remarks: $(each).find('div.module-item-text').text().trim(),
        ext: { url: thumbLink.attr('href') },
      });
    }
  });

  return jsonify({ list: cards });
}

// 3️⃣ 搜索功能
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const searchUrl = `${appConfig.site}/vodsearch/page/${page}/wd/${text}.html`;
  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  $('div.module-search-item').each((_, each) => {
    const picContainer = $(each).find('div.module-item-pic');
    const thumb = picContainer.find('a');
    const titleLink = $(each).find('h3 > a');
    const pic = picContainer.find('img').attr('data-src');

    if (pic) {
      cards.push({
        vod_id: thumb.attr('href'),
        vod_name: titleLink.text().trim(),
        vod_pic: pic,
        vod_remarks: $(each).find('a.video-serial').text().trim(),
        ext: { url: thumb.attr('href') },
      });
    }
  });

  return jsonify({ list: cards });
}

// 4️⃣ 播放线路提取 - ✅ V5 修正版
async function getTracks(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  let groups = [];

  // 提取线路标题并与 #glist 对应
  $('div.module-tab-item.tab-item').each((index, el) => {
    const title = $(el).text().trim() || `线路${index + 1}`;

    // 🚫 排除“下载观看”、“迅雷下载”等线路
    if (/下载|迅雷/i.test(title)) return;

    const listId = `#glist-${index + 1}`;
    const tracks = [];

    // 匹配对应播放列表
    $(`${listId} a.module-play-list-link`).each((_, link) => {
      const name = $(link).text().trim();
      const href = $(link).attr('href');
      if (href) {
        tracks.push({
          name,
          pan: '',
          ext: { play_url: href },
        });
      }
    });

    if (tracks.length > 0) {
      groups.push({
        title,
        tracks,
      });
    }
  });

  return jsonify({ list: groups });
}

// 5️⃣ 获取播放信息
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.play_url;
  const { data } = await $fetch.get(url, { headers });

  const match = data.match(/var player_aaaa\s*=\s*{[^}]*url\s*:\s*['"]([^'"]+)['"]/);
  if (match && match[1]) {
    return jsonify({ urls: [match[1]], ui: 1 });
  }
  return jsonify({ urls: [] });
}
