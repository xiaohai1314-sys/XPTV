/**
 * ==============================================================================
 * 适配 kkys01.com 的最终脚本 (版本 3) - 全面修复
 * * 更新日志:
 * - 修正 v3: 恢复 getConfig 确保 Tabs 显示。
 * - 修正 v3: 修正 getCards 海报/标题选择器，避免错误数据。
 * - 修正 v3: 在 getPlayinfo 返回中添加 'header' 参数，解决 0KB 播放的防盗链问题。
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
  ver: 3,
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

// 1. 修复 Tabs 显示问题 (使用纯对象返回)
async function getConfig() {
  return jsonify(appConfig);
}

// 2. 获取卡片列表（首页、分类页）- 修正海报和标题
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1 && urlPath !== '/') {
    urlPath = urlPath.replace('.html', `-${page}.html`);
  }

  const fullUrl = appConfig.site + urlPath;
  const { data } = await $fetch.get(fullUrl, { headers });
  const $ = cheerio.load(data);

  $('div.module-item').each((_, each) => {
    const thumbLink = $(each).find('a.v-item');
    const thumb = thumbLink.find('div.v-item-cover img.lazyload').last();
    
    // 确保从卡片中提取正确信息，而非通用页面标题
    const vodName = thumbLink.find('div.v-item-title').text().trim(); 
    const vodPic = thumb.attr('data-original') || thumb.attr('src'); // 优先 data-original
    const vodRemarks = $(each).find('div.v-item-bottom span').text().trim();
    
    if (!vodName || !vodPic) return; // 避免无效卡片

    cards.push({
      vod_id: thumbLink.attr('href'),
      vod_name: vodName,
      vod_pic: vodPic,
      vod_remarks: vodRemarks,
      ext: { url: thumbLink.attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// 3. 搜索功能 (保持之前优化后的逻辑)
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  const text = encodeURIComponent(ext.text);
  const page = ext.page || 1;

  const { data: searchPageHtml } = await $fetch.get(`${appConfig.site}/search`, { headers });
  const $searchPage = cheerio.load(searchPageHtml);
  
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
      vod_pic: thumb.attr('data-original') || thumb.attr('src'),
      vod_remarks: $(each).find('div.search-result-item-header div').text().trim(),
      ext: { url: $(each).attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// 4. 获取播放列表 (不变)
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

// 5. 获取播放信息 (核心解密) - 修正 0KB 播放问题
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.play_url;
  const { data } = await $fetch.get(url, { headers });

  const match = data.match(/window\.whatTMDwhatTMDPPPP\s*=\s*'([^']+)';/);
  
  if (match && match[1]) {
    const encryptedData = match[1];
    
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
            // 返回包含 Referer Header，解决防盗链 0KB 问题
            return jsonify({ 
                urls: [playInfo.url], 
                ui: 1,
                header: {
                    'Referer': appConfig.site + '/', 
                    'User-Agent': UA 
                }
            });
        }
    } catch (e) {
        console.error("AES 解密或 JSON 解析失败:", e);
    }
  }
  
  // 备用方案，同样添加 Header
  const directMatch = data.match(/url:\s*'([^']+)'/);
  if (directMatch && directMatch[1]) {
      return jsonify({ 
          urls: [directMatch[1]], 
          ui: 1,
          header: {
              'Referer': appConfig.site + '/', 
              'User-Agent': UA 
          }
      });
  }

  return jsonify({ urls: [] });
}
