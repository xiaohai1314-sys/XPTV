/**
 * ==============================================================================
 * 万佳影视（wjys.cc） 适配脚本 - 最终修复版 (V6)
 * 
 * ✅ 新增与修复：
 * 1. 播放线路提取逻辑全面重写，适配 #glist-* 结构。
 * 2. 自动过滤“下载观看”、“迅雷下载”等无效线路。
 * 3. 自动补全相对链接，保证播放页有效。
 * 4. 保留 V5 的所有功能与结构，完全兼容原前端。
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  'Referer': 'https://www.wjys.cc/',
  'Origin': 'https://www.wjys.cc',
  'User-Agent': UA,
};

// 基本配置
const appConfig = {
  ver: 6,
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

// 首页 / 分类卡片
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
    if (urlPath === '/') return jsonify({ list: [] });
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

// 搜索功能
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

// 播放线路提取 (最终修复版)
async function getTracks(ext) {
  ext = argsify(ext);
  const base = appConfig.site.replace(/\/+$/, '');
  const url = base + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  const groups = [];

  const fixHref = (h) => {
    if (!h) return h;
    if (/^https?:\/\//i.test(h)) return h;
    if (h.startsWith('//')) return 'https:' + h;
    if (h.startsWith('/')) return base + h;
    return base + '/' + h;
  };

  // 优先按 #glist-* 提取
  const glistContainers = $('div[id^="glist-"]').toArray();
  if (glistContainers.length) {
    glistContainers.forEach((containerEl) => {
      const $cont = $(containerEl);
      const titles = [];

      // 线路标题
      $cont.find('.module-tab-item.tab-item, .module-tab-title').each((_, t) => {
        const txt = $(t).text().trim();
        if (txt) titles.push(txt);
      });

      const playBlocks = $cont.find('div.module-play-list').toArray();
      if (playBlocks.length) {
        playBlocks.forEach((pb, idx) => {
          const title = titles[idx] || titles[0] || `线路${idx + 1}`;
          if (/下载|迅雷/i.test(title)) return; // 排除下载类线路
          const tracks = [];
          $(pb).find('a.module-play-list-link').each((_, a) => {
            const name = $(a).text().trim();
            const href = fixHref($(a).attr('href'));
            if (href) tracks.push({ name, pan: '', ext: { play_url: href } });
          });
          if (tracks.length) groups.push({ title, tracks });
        });
      }
    });
  }

  // 若上面未取到，使用全局 fallback
  if (groups.length === 0) {
    $('div.module-tab-item.tab-item').each((index, el) => {
      const title = $(el).text().trim() || `线路${index + 1}`;
      if (/下载|迅雷/i.test(title)) return;
      const listId = `#glist-${index + 1}`;
      const tracks = [];
      $(`${listId} a.module-play-list-link`).each((_, link) => {
        const name = $(link).text().trim();
        const href = fixHref($(link).attr('href'));
        if (href) tracks.push({ name, pan: '', ext: { play_url: href } });
      });
      if (tracks.length > 0) groups.push({ title, tracks });
    });
  }

  return jsonify({ list: groups });
}

// 播放信息
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.play_url;
  const { data } = await $fetch.get(url, { headers });

  const match = data.match(/var player_aaaa\s*=\s*{[^}]*url\s*:\s*['"]([^'"]+)['"]/);
  if (match && match[1]) {
    return jsonify({ urls: [match[1]], ui: 1 });
  }
  return jsonify({ urls: [] });
}
