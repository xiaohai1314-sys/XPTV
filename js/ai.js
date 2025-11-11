/**
 * ==============================================================================
 * 适配 wjys.cc (万佳影视) 的最终脚本 (版本 7 - 详情页双重代理版)
 * * 核心逻辑: 
 * 1. getTracks (详情页): 访问 wjys.cc 详情页，解析出跳转链接。
 * 然后，请求跳转链接 (158699.xyz)，并解析该页面的真实播放列表。
 * 2. getPlayinfo: 保持不变，解析目标站 (158699.xyz) 的播放数据。
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  // 注意：Referer 仍然是 wjys.cc，以防跳转站校验
  'Referer': 'https://www.wjys.cc/',
  'Origin': 'https://www.wjys.cc',
  'User-Agent': UA,
};

// 1. 站点配置 (保持不变)
const appConfig = {
  ver: 7, // 版本号更新
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

// 2. 获取卡片列表（首页、分类页）- 保持不变
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

// 3. 搜索功能 - 保持不变
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

// 4. ✅ 获取播放列表 (详情页) - V7 核心重构版
async function getTracks(ext) {
  ext = argsify(ext);
  let groups = [];
  
  // ===================================
  // 步骤 1: 访问 wjys.cc 详情页，获取跳转 URL
  // ===================================
  const wjysUrl = appConfig.site + ext.url; 
  let { data: wjysData } = await $fetch.get(wjysUrl, { headers });
  let $ = cheerio.load(wjysData);

  // 关键代码：找到第一个播放列表容器和里面的第一个跳转链接
  const firstPlayList = $('div.module-player-list.tab-list').first();
  const firstTrackLink = firstPlayList.find('div.scroll-content a').first();
  const jumpUrl = firstTrackLink.attr('href'); 

  if (!jumpUrl) {
      // 找不到跳转链接，返回空
      return jsonify({ list: [] });
  }

  // ===================================
  // 步骤 2: 访问目标站 (e.g. 158699.xyz) 详情页，解析真实列表
  // ===================================
  const targetUrl = jumpUrl;
  const { data: targetData } = await $fetch.get(targetUrl, { headers });
  $ = cheerio.load(targetData); // 重新加载 cheerio，现在 $ 作用于目标站

  // ************ 目标站 (158699.xyz) 的解析逻辑 ************

  // 1. 获取播放源标题
  const sourceTitles = [];
  $('div.module-tab.module-player-tab div.module-tab-item.tab-item > span').each((_, span) => {
    sourceTitles.push($(span).text().trim());
  });

  // 2. 获取播放列表
  $('div.module-player-list.tab-list').each((index, box) => {
    const sourceTitle = sourceTitles[index] || `播放源 ${index + 1}`;
    let group = { title: sourceTitle, tracks: [] };

    $(box).find('div.scroll-content a').each((_, trackLink) => {
      const trackName = $(trackLink).find('span').text().trim();
      const playUrl = $(trackLink).attr('href'); // 目标站的播放页链接

      if (playUrl && trackName) {
        group.tracks.push({
          name: trackName, 
          pan: '',
          ext: { play_url: playUrl }, // 存储目标站的播放页 URL
        });
      }
    });

    if (group.tracks.length > 0) groups.push(group);
  });
  
  // ===================================
  // 步骤 3: 返回解析出的真实列表
  // ===================================
  return jsonify({ list: groups });
}


// 5. ✅ 获取播放信息 (播放页) - V7 逻辑
async function getPlayinfo(ext) {
  ext = argsify(ext);
  
  // ext.play_url 是从目标站 (e.g., 158699.xyz) 详情页解析出来的播放页链接
  
  // 找到目标站的域名，用于拼接相对路径
  let domainMatch = ext.play_url.match(/^(https?:\/\/[^\/]+)/);
  // ⚠️ 假设目标站的播放页链接是相对路径（e.g., /vodplay/123-1-1.html）
  // 如果 ext.play_url 已经是完整链接，domainMatch 可能为空，我们从 jumpUrl 的域名获取
  let domain = 'https://' + new URL(ext.play_url.startsWith('http') ? ext.play_url : appConfig.site).hostname;
  
  // 确保 play_url 是一个完整的 URL。如果它是相对路径，需要拼接。
  const url = ext.play_url.startsWith('http') ? ext.play_url : domain + ext.play_url;
  
  // 使用 wjys.cc 作为 Referer
  const { data } = await $fetch.get(url, { headers });

  // 正则表达式匹配目标站 (如 158599.xyz) 的播放数据
  const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
  
  if (match && match[1]) {
    // 匹配到 .m3u8 链接
    return jsonify({ urls: [match[1]], ui: 1 });
  }
  return jsonify({ urls: [] });
}
