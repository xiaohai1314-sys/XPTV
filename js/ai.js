/**
 * ==============================================================================
 * 适配 zhenlang.cc 的最终脚本 (版本 3)
 *
 * 更新日志:
 * - v3: [重大修正] 严格遵循参考脚本的设计模式。
 *       - search 函数仅处理第一页搜索，后续分页通过 getCards 处理。
 *       - getCards 函数增加对搜索分页URL格式的支持。
 * - v2: 修正了 search 函数中 URL 拼接的语法错误。
 * - v1: 基于参考脚本，适配了 zhenlang.cc 的网站结构。
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

// 1. 站点配置
const appConfig = {
  ver: 3,
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

// 2. [已修改] 获取卡片列表（现在也处理搜索分页）
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
      if (urlPath === '/') {
          return jsonify({ list: [] });
      }
      // ✅ 统一处理分类页和搜索页的分页URL格式
      // 格式为：/vodshow/dianying-----------2---.html
      // 或：   /vodsearch/关键词----------2---.html
      urlPath = urlPath.replace(/(-(\d+))?---.html/, `----------${page}---.html`);
  }
  
  const fullUrl = appConfig.site + urlPath;
  const { data } = await $fetch.get(fullUrl, { headers });
  const $ = cheerio.load(data);

  // 根据页面类型选择不同的选择器
  const isSearchPage = urlPath.includes('/vodsearch/');
  const listItemSelector = isSearchPage ? 'li.searchlist_item' : 'ul.vodlist > li.vodlist_item';
  const titleSelector = isSearchPage ? 'h4.vodlist_title > a' : 'p.vodlist_title > a';

  $(listItemSelector).each((_, each) => {
    const thumb = $(each).find('a.vodlist_thumb');
    const titleLink = $(each).find(titleSelector);
    
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

// 3. [已修正] 严格按照参考脚本逻辑的 search 函数
async function search(ext) {
  ext = argsify(ext);
  const text = encodeURIComponent(ext.text);
  
  // ✅ search 函数只负责第一页的搜索，并为后续分页提供路由信息
  const searchUrlPath = `/vodsearch/${text}----------1---.html`;
  
  // 直接调用 getCards 来获取第一页的数据
  const result = await getCards(jsonify({ url: searchUrlPath, page: 1 }));
  const cards = JSON.parse(result).list;

  // ✅ 为后续分页提供路由到 getCards 的 ext 信息
  return jsonify({
    list: cards,
    ext: {
      route: 'getCards', // 指示后续分页调用 getCards 函数
      url: searchUrlPath, // 提供基础URL供 getCards 进行分页处理
    }
  });
}

// 4. [已修改] 获取播放列表
async function getTracks(ext) {
    ext = argsify(ext);
    const url = appConfig.site + ext.url;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);
    let groups = [];

    const sourceTitles = [];
    $('div.play_source_tab > a').each((_, a) => {
        sourceTitles.push($(a).attr('alt').trim());
    });

    $('div.play_list_box').each((index, box) => {
        const sourceTitle = sourceTitles[index] || `播放源 ${index + 1}`;
        let group = { title: sourceTitle, tracks: [] };

        $(box).find('ul.content_playlist li a').each((_, trackLink) => {
            group.tracks.push({
                name: $(trackLink).text().trim(),
                pan: '',
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
    
    const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
        return jsonify({ urls: [match[1]], ui: 1 });
    }
    return jsonify({ urls: [] });
}
