/**
 * ==============================================================================
 * 适配 wjys.cc (万佳影视) 的最终脚本 (版本 4 - 完整修复版)
 * * 核心修复:
 * 1. getCards 函数内部选择器修正 (V3)。
 * 2. search 函数内部选择器修正，以提高搜索结果的稳定性 (V4 修复)。
 * 3. search 函数中的 URL 构造语法修正 (V3 修复)。
 * 4. getTracks 播放源标题选择器修正 (V4 修复)。
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  'Referer': 'https://www.wjys.cc/',
  'Origin': 'https://www.wjys.cc',
  'User-Agent': UA,
};

// 1. 站点配置
const appConfig = {
  ver: 4, // 版本号更新
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

// 2. 获取卡片列表（首页、分类页）- V3 修复已生效
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
    if (urlPath === '/') {
      return jsonify({ list: [] });
    }
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

// 3. ✅ 搜索功能 - 修正内部选择器
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  // URL 构造语法 V3 已修复
  const searchUrl = `${appConfig.site}/vodsearch/page/${page}/wd/${text}.html`;

  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  $('div.module-search-item').each((_, each) => {
    // ❗ V4 修复点：定位到包含图片和链接的容器，增强稳定性
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

// 4. ✅ 获取播放列表 - 修正播放源标题
async function getTracks(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  let groups = [];

  // 播放源标题
  const sourceTitles = [];
  // ❗ V4 修复点：直接获取 A 标签的文本作为标题
  $('div.module-tab-item.tab-item a').each((_, a) => {
    sourceTitles.push($(a).text().trim());
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

// 5. 获取播放信息 (保持不变)
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.play_url;
  const { data } = await $fetch.get(url, { headers });

  const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
  if (match && match[1]) {
    return jsonify({ urls: [match[1]], ui: 1 });
  }
  return jsonify({ urls: [] });
}
