// ================================================================
// ✅ 低端影视（ddys.la）最终版 - 可播放修复版 (2025.11)
// ================================================================

const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://ddys.la/',
  'Origin': 'https://ddys.la',
  'User-Agent': UA,
}

// ================================================================
// 1️⃣ 基础配置 appConfig
// ================================================================
const appConfig = {
  ver: 11,
  title: "低端影视",
  site: "https://ddys.la",
  tabs: [{
    name: '首页',
    ext: { url: '/' },
  }, {
    name: '电影',
    ext: { url: '/category/dianying.html' },
  }, {
    name: '剧集',
    ext: { url: '/category/juji.html' },
  }, {
    name: '动漫',
    ext: { url: '/category/dongman.html' },
  }, {
    name: '发现', 
    ext: { url: '/search/-------------.html' },
  }]
}

async function getConfig() {
    return jsonify(appConfig)
}

// ================================================================
// 2️⃣ 列表解析 getCards
// ================================================================
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
      if (urlPath === '/') {
          return jsonify({ list: [] });
      }
      if (urlPath.includes('/search/')) {
          urlPath = urlPath.replace(/(-(\d+))?\.html/, `----------${page}---.html`);
      } else {
          urlPath = urlPath.replace('.html', `-${page}.html`);
      }
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
    })
  })

  return jsonify({ list: cards });
}

// ================================================================
// 3️⃣ 搜索函数 search
// ================================================================
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
    })
  })

  return jsonify({ list: cards });
}

// ================================================================
// 4️⃣ 详情页播放列表 getTracks
// ================================================================
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

            if (group.tracks.length > 0) {
                groups.push(group);
            }
        }
    });

    return jsonify({ list: groups });
}

// ================================================================
// 5️⃣ Base64 解码工具
// ================================================================
function base64decode(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "", i = 0;
    str = str.replace(/[^A-Za-z0-9+/=]/g, "");
    while (i < str.length) {
        const enc1 = chars.indexOf(str.charAt(i++));
        const enc2 = chars.indexOf(str.charAt(i++));
        const enc3 = chars.indexOf(str.charAt(i++));
        const enc4 = chars.indexOf(str.charAt(i++));
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;
        out += String.fromCharCode(chr1);
        if (enc3 != 64 && enc3 != -1) out += String.fromCharCode(chr2);
        if (enc4 != 64 && enc4 != -1) out += String.fromCharCode(chr3);
    }
    return out;
}

// ================================================================
// 6️⃣ 修复后的 getPlayinfo（带双层解密 + JSON 请求）
// ================================================================
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const pageUrl = appConfig.site + ext.play_url;
    const { data } = await $fetch.get(pageUrl, { headers });

    const match = data.match(/var\s+player_aaaa\s*=\s*\{[^}]*?url\s*:\s*['"]([^'"]+)['"]/);
    if (!match || !match[1]) {
        console.error("❌ 未找到 player_aaaa 或 url 字段");
        return jsonify({ urls: [] });
    }

    try {
        let rawUrl = match[1].trim();

        // 处理格式 m3u8|Base64
        if (rawUrl.includes('|')) rawUrl = rawUrl.split('|')[1];

        // 双层 Base64 解密
        let decoded = base64decode(rawUrl);
        if (/^[A-Za-z0-9+/=]+$/.test(decoded)) {
            try { decoded = base64decode(decoded); } catch (e) {}
        }

        // ✅ 第二步: 若是 ddys.pro 的接口，继续取 JSON
        if (decoded.includes('ddys.pro') || decoded.includes('getvddr2')) {
            const { data: json } = await $fetch.get(decoded, { headers });
            if (json && json.url && json.url.startsWith('http')) {
                return jsonify({ urls: [json.url], ui: 1 });
            }
        }

        // ✅ 否则直接判断是否是有效 m3u8 链接
        if (decoded.startsWith('http')) {
            return jsonify({ urls: [decoded], ui: 1 });
        }

        console.error("⚠️ 解密失败或无效结果:", decoded);
        return jsonify({ urls: [] });

    } catch (err) {
        console.error("❌ getPlayinfo 解密异常:", err);
        return jsonify({ urls: [] });
    }
}
