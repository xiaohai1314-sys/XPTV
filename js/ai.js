/**
 * ==============================================================================
 * 适配 wjys.cc (万佳影视) 的最终脚本 (版本 10 - 终极稳定版)
 * * 核心逻辑: 双详情页代理 + 播放链接修复 + 采用最通用选择器
 * 1. getTracks: 
 * - (1) 抓取 wjys.cc 找到跳转 URL (目标站域名)。
 * - (2) 请求目标站详情页。
 * - (3) 采用**最泛用的选择器**解析目标站的线路和剧集，并将域名传递给 getPlayinfo。
 * 2. getPlayinfo: 使用传递的**目标站域名**来确保播放链接拼接正确。
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  // 保持 Referer 为 wjys.cc，对目标站的请求可能需要这个来通过校验
  'Referer': 'https://www.wjys.cc/',
  'Origin': 'https://www.wjys.cc',
  'User-Agent': UA,
};

// 1. 站点配置 (保持不变)
const appConfig = {
  ver: 10, // 版本号更新
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

// 4. ✅ 获取播放列表 (详情页) - V10 核心重构版
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
      return jsonify({ list: [] });
  }

  // 1.5 从跳转 URL 中提取目标站的域名
  const targetDomainMatch = jumpUrl.match(/^(https?:\/\/[^\/]+)/);
  const targetDomain = targetDomainMatch ? targetDomainMatch[0] : '';
  if (!targetDomain) return jsonify({ list: [] });

  // ===================================
  // 步骤 2: 访问目标站 (e.g. 158699.xyz) 详情页，解析真实列表
  // ===================================
  const targetUrl = jumpUrl;
  const { data: targetData } = await $fetch.get(targetUrl, { headers });
  $ = cheerio.load(targetData); // 重新加载 cheerio，作用于目标站

  // ************ 目标站解析逻辑 (V10 终极稳定版) ************

  // 1. 获取播放源标题 (最泛用的方式：抓取所有 tab 文本)
  const sourceTitles = [];
  // 查找所有可能的 tab 容器，使用属性包含选择器，并只看文本
  $('div[class*="tab-item"], li[class*="tab-item"]').each((_, el) => {
    const title = $(el).find('span').text().trim() || $(el).text().trim(); 
    if (title) {
      sourceTitles.push(title);
    }
  });
  
  // 2. 获取播放列表
  // 查找所有可能的列表容器：根据 id 或 class 包含 "list" 且包含链接的
  $('div[id^="playlist"], div[id^="glist"], div[class*="player-list"], div[class*="play-list"], div[class*="-list"]').each((index, box) => {
    const sourceTitle = sourceTitles[index] || `线路 ${index + 1}`; // 确保有线路名
    let group = { title: sourceTitle, tracks: [] };

    // 抓取容器内所有直接的 a 标签，或者在容器内找到所有包含链接的 li
    $(box).find('a[href], li a[href]').each((_, trackLink) => {
      // 尝试获取 span 文本，如果失败就获取 a 文本 (更稳定)
      const $link = $(trackLink);
      const trackName = $link.find('span').text().trim() || $link.text().trim(); 
      const playUrl = $link.attr('href'); 

      if (playUrl && trackName) {
        group.tracks.push({
          name: trackName, 
          pan: '',
          // 🚀 V10 核心：将目标站域名和播放链接一起传递
          ext: { play_url: playUrl, target_domain: targetDomain }, 
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


// 5. ✅ 获取播放信息 (播放页) - V10 修复版
async function getPlayinfo(ext) {
  ext = argsify(ext);
  
  // 🚀 V10 核心修复：使用传递过来的目标站域名
  const domain = ext.target_domain; 
  
  if (!domain) {
    // 域名丢失，无法拼接，直接返回空
    return jsonify({ urls: [] });
  }

  // 确保 play_url 是一个完整的 URL。如果是相对路径，用目标站域名拼接。
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
