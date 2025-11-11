/**
 * ==============================================================================
 * 适配 wjys.cc (万佳影视) 的最终脚本 (版本 11 - 借鉴真狼的索引匹配结构)
 * * 核心修正:
 * 1. 彻底放弃复杂的 ID 匹配，回归到标题和内容面板的 **索引匹配结构** (V11 修复)。
 * 2. 保证播放源标题和内容面板 (`div.module-tab-content`) 的索引严格同步。
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  'Referer': 'https://www.wjys.cc/',
  'Origin': 'https://www.wjys.cc',
  'User-Agent': UA,
};

// 1. 站点配置 (保持不变)
const appConfig = {
  ver: 11, // 版本号更新
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

// 3. 搜索功能 (保持不变)
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

// 4. ✅ 获取播放列表 - 修正结构，使用索引匹配
async function getTracks(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  let groups = [];

  // 1. 获取所有播放源标题容器 (即每个播放源的头部标签)
  const titleBoxes = $('div.module-tab-item.tab-item');
  
  // 2. 获取所有内容面板 (剧集列表)
  const contentBoxes = $('div.module-tab-content'); 

  // 3. 循环标题容器，使用索引与内容面板匹配
  titleBoxes.each((index, titleBox) => {
    const titleLink = $(titleBox).find('a');
    const sourceTitle = titleLink.text().trim() || `播放源 ${index + 1}`;
    
    // ❗ 核心：根据索引获取对应的内容面板
    const contentBox = $(contentBoxes[index]);
    
    // 如果没有找到内容面板，或者内容为空，则跳过
    if (!contentBox.length) return;

    const group = { title: sourceTitle, tracks: [] };
    
    // 在内容面板内找到剧集/电影链接（使用源码中最准确的类名）
    contentBox.find('a.module-play-list-link').each((_, trackLink) => {
      if ($(trackLink).attr('href')) {
        group.tracks.push({
          name: $(trackLink).text().trim(),
          pan: '',
          ext: { play_url: $(trackLink).attr('href') },
        });
      }
    });

    if (group.tracks.length > 0) {
        groups.push(group);
    }
  });
  
  // 兜底逻辑：适用于没有 Tab 结构的简单电影页面
  if (groups.length === 0) {
      const fallbackTracks = [];
      // 仍然使用最准确的链接选择器，但不限制容器
      $('a.module-play-list-link').each((_, trackLink) => {
          if ($(trackLink).attr('href')) {
              fallbackTracks.push({
                  name: $(trackLink).text().trim(),
                  pan: '',
                  ext: { play_url: $(trackLink).attr('href') },
              });
          }
      });
      if (fallbackTracks.length > 0) {
          groups.push({ title: '默认线路', tracks: fallbackTracks });
      }
  }

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
