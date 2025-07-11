const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()
const appConfig = {
  ver: 1,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    {
      name: '剧集',
      ext: { id: '?tagId=42204684250355' },
    },
    {
      name: '电影',
      ext: { id: '?tagId=42204681950354' },
    },
    {
      name: '动漫',
      ext: { id: '?tagId=42204792950357' },
    },
    {
      name: '纪录片',
      ext: { id: '?tagId=42204697150356' },
    },
    {
      name: '综艺',
      ext: { id: '?tagId=42210356650363' },
    },
    {
      name: '影视原盘',
      ext: { id: '?tagId=42212287587456' },
    },
  ],
}

async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  let { page = 1, id } = ext
  const url = appConfig.site + `/${id}&page=${page}`
  const { data } = await $fetch.get(url, {
    headers: {
      'Referer': 'https://www.leijing.xyz/',
      'User-Agent': UA,
    }
  });
  const $ = cheerio.load(data);
  
  $('.topicItem').each((index, each) => {
    // 跳过带锁资源
    if ($(each).find('.cms-lock-solid').length > 0) return;
      
    const href = $(each).find('h2 a').attr('href');
    const title = $(each).find('h2 a').text()
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title; 
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
      
    // 过滤非目标资源
    if (/content/.test(r) && !/cloud/.test(r)) return;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    
    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: '',
      ext: { url: `https://www.leijing.xyz/${href}` },
    });
  });
  
  return jsonify({ list: cards })
}

async function getTracks(ext) {
  ext = argsify(ext)
  const tracks = []
  const url = ext.url
  const { data } = await $fetch.get(url, {
    headers: {
      'Referer': 'https://www.leijing.xyz/',
      'User-Agent': UA,
    }
  });
  
  const $ = cheerio.load(data);
  const pans = new Set(); // 确保链接唯一
  const urlRegex = /(https?:\/\/[^\s（]+)/g;
  
  // 提取页面中所有符合规则的链接
  $('div,p,a').each((index, each) => {
    // 处理链接属性
    const href = ($(each).attr('href') ?? "").replace('http://', 'https://');
    if (href) processUrl(href);
    
    // 处理文本中的链接
    const text = $(each).text().trim();
    const urls = text.match(urlRegex);
    if (urls) urls.forEach(processUrl);
  });
  
  // 处理链接的辅助函数
  function processUrl(url) {
    if (url.startsWith('https://cloud.189.cn/') && !pans.has(url)) {
      pans.add(url);
    }
  }
  
  // 只保留第一个有效链接（符合“每个帖子一个链接”的需求）
  if (pans.size > 0) {
    const panUrl = Array.from(pans)[0];
    // 检测是否需要访问码（通过页面是否含“访问码”“提取码”文本判断）
    const pageText = $('body').text();
    const needCode = /访问码|提取码/.test(pageText);
    
    tracks.push({
      name: "网盘",
      pan: panUrl,
      needCode: needCode, // 新增标识：是否需要访问码
      ext: {}
    });
  }
  
  return jsonify({ 
    list: [{
      title: "默认分组",
      tracks,
    }] 
  })
}

async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] })
}

async function search(ext) {
  ext = argsify(ext)
  let cards = []
  const text = encodeURIComponent(ext.text)
  const page = ext.page || 1
  const url = `${appConfig.site}/search?keyword=${text}&page=${page}`
  const { data } = await $fetch.get(url, {
    headers: { 'User-Agent': UA }
  });
  
  const $ = cheerio.load(data);
  $('.topicItem').each((index, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return;
    
    const href = $(each).find('h2 a').attr('href');
    const title = $(each).find('h2 a').text()
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title; 
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
      
    if (/content/.test(r) && !/cloud/.test(r)) return;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    
    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: '',
      ext: { url: `https://www.leijing.xyz/${href}` },
    });
  });
  
  return jsonify({ list: cards })
}
