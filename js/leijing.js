const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 1,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
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
      'Referer': appConfig.site + '/',
      'User-Agent': UA,
    }
  });

  const $ = cheerio.load(data)

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
      ext: {
        url: `${appConfig.site}/${href}`,
      },
    });
  })

  return jsonify({ list: cards })
}

async function getTracks(ext) {
  ext = argsify(ext)
  var tracks = []
  let url = ext.url

  const { data } = await $fetch.get(url, {
    headers: {
      'Referer': appConfig.site + '/',
      'User-Agent': UA,
    }
  });

  const $ = cheerio.load(data)
  const pans = new Set()
  const urlRegex = /(https?:\/\/[^\s（]+)/g
  const codeRegex = /(提取码|密码)[:：]?\s*([a-zA-Z0-9]{4})/i

  $('div, p, a').each((index, each) => {
    const text = $(each).text().trim()
    const codeMatch = text.match(codeRegex)
    const code = codeMatch ? codeMatch[2] : ''

    const href = ($(each).attr('href') ?? "").replace('http://', 'https://')
    if (href.startsWith('https://cloud.189.cn/') && !pans.has(href)) {
      pans.add(href)
      tracks.push({
        name: code ? `网盘(码:${code})` : "网盘",
        pan: href,
        ext: code ? { code } : {}
      })
    }

    const urls = text.match(urlRegex)
    if (urls) {
      urls.forEach(link => {
        link = link.replace('http://', 'https://')
        if (link.startsWith('https://cloud.189.cn/') && !pans.has(link)) {
          pans.add(link)
          tracks.push({
            name: code ? `网盘(码:${code})` : "网盘",
            pan: link,
            ext: code ? { code } : {}
          })
        }
      })
    }
  })

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

  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`

  const { data } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
    },
  })

  const $ = cheerio.load(data)

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
      ext: {
        url: `${appConfig.site}/${href}`,
      },
    });
  })

  return jsonify({ list: cards })
}
