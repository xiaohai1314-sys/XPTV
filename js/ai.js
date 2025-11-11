/**
 * ==============================================================================
 * 适配 kkys01.com 的最终脚本 (版本 1) - 修正版
 * * 修正内容:
 * - 修正了 getConfig 的返回结构，以确保 tabs 能够显示。
 * - 优化了搜索功能中动态参数 't' 的获取和使用，增强健壮性。
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
  search: true, // 明确支持搜索功能
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
  // 修正: 将 appConfig 封装为 list 数组返回，以适配要求 list 结构的主程序
  return jsonify({
      list: [appConfig]
  });
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
    // 修正: 统一使用 data-original 提高兼容性
    const thumb = thumbLink.find('div.v-item-cover img.lazyload').last();
    
    cards.push({
      vod_id: thumbLink.attr('href'),
      vod_name: thumbLink.find('div.v-item-title').last().text().trim(),
      vod_pic: thumb.attr('data-original') || thumb.attr('src'), 
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

  // 1. 获取搜索页面以提取动态参数 't'
  const { data: searchPageHtml } = await $fetch.get(`${appConfig.site}/search`, { headers });
  const $searchPage = cheerio.load(searchPageHtml);
  
  // 尝试提取 t 参数
  const t_param = $searchPage('input[name="t"]').val() || ''; 
  
  // 2. 构建搜索 URL
  const t_query = t_param ? `&t=${t_param}` : '';
  const searchUrl = `${appConfig.site}/search?k=${text}${t_query}&page=${page}`;

  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  $('a.search-result-item').each((_, each) => {
    const thumb = $(each).find('div.search-result-item-pic img.lazyload').first();
    const vodInfo = $(each).find('div.search-result-item-main');

    cards.push({
      vod_id: $(each).attr('href'),
      vod_name: vodInfo.find('div.title').text().trim(),
      vod_pic: thumb.attr('data-original') || thumb.attr('src'), // 统一使用 data-original 提高兼容性
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
    // 注意: 这里假设运行环境已内置或自行引入了 CryptoJS 库。
    const key = CryptoJS.enc.Utf8.parse("whatTMDwhatTMD".substring(0, 16));
    const iv = CryptoJS.enc.Utf8.parse("whatTMDwhatTMD".substring(0, 16));
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    try {
      const playInfo = JSON.parse(decryptedString);

      if (playInfo && playInfo.url) {
        return jsonify({ urls: [playInfo.url], ui: 1 });
      }
    } catch (e) {
      // JSON.parse 失败，可能解密错误
      console.error("解密后 JSON 解析失败:", e);
    }
  }
  
  // 如果解密失败，尝试作为备用方案直接从页面正则匹配
  const directMatch = data.match(/url:\s*'([^']+)'/);
  if (directMatch && directMatch[1]) {
      return jsonify({ urls: [directMatch[1]], ui: 1 });
  }

  return jsonify({ urls: [] });
}
