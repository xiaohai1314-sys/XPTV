/**
 * ==============================================================================
 * 适配 wjys.cc (万佳影视) 的最终脚本 (版本 3)
 * * 更新日志:
 * - v3: 彻底修复 getCards 函数，纠正了卡片内部元素的选择器（a.module-item-pic -> div.module-item-pic > a），
 * 确保了 vod_id 和 vod_pic 能够正确获取。
 * - v2: 修复了 getCards 外层选择器和 search 函数的选择器。
 * - v1: 初版适配 wjys.cc 网站结构。
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
  ver: 3, // 版本号更新
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

// 2. ✅ 修正后的获取卡片列表函数 (已修复内部选择器)
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

  // ✅ 外层选择器正确：div.module-list div.module-item
  $('div.module-list div.module-item').each((_, each) => {
    // ❗ 修复点：先定位到图片/链接的容器 DIV
    const picContainer = $(each).find('div.module-item-pic');
    // 找到实际的 A 标签，用于获取 vod_id
    const thumbLink = picContainer.find('a'); 
    // 从容器中找到 IMG 标签，用于获取图片 URL
    const pic = picContainer.find('img').attr('data-src');

    const titleLink = $(each).find('a.module-item-title');

    // 只有当图片链接存在时才添加卡片，过滤掉广告等无效项目
    if (pic) {
        cards.push({
          vod_id: thumbLink.attr('href'), // 使用正确的链接元素
          vod_name: titleLink.text().trim(),
          vod_pic: pic,
          vod_remarks: $(each).find('div.module-item-text').text().trim(),
          ext: { url: thumbLink.attr('href') }, // 使用正确的链接元素
        });
    }
  });

  return jsonify({ list: cards });
}

// 3. 搜索功能 (选择器稳定，无需修改)
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const searchUrl = `${appConfig.site}/vodsearch/page/${page}/wd/${text}.html`;

  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  // ✅ 优化搜索结果页的选择器
  $('div.module-search-item').each((_, each) => {
    // 搜索页的结构与分类页不同，此处选择器应是正确的
    const thumb = $(each).find('a.module-item-pic'); 
    const titleLink = $(each).find('h3 > a');
    const pic = thumb.find('img').attr('data-src');

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

// 4. 获取播放列表 (无需修改)
async function getTracks(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  let groups = [];

  const sourceTitles = [];
  $('div.module-tab-item.tab-item').each((_, a) => {
    sourceTitles.push($(a).find('span').text().trim());
  });

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

// 5. 获取播放信息 (无需修改)
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
