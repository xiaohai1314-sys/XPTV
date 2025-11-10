const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://ddys.la/',
  'Origin': 'https://ddys.la',
  'User-Agent': UA,
}

const appConfig = {
  ver: 13, // 测试版本 - URL显示版
  title: "低端影视[测试]",
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
          urlPath = urlPath.replace(/(-+\d*-*)\.html/, `----------${page}---.html`);
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

// 🔍 修改 getTracks - 在选集名称中显示实际的视频URL（仅用于调试）
async function getTracks(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.url;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);
    let groups = [];

    // 先尝试提取一个播放页的视频URL作为示例
    let sampleVideoUrl = '';
    const firstPlayLink = $('.stui-content__playlist li a').first().attr('href');
    if (firstPlayLink) {
        try {
            const playPageUrl = appConfig.site + firstPlayLink;
            const { data: playData } = await $fetch.get(playPageUrl, { headers });
            const match = playData.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
            if (match && match[1]) {
                sampleVideoUrl = match[1];
            }
        } catch (e) {
            // 忽略错误
        }
    }

    $('.stui-vodlist__head').each((index, head) => {
        const sourceTitle = $(head).find('h3').text().trim();
        const playlist = $(head).next('ul.stui-content__playlist');

        if (playlist.length > 0 && !sourceTitle.includes('猜你喜欢')) {
            // 🔍 在线路标题中显示视频URL格式
            let debugTitle = sourceTitle;
            if (sampleVideoUrl) {
                const urlType = sampleVideoUrl.includes('.m3u8') ? '[M3U8]' : 
                               sampleVideoUrl.includes('.mp4') ? '[MP4]' : '[未知]';
                const protocol = sampleVideoUrl.startsWith('https://') ? '[HTTPS]' : 
                                sampleVideoUrl.startsWith('http://') ? '[HTTP]' : '[相对路径]';
                debugTitle = `${sourceTitle} ${urlType}${protocol}`;
            }
            
            let group = { title: debugTitle, tracks: [] };
            
            playlist.find('li a').each((_, trackLink) => {
                group.tracks.push({
                    name: $(trackLink).text().trim(),
                    pan: '',
                    ext: { 
                        play_url: $(trackLink).attr('href'),
                        // 携带示例URL用于显示
                        debug_url: sampleVideoUrl 
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

// 🔍 多方案测试版 getPlayinfo
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.play_url;
    
    try {
        const { data } = await $fetch.get(url, { headers });
        const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
        
        if (match && match[1]) {
            let videoUrl = match[1];
            
            // 处理相对路径
            if (videoUrl.startsWith('/')) {
                videoUrl = appConfig.site + videoUrl;
            }
            
            // 🎯 方案1：最简洁的返回（推荐先试这个）
            // return jsonify({ urls: [videoUrl] });
            
            // 🎯 方案2：带 headers 的返回（如果方案1不行，取消这个的注释）
            // return jsonify({ 
            //     urls: [videoUrl],
            //     headers: {
            //         'Referer': 'https://ddys.la/',
            //         'User-Agent': UA
            //     }
            // });
            
            // 🎯 方案3：指定解析模式（如果方案2不行，取消这个的注释）
            // return jsonify({ 
            //     urls: [videoUrl],
            //     parse: 0,
            //     jx: 0
            // });
            
            // 🎯 方案4：完整配置（当前使用的方案）
            return jsonify({ 
                urls: [videoUrl],
                headers: {
                    'Referer': 'https://ddys.la/',
                    'Origin': 'https://ddys.la',
                    'User-Agent': UA
                },
                ui: 1
            });
            
        }
        
        return jsonify({ urls: [] });
        
    } catch (error) {
        return jsonify({ urls: [] });
    }
}
