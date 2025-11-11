/**
 * ==============================================================================
 * 适配 zhenlang.cc 的最终脚本 (版本 4)
 * * 更新日志:
 * - v4: 修复 getPlayinfo，显式添加 Referer 和 User-Agent，解决播放时 0kb 问题。
 * - v3: 修复 search 函数 URL 拼接错误，恢复搜索功能正常。
 * - v2: 修正 getCards 分页逻辑，适配分类页URL格式。
 * - v1: 初版适配 zhenlang.cc 网站结构。
 * ==============================================================================
 */

const cheerio = createCheerio();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const headers = {
  'Referer': 'https://www.zhenlang.cc/',
  'Origin': 'https://www.zhenlang.cc',
  'User-Agent': UA,
};

// 1. 站点配置
const appConfig = {
  ver: 4, // 版本号更新为 V4
  title: "真狼影视",
  site: "https://www.zhenlang.cc",
  tabs: [
    { name: '首页', ext: { url: '/' } },
    { name: '电影', ext: { url: '/vodshow/dianying-----------.html' } },
    { name: '连续剧', ext: { url: '/vodshow/lianxuju-----------.html' } },
    { name: '综艺', ext: { url: '/vodshow/zongyi-----------.html' } },
    { name: '动漫', ext: { url: '/vodshow/dongman-----------.html' } }
  ]
};

async function getConfig() {
  return jsonify(appConfig);
}

// 2. 获取卡片列表（首页、分类页）
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let urlPath = ext.url;
  let page = ext.page || 1;

  if (page > 1) {
    if (urlPath === '/') {
      return jsonify({ list: [] });
    }
    // 适配分类页分页URL格式：/vodshow/dianying-----------2---.html
    urlPath = urlPath.replace(/(-(\d+))?---.html/, `-----------${page}---.html`);
  }

  const fullUrl = appConfig.site + urlPath;
  const { data } = await $fetch.get(fullUrl, { headers });
  const $ = cheerio.load(data);

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

// 3. 搜索功能 (V3 修复后)
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  // 正确拼接搜索URL
  const searchUrl = `${appConfig.site}/vodsearch/${text}----------${page}---.html`;

  const { data } = await $fetch.get(searchUrl, { headers });
  const $ = cheerio.load(data);

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

// 4. 获取播放列表
async function getTracks(ext) {
  ext = argsify(ext);
  const url = appConfig.site + ext.url;
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
  let groups = [];

  // 播放源标题
  const sourceTitles = [];
  $('div.play_source_tab > a').each((_, a) => {
    sourceTitles.push($(a).attr('alt').trim());
  });

  // 播放列表容器
  $('div.play_list_box').each((index, box) => {
    const sourceTitle = sourceTitles[index] || `播放源 ${index + 1}`;
    let group = { title: sourceTitle, tracks: [] };

    $(box).find('ul.content_playlist li a').each((_, trackLink) => {
      group.tracks.push({
        name: $(trackLink).text().trim(),
        pan: '',
        ext: { play_url: $(trackLink).attr('href') },
      });
    });

    if (group.tracks.length > 0) groups.push(group);
  });

  return jsonify({ list: groups });
}

// 5. ✅ 修复后的获取播放信息 (V4)
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const playPageUrlPath = ext.play_url;
  const url = appConfig.site + playPageUrlPath; // 播放页面的完整 URL
  
  const { data } = await $fetch.get(url, { headers });

  const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
  if (match && match[1]) {
    // 提取到的最终播放 URL
    const finalPlayUrl = match[1]; 
    
    // 关键：构建包含 Referer 和 User-Agent 的对象，用于绕过反盗链
    const playUrlObject = {
      url: finalPlayUrl,
      // 视频播放器加载这个 URL 时，会附带以下请求头
      headers: { 
        // 使用当前集数播放页面的完整 URL 作为 Referer 
        'Referer': url, 
        'User-Agent': UA,
        'Origin': appConfig.site,
      }
    };
    
    // 返回包含请求头信息的播放链接对象
    return jsonify({ urls: [playUrlObject], ui: 1 });
  }
  return jsonify({ urls: [] });
}
