/**
 * ==============================================================================
 * 适配 kkys01.com 的最终脚本 (版本 2) - 修复 Tabs 显示问题
 * * 修正内容:
 * - 恢复 getConfig 函数为原始的纯对象返回结构 (jsonify(appConfig))，以确保 Tabs 正常显示。
 * - 保持搜索核心解密等其他功能不变。
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
  ver: 2, // 版本号更新
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

// 【重要修正】恢复为原始的 getConfig，它应该可以正常显示 Tabs
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
  const { data: searchPageHtml } = await $fetch.get(`${appConfig.site}/search`, { headers });
  const $searchPage = cheerio.load(searchPageHtml);
  // 优化：增强对 t 参数获取的健壮性
  const t_param = $searchPage('input[name="t"]').val() || '';
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
    
    // 假设运行环境已内置或自行引入了 CryptoJS 库
    const key = CryptoJS.enc.Utf8.parse("whatTMDwhatTMD".substring(0, 16));
    const iv = CryptoJS.enc.Utf8.parse("whatTMDwhatTMD".substring(0, 16));
    
    try {
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
    } catch (e) {
        console.error("AES 解密或 JSON 解析失败:", e);
    }
  }
  
  // 如果解密失败，尝试作为备用方案直接从页面正则匹配
  const directMatch = data.match(/url:\s*'([^']+)'/);
  if (directMatch && directMatch[1]) {
      return jsonify({ urls: [directMatch[1]], ui: 1 });
  }

  return jsonify({ urls: [] });
}
