const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://ddys.la/',
  'Origin': 'https://ddys.la',
  'User-Agent': UA,
}

// 配置信息保持不变
const appConfig = {
  ver: 2,
  title: "低端影视",
  site: "https://ddys.la",
  tabs: [{
    name: '首页',
    ext: { url: '/' },
  }, {
    name: '电影',
    ext: { url: '/category/dianying' },
  }, {
    name: '剧集',
    ext: { url: '/category/juji' },
  }, {
    name: '动漫',
    ext: { url: '/category/dongman' },
  }, {
    name: '专题',
    ext: { url: '/topic.html' },
  }]
}

async function getConfig() {
    return jsonify(appConfig)
}

// 列表页解析函数保持不变
async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  let url = ext.url
  let page = ext.page || 1

  if (page === 1) {
    url = appConfig.site + (url === '/' ? '/' : `${url}.html`);
  } else {
    url = appConfig.site + `<LaTex>${url}-$</LaTex>{page}.html`;
  }

  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);

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

// 搜索函数保持不变
async function search(ext) {
  ext = argsify(ext)
  let cards = [];
  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1

  const url = `<LaTex>${appConfig.site}/search/$</LaTex>{text}----------${page}---.html`;
  
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);

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

// 4. 更新 getTracks 函数以解析详情页的播放列表
async function getTracks(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.url;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);

    let groups = [];

    // 遍历每个播放源 (线路)
    $('.stui-pannel-box').each((index, panel) => {
        const sourceTitle = $(panel).find('.stui-vodlist__head h3').text().trim();
        
        // 只处理包含“播放”字样的线路，过滤掉“猜你喜欢”等
        if (sourceTitle.includes('播放')) {
            let group = {
                title: sourceTitle,
                tracks: []
            };

            // 遍历该线路下的所有剧集/播放项
            $(panel).find('ul.stui-content__playlist li').each((_, track) => {
                const trackLink = $(track).find('a');
                group.tracks.push({
                    name: trackLink.text().trim(),
                    // pan 为空表示这是在线播放，不是网盘
                    pan: '',
                    // ext 中保存播放页的相对路径，用于 getPlayinfo
                    ext: {
                        play_url: trackLink.attr('href')
                    }
                });
            });

            if (group.tracks.length > 0) {
                groups.push(group);
            }
        }
    });

    return jsonify({ list: groups });
}

// 5. 更新 getPlayinfo 函数以从播放页获取真实播放地址
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.play_url;
    const { data } = await $fetch.get(url, { headers });

    // 使用正则表达式从页面脚本中提取 player_aaaa 对象中的 url
    const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);

    if (match && match[1]) {
        const playUrl = match[1];
        return jsonify({
            urls: [playUrl],
            // 播放器UI类型，1通常代表使用内置的IJK播放器
            ui: 1, 
        });
    }

    // 如果没有找到匹配项，返回空结果
    return jsonify({ urls: [] });
}
