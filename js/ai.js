/**
 * ==============================================================================
 * 适配 wjys.cc (万佳影视) 的最终脚本 (版本 5 - 逻辑重构版)
 * * 核心修复:
 * 1. getTracks (详情页): 完全重写选择器，以适配当前 wjys.cc 的 HTML 结构。
 * - 修复播放源标题 (<span>)
 * - 修复播放列表容器 (.module-player-list)
 * - 修复剧集/线路链接 (.scroll-content a)
 * 2. getPlayinfo (播放页):
 * - 修正核心逻辑，使其不再错误拼接 wjys.cc 域名。
 * - 现在直接访问 getTracks 传来的完整外部链接 (例如 158699.xyz)。
 * - 保留原有的 player_aaaa 解析规则，该规则适用于目标跳转站。
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
  ver: 5, // 版本号更新
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

// 2. 获取卡片列表（首页、分类页）- V4 逻辑保持不变
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

// 3. 搜索功能 - V4 逻辑保持不变
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

// 4. ✅ 获取播放列表 (详情页) - V5 修复版
async function getTracks(ext) {
  ext = argsify(ext);
  // ext.url 是 /voddetail/xxxx.html，拼接后是 wjys.cc 的详情页
  const url = appConfig.site + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  let groups = [];

  // 播放源标题
  const sourceTitles = [];
  // 🚀 V5 修复: 目标是 <span> 标签，不是 <a>
  $('div.module-tab.module-player-tab div.module-tab-item.tab-item > span').each((_, span) => {
    sourceTitles.push($(span).text().trim());
  });
  // sourceTitles 预期结果: ["在线观看", "下载观看", "备用地址"]

  // 播放列表容器
  // 🚀 V5 修复: class 是 .module-player-list (多了 "er")
  $('div.module-player-list.tab-list').each((index, box) => {
    const sourceTitle = sourceTitles[index] || `播放源 ${index + 1}`;
    let group = { title: sourceTitle, tracks: [] };

    // 🚀 V5 修复: 链接在 .scroll-content > a 内部
    $(box).find('div.scroll-content a').each((_, trackLink) => {
      // 🚀 V5 修复: 标题在 a > span 内部
      const trackName = $(trackLink).find('span').text().trim();
      const trackUrl = $(trackLink).attr('href');

      if (trackUrl && trackName) {
        group.tracks.push({
          name: trackName, // 例如: "线路1"
          pan: '',
           // 🚀 V5 核心: 这里的 play_url 现在是完整的外部链接
           // 例如: https://www.158699.xyz/voddetail/124641.html...
          ext: { play_url: trackUrl },
        });
      }
    });

    if (group.tracks.length > 0) groups.push(group);
  });

  return jsonify({ list: groups });
}

// 5. ✅ 获取播放信息 - V5 修复版
async function getPlayinfo(ext) {
  ext = argsify(ext);
  
  // 🚀 V5 核心修复:
  // ext.play_url 是从 getTracks 传来的完整外部链接 (例如 https://www.158699.xyz/...)
  // 绝对不能再拼接 appConfig.site
  const url = ext.play_url;

  // 我们仍然使用 wjys.cc 作为 Referer，这通常是必要的
  const { data } = await $fetch.get(url, { headers });

  // V4 的正则表达式是正确的，它匹配的是目标站 (如 158599.xyz) 的 HTML (File 1)
  const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
  
  if (match && match[1]) {
    // 匹配到 .m3u8 链接
    return jsonify({ urls: [match[1]], ui: 1 });
  }
  return jsonify({ urls: [] });
}
