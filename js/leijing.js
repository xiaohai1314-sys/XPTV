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
  const pageText = $('body').text();
  
  // 提取链接和访问码
  const linkRegex = /(https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+)/g;
  const codeRegex = /访问码[:：]\s*([a-zA-Z0-9]+)/g;
  
  const links = pageText.match(linkRegex) || [];
  const codes = pageText.match(codeRegex) || [];
  
  // 处理提取到的链接和访问码
  if (links.length > 0) {
    const panUrl = links[0]; // 取第一个链接
    const needCode = codes.length > 0; // 判断是否需要访问码
    const accessCode = codes.length > 0 ? codes[0].replace(/访问码[:：]\s*/, '') : '';
    
    tracks.push({
      name: "网盘",
      pan: panUrl,
      needCode: needCode,
      accessCode: accessCode, // 新增：提取到的访问码
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
