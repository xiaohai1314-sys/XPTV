// 脚本头部，包含必要的工具函数和配置
const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

// =================================================================
// 关键更新 1: 确保 appConfig 和 headers 使用正确的、当前有效的域名
// =================================================================
const headers = {
  'Referer': 'https://ddys.vip/',
  'Origin': 'https://ddys.vip',
  'User-Agent': UA,
}

const appConfig = {
  ver: 12,
  title: "低端影视",
  site: "https://ddys.vip", // 使用当前有效的域名
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

// =================================================================
// 关键更新 2: 添加 getPlayinfo 所需的解密辅助函数
// =================================================================
function base64decode(str) {
    const base64DecodeChars = new Array(-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,-1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1);
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

// =================================================================
// 以下所有函数均保持您提供的原始结构，并已修正错误
// =================================================================

async function getConfig() {
    return jsonify(appConfig)
}

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

// ✅ 已恢复为您最初的、正确的 search 函数，一字未动
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const searchUrl = `<LaTex>${appConfig.site}/search/$</LaTex>{text}----------${page}---.html`;

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

// =================================================================
// 关键更新 3: 最终的、基于本地解密的 getPlayinfo 函数
// =================================================================
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const pageUrl = appConfig.site + ext.play_url;

    const { data } = await $fetch.get(pageUrl, { headers });

    const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
    if (!match || !match[1]) {
        console.error("在页面中未找到 player_aaaa 或 url 字段");
        return jsonify({ urls: [] });
    }

    try {
        const encryptedUrl = match[1];
        
        const coreEncryptedPart = encryptedUrl.substring(encryptedUrl.indexOf('-') + 1);
        const decoded_once = base64decode(coreEncryptedPart);
        const final_m3u8_url = base64decode(decoded_once);

        if (final_m3u8_url && final_m3u8_url.startsWith('http')) {
            return jsonify({ urls: [final_m3u8_url], ui: 1 });
        } else {
            console.error("解密失败或解密结果不是有效的URL:", final_m3u8_url);
            return jsonify({ urls: [] });
        }

    } catch (e) {
        console.error("解密过程中发生错误:", e);
        return jsonify({ urls: [] });
    }
}
