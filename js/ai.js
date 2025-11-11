/**
 * ==============================================================================
 * 适配 wjys.cc (万佳影视) 的最终脚本 (版本 1)
 * 
 * 功能:
 * - getConfig: 提供站点基本配置和导航标签。
 * - getCards: 获取首页及分类页的影视卡片列表，适配了分页逻辑。
 * - search: 实现关键词搜索功能，并正确处理分页。
 * - getTracks: 从详情页获取所有播放源和剧集列表。
 * - getPlayinfo: 从播放页精准提取 .m3u8 视频流地址。
 * 
 * 核心适配点:
 * 1. 站点信息更新为“万佳影视”及对应域名。
 * 2. 导航栏URL适配为 wjys.cc 的格式。
 * 3. getCards 和 search 函数中的分页URL格式已修正。
 * 4. HTML解析选择器已根据 wjys.cc 的实际结构进行调整。
 * 5. 播放信息提取逻辑确认有效。
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  'Referer': 'https://www.wjys.cc/',
  'Origin': 'https://www.wjys.cc',
  'User-Agent': UA,
};

// 1. 站点配置
const appConfig = {
  ver: 1,
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

// 2. 获取卡片列表（首页、分类页）
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
    if (urlPath === '/') {
      return jsonify({ list: [] }); // 首页不支持分页
    }
    // 适配分类页分页URL格式：/vodtype/dy/page/2.html
    urlPath = urlPath.replace('.html', `/page/${page}.html`);
  }

  const fullUrl = appConfig.site + urlPath;
  const { data } = await $fetch.get(fullUrl, { headers });
  const $ = cheerio.load(data);

  // 使用目标网站的实际选择器 .module-item
  $('div.module-item').each((_, each) => {
    const thumb = $(each).find('a.module-item-pic');
    const titleLink = $(each).find('a.module-item-title');

    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.text().trim(),
      vod_pic: thumb.find('img').attr('data-src'),
      vod_remarks: $(each).find('div.module-item-text').text().trim(),
      ext: { url: thumb.attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// 3. 搜索功能
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  // 适配搜索URL格式：/vodsearch/page/2/wd/关键词.html
  const searchUrl = `<LaTex>${appConfig.site}/vodsearch/page/$</LaTex>{page}/wd/${text}.html`;

  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  // 使用目标网站的实际选择器 .module-search-item
  $('div.module-search-item').each((_, each) => {
    const thumb = $(each).find('a.module-item-pic');
    const titleLink = $(each).find('h3 > a');

    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.text().trim(),
      vod_pic: thumb.find('img').attr('data-src'),
      vod_remarks: $(each).find('a.video-serial').text().trim(),
      ext: { url: thumb.attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// 4. 获取播放列表
async function getTracks(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  let groups = [];

  // 播放源标题
  const sourceTitles = [];
  $('div.module-tab-item.tab-item').each((_, a) => {
    sourceTitles.push($(a).find('span').text().trim());
  });

  // 播放列表容器
  $('div.module-play-list').each((index, box) => {
    const sourceTitle = sourceTitles[index] || `播放源 ${index + 1}`;
    let group = { title: sourceTitle, tracks: [] };

    $(box).find('div.module-play-list-content a').each((_, trackLink) => {
      group.tracks.push({
        name: $(trackLink).text().trim(),
        pan: '',
        ext: { play_url: $(trackLink).attr('href') },
      });
    });

    if (group.tracks.length > 0) groups.push(group);
  });

  return jsonify({ list: groups });
}

// 5. 获取播放信息
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.play_url;
  const { data } = await $fetch.get(url, { headers });

  // 正则表达式匹配 player_aaaa 对象中的 url 属性
  const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
  if (match && match[1]) {
    return jsonify({ urls: [match[1]], ui: 1 });
  }
  return jsonify({ urls: [] });
}
