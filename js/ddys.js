const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://ddys.la/',
  'Origin': 'https://ddys.la',
  'User-Agent': UA,
}

// appConfig 保持不变
const appConfig = {
  ver: 6, // 版本号更新
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

// getCards 函数保持不变
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

// 1. 精确修正 search 函数的URL构造逻辑
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  let searchUrl;
  if (page === 1) {
      // 搜索第一页：使用不带页码的简单URL
      searchUrl = `<LaTex>${appConfig.site}/search/$</LaTex>{text}.html`;
  } else {
      // 搜索第二页及以后：使用带页码的复杂URL
      searchUrl = `<LaTex>${appConfig.site}/search/$</LaTex>{text}----------${page}---.html`;
  }
  
  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  // 解析逻辑与 getCards 完全相同
  $('ul.stui-vodlist > li').each((_, each) => {
    const thumb = $(each).find('a.stui-vodlist__thumb');
    const titleLink = $(each).find('h4.title > a');

    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.attr('title'),
      vod_pic: thumb.attr('data-original'),
      vod_remarks: thumb.find('span.pic-text').text().trim(),
      ext: {
        url: thumb.attr('href'),
      },
    })
  })

  return jsonify({
      list: cards,
  })
}

// getTracks 和 getPlayinfo 函数保持不变
async function getTracks(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.url;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);
    let groups = [];
    $('.stui-pannel-box').each((index, panel) => {
        const sourceTitle = $(panel).find('.stui-vodlist__head h3').text().trim();
        if (sourceTitle.includes('播放')) {
            let group = { title: sourceTitle, tracks: [] };
            $(panel).find('ul.stui-content__playlist li').each((_, track) => {
                const trackLink = $(track).find('a');
                group.tracks.push({
                    name: trackLink.text().trim(),
                    pan: '',
                    ext: { play_url: trackLink.attr('href') }
                });
            });
            if (group.tracks.length > 0) {
                groups.push(group);
            }
        }
    });
    return jsonify({ list: groups });
}

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
