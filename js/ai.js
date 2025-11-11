/**
 * ==============================================================================
 * 适配 zhenlang.cc 的最终脚本 (版本 2)
 * 
 * 更新日志:
 * - v2: 修正了 search 函数中 URL 拼接的严重语法错误。
 * - v1: 基于参考脚本，适配了 zhenlang.cc 的网站结构。
 * 
 * 主要适配点：
 * 1.  appConfig: 更新站点URL和分类URL。
 * 2.  getCards: 适配分类页和首页的卡片列表结构及分页URL格式。
 * 3.  search: 修正了URL拼接逻辑，并适配搜索页的URL格式和结果列表结构。
 * 4.  getTracks: 重写逻辑，以正确解析详情页中基于Tab切换的播放列表。
 * 5.  getPlayinfo: 保持不变，播放页面逻辑与参考脚本类似。
 * ==============================================================================
 */

// 模拟环境设置
const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  'Referer': 'https://www.zhenlang.cc/',
  'Origin': 'https://www.zhenlang.cc',
  'User-Agent': UA,
};

// 1. [已修改] 站点配置
const appConfig = {
  ver: 2, // 版本号
  title: "真狼影视",
  site: "https://www.zhenlang.cc",
  tabs: [{
    name: '首页',
    ext: { url: '/' },
  }, {
    name: '电影',
    ext: { url: '/vodshow/dianying-----------.html' },
  }, {
    name: '连续剧',
    ext: { url: '/vodshow/lianxuju-----------.html' },
  }, {
    name: '综艺',
    ext: { url: '/vodshow/zongyi-----------.html' },
  }, {
    name: '动漫',
    ext: { url: '/vodshow/dongman-----------.html' },
  }]
};

async function getConfig() {
    return jsonify(appConfig);
}

// 2. [已修改] 获取卡片列表（首页、分类页）
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
      if (urlPath === '/') {
          return jsonify({ list: [] });
      }
      // 适配分类页的分页URL格式：/vodshow/dianying-----------2---.html
      urlPath = urlPath.replace(/(-(\d+))?---.html/, `-----------${page}---.html`);
  }
  
  const fullUrl = appConfig.site + urlPath;
  const { data } = await $fetch.get(fullUrl, { headers });
  const $ = cheerio.load(data);

  // 适配新的卡片列表选择器
  $('ul.vodlist > li.vodlist_item').each((_, each) => {
    const thumb = $(each).find('a.vodlist_thumb');
    const titleLink = $(each).find('p.vodlist_title > a');
    
    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.attr('title'),
      vod_pic: thumb.attr('data-original'),
      vod_remarks: thumb.find('span.pic_text').text().trim(),
      ext: { url: thumb.attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// 3. [已修正] 搜索功能
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  // ✅ [修正] 使用正确的模板字符串语法拼接搜索URL
  const searchUrl = `<LaTex>${appConfig.site}/vodsearch/$</LaTex>{text}----------${page}---.html`;

  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  // 适配新的搜索结果列表选择器
  $('li.searchlist_item').each((_, each) => {
    const thumb = $(each).find('a.vodlist_thumb');
    const titleLink = $(each).find('h4.vodlist_title > a');

    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.attr('title'),
      vod_pic: thumb.attr('data-original'),
      vod_remarks: thumb.find('span.pic_text').text().trim(),
      ext: { url: thumb.attr('href') },
    });
  });

  return jsonify({ list: cards });
}

// 4. [已修改] 获取播放列表
async function getTracks(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.url;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);
    let groups = [];

    // 获取所有播放源的标题
    const sourceTitles = [];
    $('div.play_source_tab > a').each((_, a) => {
        sourceTitles.push($(a).attr('alt').trim());
    });

    // 遍历每个播放列表容器
    $('div.play_list_box').each((index, box) => {
        const sourceTitle = sourceTitles[index] || `播放源 ${index + 1}`;
        let group = { title: sourceTitle, tracks: [] };

        // 在当前容器内查找所有剧集链接
        $(box).find('ul.content_playlist li a').each((_, trackLink) => {
            group.tracks.push({
                name: $(trackLink).text().trim(),
                pan: '', // 网站未提供网盘信息
                ext: { play_url: $(trackLink).attr('href') }
            });
        });

        if (group.tracks.length > 0) {
            groups.push(group);
        }
    });

    return jsonify({ list: groups });
}

// 5. [未修改] 获取播放信息
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.play_url;
    const { data } = await $fetch.get(url, { headers });
    
    // 使用正则表达式匹配播放地址
    const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
        return jsonify({ urls: [match[1]], ui: 1 });
    }
    return jsonify({ urls: [] });
}
