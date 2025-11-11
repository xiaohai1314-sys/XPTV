/**
 * ==============================================================================
 * 适配 kkys01.com 的最终脚本 (版本 1)
 * 
 * 主要适配点:
 * - 站点配置: 更新了 appConfig 以匹配 kkys01.com 的结构和分类。
 * - 卡片列表: 适配了首页、分类页和搜索页的卡片列表 HTML 结构。
 * - 搜索功能: 修正了搜索 URL 的构建方式。
 * - 播放列表: 适配了详情页中播放源和剧集列表的解析逻辑。
 * - 播放信息: 实现了对 `whatTMDwhatTMDPPPP` 变量的 AES 解密，以获取真实的 m3u8 播放地址。
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  'Referer': 'https://www.kkys01.com/',
  'Origin': 'https://www.kkys01.com',
  'User-Agent': UA,
};

// 1. 站点配置
const appConfig = {
  ver: 1,
  title: "可可影视",
  site: "https://www.kkys01.com",
  tabs: [
    { name: '首页', ext: { url: '/' } },
    { name: '电影', ext: { url: '/channel/1.html' } },
    { name: '连续剧', ext: { url: '/channel/2.html' } },
    { name: '动漫', ext: { url: '/channel/3.html' } },
    { name: '综艺纪录', ext: { url: '/channel/4.html' } },
    { name: '短剧', ext: { url: '/channel/6.html' } }
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

  if (page > 1 && urlPath !== '/') {
    // 适配分类页分页URL格式：/channel/1-2.html
    urlPath = urlPath.replace('.html', `-${page}.html`);
  }

  const fullUrl = appConfig.site + urlPath;
  const { data } = await $fetch.get(fullUrl, { headers });
  const $ = cheerio.load(data);

  $('div.module-item').each((_, each) => {
    const thumbLink = $(each).find('a.v-item');
    const thumb = thumbLink.find('div.v-item-cover img.lazyload').last();
    
    cards.push({
      vod_id: thumbLink.attr('href'),
      vod_name: thumbLink.find('div.v-item-title').last().text().trim(),
      vod_pic: thumb.attr('src') || thumb.attr('data-original'),
      vod_remarks: thumbLink.find('div.v-item-bottom span').text().trim(),
      ext: { url: thumbLink.attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// 3. 搜索功能
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  const text = encodeURIComponent(ext.text);
  const page = ext.page || 1;

  // 获取搜索页面以提取动态参数 't'
  const { data: searchPageHtml } = await <LaTex>$fetch.get(`$</LaTex>{appConfig.site}/search`, { headers });
  const $searchPage = cheerio.load(searchPageHtml);
  const t_param = $searchPage('input[name="t"]').val();

  const searchUrl = `<LaTex>${appConfig.site}/search?k=$</LaTex>{text}&t=<LaTex>${t_param}&page=$</LaTex>{page}`;

  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  $('a.search-result-item').each((_, each) => {
    const thumb = $(each).find('div.search-result-item-pic img.lazyload').first();
    const vodInfo = $(each).find('div.search-result-item-main');

    cards.push({
      vod_id: $(each).attr('href'),
      vod_name: vodInfo.find('div.title').text().trim(),
      vod_pic: thumb.attr('src') || thumb.attr('data-original'),
      vod_remarks: $(each).find('div.search-result-item-header div').text().trim(),
      ext: { url: $(each).attr('href') },
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

  const sourceTitles = [];
  $('div.source-swiper-slide a.source-item').each((_, a) => {
    sourceTitles.push($(a).find('span.source-item-label').text().trim());
  });

  $('div.episode-list').each((index, box) => {
    const sourceTitle = sourceTitles[index] || `播放源 ${index + 1}`;
    let group = { title: sourceTitle, tracks: [] };

    $(box).find('a.episode-item').each((_, trackLink) => {
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

// 5. 获取播放信息 (核心解密)
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.play_url;
  const { data } = await $fetch.get(url, { headers });

  const match = data.match(/window\.whatTMDwhatTMDPPPP\s*=\s*'([^']+)';/);
  if (match && match[1]) {
    const encryptedData = match[1];
    
    // 模拟页面中的 AES 解密逻辑
    const key = CryptoJS.enc.Utf8.parse("whatTMDwhatTMD".substring(0, 16));
    const iv = CryptoJS.enc.Utf8.parse("whatTMDwhatTMD".substring(0, 16));
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    const playInfo = JSON.parse(decryptedString);

    if (playInfo && playInfo.url) {
      return jsonify({ urls: [playInfo.url], ui: 1 });
    }
  }
  
  // 如果解密失败，尝试作为备用方案直接从页面正则匹配
  const directMatch = data.match(/url:\s*'([^']+)'/);
  if (directMatch && directMatch[1]) {
      return jsonify({ urls: [directMatch[1]], ui: 1 });
  }

  return jsonify({ urls: [] });
}
