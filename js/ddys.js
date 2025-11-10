const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://ddys.la/',
  'Origin': 'https://ddys.la',
  'User-Agent': UA,
}

// 1. 使用完整的、正确的 appConfig
const appConfig = {
  ver: 11, // 最终无误版本
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

// 2. 恢复 V7 版本中正确的 getCards 分页逻辑
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
    urlPath = urlPath.replace('.html', `-${page}.html`);
  }

  const url = appConfig.site + urlPath;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  $('.stui-vodlist__thumb').each((index, thumb) => {
    thumb = $(thumb);
    cards.push({
      title: thumb.attr('title').trim(),
      vod_pic: thumb.attr('data-original').trim(),
      vod_remarks: thumb.find('span.pic-text').text().trim(),
      ext: { url: thumb.attr('href') },
    })
  })

  return jsonify({ list: cards });
}

// 3. getTracks 函数：优化分类逻辑，只依赖固定位置（.stui-pannel-box）内的 h3 标签内容
async function getTracks(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.url;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);
    let groups = [];
    
    // 遍历所有可能的播放列表容器 (.stui-pannel-box)
    $('.stui-pannel-box').each((index, panel) => {
        const $panel = $(panel);
        
        // 1. 确认这是一个包含播放列表的区块，排除无关内容
        if ($panel.find('ul.stui-content__playlist').length === 0) {
            return; 
        }

        let routeTag = '';
        
        // 2. 在当前区块内，遍历所有 h3 标签，寻找最合适的路线名称（只看 h3 标签）
        // 解决了“路线名不固定，但位置一样”的问题
        $panel.find('h3').each((_, h3_el) => {
            const h3_text = $(h3_el).text().trim().toLowerCase();
            
            // 优先级 #1: 检查是否为自定义分类标签 (banyun/gongyou)
            if (h3_text === 'banyun') {
                routeTag = 'banyun'; // 直接使用标签名作为路线名
                return false; 
            } else if (h3_text === 'gongyou') {
                routeTag = 'gongyou'; // 直接使用标签名作为路线名
                return false;
            }
            
            // 优先级 #2: 检查是否为网站标准名称 (例如 播放路线一, 在线播放)
            if (h3_text.includes('播放路线')) {
                // 如果是“播放路线一”，去除“播放”二字，得到“路线一”
                routeTag = h3_text.replace('播放', '').trim();
                return false;
            } else if (h3_text.includes('在线播放')) {
                routeTag = '在线播放';
                return false;
            }
        });
        
        // 3. 提取剧集链接
        if (routeTag) {
            let group = { title: routeTag, tracks: [] };
            
            $panel.find('ul.stui-content__playlist li').each((_, track) => {
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

// 4. getPlayinfo 函数保持不变
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.play_url;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);
    
    // 页面里找播放器的iframe
    const player_iframe = $('#player-container iframe').attr('src');

    return jsonify({ play_url: player_iframe });
}
