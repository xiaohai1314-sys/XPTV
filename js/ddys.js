/**
 * ==============================================================================
 * 低端影视（ddys.vip / ddys.la）脚本 - 最终完整版 v11.2
 * ==============================================================================
 * 更新说明：
 * ✅ 修正 getPlayinfo 的加密解析逻辑（竖线分隔 + 双层 Base64）
 * ✅ 兼容 m3u8 / vod / iframe 多源格式
 * ✅ 保留原搜索与列表结构不变
 * ==============================================================================
 */

// -----------------------------------------------------------------------------
// 工具区
// -----------------------------------------------------------------------------
const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

const headers = {
  'Referer': 'https://ddys.vip/',
  'Origin': 'https://ddys.vip',
  'User-Agent': UA,
}

const appConfig = {
  ver: 11.2,
  title: "低端影视",
  site: "https://ddys.vip",
  tabs: [
    { name: '首页', ext: { url: '/' } },
    { name: '电影', ext: { url: '/category/dianying.html' } },
    { name: '剧集', ext: { url: '/category/juji.html' } },
    { name: '动漫', ext: { url: '/category/dongman.html' } },
    { name: '发现', ext: { url: '/search/-------------.html' } },
  ],
}

// -----------------------------------------------------------------------------
// Base64 解码函数（原生兼容版）
// -----------------------------------------------------------------------------
function base64decode(str) {
  const base64DecodeChars = new Array(
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-62,-1,-1,-1,63,52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
    -1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
    -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1
  );
  let c1, c2, c3, c4;
  let i = 0, len = str.length, out = "";
  while (i < len) {
    do { c1 = base64DecodeChars[str.charCodeAt(i++) & 0xff]; } while (i < len && c1 == -1);
    if (c1 == -1) break;
    do { c2 = base64DecodeChars[str.charCodeAt(i++) & 0xff]; } while (i < len && c2 == -1);
    if (c2 == -1) break;
    out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));
    do {
      c3 = str.charCodeAt(i++) & 0xff;
      if (c3 == 61) return out;
      c3 = base64DecodeChars[c3];
    } while (i < len && c3 == -1);
    if (c3 == -1) break;
    out += String.fromCharCode(((c2 & 0x0F) << 4) | ((c3 & 0x3C) >> 2));
    do {
      c4 = str.charCodeAt(i++) & 0xff;
      if (c4 == 61) return out;
      c4 = base64DecodeChars[c4];
    } while (i < len && c4 == -1);
    if (c4 == -1) break;
    out += String.fromCharCode(((c3 & 0x03) << 6) | c4);
  }
  return out;
}

// -----------------------------------------------------------------------------
// 配置函数
// -----------------------------------------------------------------------------
async function getConfig() {
  return jsonify(appConfig)
}

// -----------------------------------------------------------------------------
// 首页 / 分类列表
// -----------------------------------------------------------------------------
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
    if (urlPath === '/') return jsonify({ list: [] });
    if (urlPath.includes('/search/'))
      urlPath = urlPath.replace(/(-(\d+))?\.html/, `----------${page}---.html`);
    else urlPath = urlPath.replace('.html', `-${page}.html`);
  }

  const fullUrl = appConfig.site + urlPath;
  const { data } = await $fetch.get(fullUrl, { headers });
  const $ = cheerio.load(data);

  $('ul.stui-vodlist > li').each((_, each) => {
    const thumb = $(each).find('a.stui-vodlist__thumb');
    const titleLink = $(each).find('h4.title > a');
    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.attr('title'),
      vod_pic: thumb.attr('data-original'),
      vod_remarks: thumb.find('span.pic-text').text().trim(),
      ext: { url: thumb.attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// -----------------------------------------------------------------------------
// 搜索函数
// -----------------------------------------------------------------------------
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  const searchUrl = `${appConfig.site}/search/${text}----------${page}---.html`;

  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  $('ul.stui-vodlist > li').each((_, each) => {
    const thumb = $(each).find('a.stui-vodlist__thumb');
    const titleLink = $(each).find('h4.title > a');
    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.attr('title'),
      vod_pic: thumb.attr('data-original'),
      vod_remarks: thumb.find('span.pic-text').text().trim(),
      ext: { url: thumb.attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// -----------------------------------------------------------------------------
// 获取分集
// -----------------------------------------------------------------------------
async function getTracks(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  let groups = [];

  $('.stui-vodlist__head').each((index, head) => {
    const sourceTitle = $(head).find('h3').text().trim();
    const playlist = $(head).next('ul.stui-content__playlist');

    if (playlist.length > 0 && !sourceTitle.includes('猜你喜欢')) {
      let group = { title: sourceTitle, tracks: [] };
      playlist.find('li a').each((_, trackLink) => {
        group.tracks.push({
          name: $(trackLink).text().trim(),
          pan: '',
          ext: { play_url: $(trackLink).attr('href') }
        });
      });
      if (group.tracks.length > 0) groups.push(group);
    }
  });

  return jsonify({ list: groups });
}

// -----------------------------------------------------------------------------
// ✅ 播放信息解析（最终修正版）
// -----------------------------------------------------------------------------
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const pageUrl = appConfig.site + ext.play_url;
  const { data } = await $fetch.get(pageUrl, { headers });

  const match = data.match(/var\s+player_aaaa\s*=\s*\{[^}]*?url\s*:\s*['"]([^'"]+)['"]/);
  if (!match || !match[1]) {
    console.error("未找到 player_aaaa 或 url 字段");
    return jsonify({ urls: [] });
  }

  try {
    const rawUrl = match[1].trim();
    let encoded = rawUrl;

    // m3u8|xxxx 或 vod|xxxx
    if (rawUrl.includes('|')) {
      encoded = rawUrl.split('|')[1];
    }

    // 尝试双层 Base64 解密
    let decoded1 = base64decode(encoded);
    let decoded2 = base64decode(decoded1);

    // 自动判断单双层情况
    const finalUrl = decoded2.startsWith('http') ? decoded2 :
                     decoded1.startsWith('http') ? decoded1 : '';

    if (finalUrl && finalUrl.startsWith('http')) {
      return jsonify({
        urls: [finalUrl],
        ui: 1
      });
    } else {
      console.error("解密失败或无效URL:", decoded1, decoded2);
      return jsonify({ urls: [] });
    }

  } catch (err) {
    console.error("getPlayinfo 解密异常:", err);
    return jsonify({ urls: [] });
  }
}
