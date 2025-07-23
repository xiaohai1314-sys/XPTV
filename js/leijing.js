const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 10,
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

async function getConfig( ) {
  return jsonify(appConfig)
}

async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  let { page = 1, id } = ext
  const url = appConfig.site + `/${id}&page=${page}`
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } })
  const $ = cheerio.load(data)
  $('.topicItem').each((index, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return
    const href = $(each).find('h2 a').attr('href')
    const title = $(each).find('h2 a').text()
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/
    const match = title.match(regex)
    const dramaName = match ? match[1] : title
    const r = $(each).find('.summary').text()
    const tag = $(each).find('.tag').text()
    if (/content/.test(r) && !/cloud/.test(r)) return
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return
    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    })
  })
  return jsonify({ list: cards })
}

// =================================================================================
// --- 逻辑隔离方案 ---
// =================================================================================

// --- 您的原始 getTracks 函数，100%保留，只做重命名 ---
async function getTracks_Original(ext, $, initialData) {
  console.log("执行原始扫描逻辑 (getTracks_Original)...")
  const tracks = []
  const uniqueLinks = new Set()
  const title = $('h1').text().trim() || "网盘资源"
  
  let globalAccessCode = ''
  const bodyText = $('body').text()
  const globalCodeMatch = bodyText.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i)
  if (globalCodeMatch) globalAccessCode = globalCodeMatch[1]

  $('a, button').each((i, el) => {
    const $el = $(el)
    const text = $el.text().trim().toLowerCase()
    if (text.includes('资源链接') || text.includes('下载链接') || text.includes('网盘链接')) {
      const href = $el.attr('href')
      if (href && isValidPanUrl(href)) {
        const normalizedUrl = normalizePanUrl(href)
        if (uniqueLinks.has(normalizedUrl)) return
        uniqueLinks.add(normalizedUrl)
        let accessCode = globalAccessCode
        const contextText = $el.closest('div').text() + $el.next().text()
        const localCode = extractAccessCode(contextText)
        if (localCode) accessCode = localCode
        tracks.push({ name: title, pan: href, ext: { accessCode } })
      }
    }
  })

  if (tracks.length === 0) {
    scanForLinks(bodyText, tracks, globalAccessCode, uniqueLinks, title)
  }

  if (tracks.length === 0) {
    const deepPattern = /(https?:\/\/ )?cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi
    let match
    while ((match = deepPattern.exec(bodyText)) !== null) {
      const panUrl = match[0].startsWith('http' ) ? match[0] : 'https://' + match[0]
      if (isValidPanUrl(panUrl )) {
        const normalizedUrl = normalizePanUrl(panUrl)
        if (uniqueLinks.has(normalizedUrl)) continue
        uniqueLinks.add(normalizedUrl)
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: globalAccessCode } })
      }
    }
  }
  return jsonify({ list: [{ title: "资源列表", tracks }] })
}

// --- 全新的、独立的函数，专门处理“直达链接”按钮 ---
async function getTracks_Redirect(ext, $, initialResponse) {
  console.log("发现'直达链接'按钮，执行新逻辑 (getTracks_Redirect)...")
  const tracks = []
  const detailUrl = ext.url
  const title = $('h1').text().trim() || "网盘资源"
  
  const redirectButton = $('a.btn-primary:contains("直达链接")')
  const redirectHref = redirectButton.attr('href')
  if (!redirectHref) {
    return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "按钮无链接", pan: "", ext: {} }] }] })
  }

  const setCookieHeader = initialResponse.headers['set-cookie']
  const cookie = Array.isArray(setCookieHeader) ? setCookieHeader.map(c => c.split(';')[0]).join('; ') : ''
  
  const redirectUrl = new URL(redirectHref, appConfig.site).toString()
  let finalPanUrl = ''
  try {
    const redirectResponse = await $fetch.get(redirectUrl, {
      headers: { 'User-Agent': UA, 'Referer': detailUrl, 'Cookie': cookie },
      maxRedirects: 0,
    })
  } catch (e) {
    if (e.response && e.response.headers && e.response.headers.location) {
      finalPanUrl = e.response.headers.location
    }
  }

  if (finalPanUrl && isValidPanUrl(finalPanUrl)) {
    let accessCode = ''
    const codeMatch = $('body').text().match(/(?:访问码|密码|提取码)[:：]?\s*([a-z0-9]{4,6})\b/i)
    if (codeMatch) accessCode = codeMatch[1]
    tracks.push({ name: title, pan: finalPanUrl, ext: { accessCode } })
  }
  
  return jsonify({ list: [{ title: "资源列表", tracks }] })
}

// --- 主入口和调度函数 ---
async function getTracks(ext) {
  ext = argsify(ext)
  try {
    const response = await $fetch.get(ext.url, {
      headers: { 'Referer': appConfig.site, 'User-Agent': UA }
    })
    const data = response.data
    const $ = cheerio.load(data)

    // 调度逻辑：检查页面是否存在按钮
    if ($('a.btn-primary:contains("直达链接")').length > 0) {
      // 如果有按钮，调用新函数处理
      return await getTracks_Redirect(ext, $, response)
    } else {
      // 如果没有按钮，调用原始函数处理
      return await getTracks_Original(ext, $, data)
    }
  } catch (e) {
    console.error("getTracks 主函数发生严重错误:", e)
    return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败，请检查网络或脚本", pan: e.message, ext: {} }] }] })
  }
}

// =================================================================================
// --- 辅助函数 (您的原始版本) ---
// =================================================================================
function scanForLinks(text, tracks, globalAccessCode, uniqueLinks, title) {
  if (!text) return
  const panMatches = [];
  const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[^\s<)]+/gi;
  let match;
  while ((match = urlPattern.exec(text)) !== null) { panMatches.push(match[0]); }
  const shortPattern = /cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi;
  while ((match = shortPattern.exec(text)) !== null) { panMatches.push('https://' + match[0] ); }
  const uniquePanMatches = [...new Set(panMatches)];
  uniquePanMatches.forEach(panUrl => {
    if (!isValidPanUrl(panUrl)) return;
    const normalizedUrl = normalizePanUrl(panUrl);
    if (uniqueLinks.has(normalizedUrl)) return;
    uniqueLinks.add(normalizedUrl);
    let accessCode = globalAccessCode;
    const index = text.indexOf(panUrl);
    if (index !== -1) {
      const contextText = text.substring(Math.max(0, index - 100), Math.min(text.length, index + panUrl.length + 100));
      const localCode = extractAccessCode(contextText);
      if (localCode) accessCode = localCode;
      const directMatch = contextText.match(new RegExp(`${escapeRegExp(panUrl)}[\\s\\S]{0,30}?(?:访问码|密码|访问密码|提取码|code)[:：]?\\s*([a-z0-9]{4,6})`, 'i'));
      if (directMatch && directMatch[1]) accessCode = directMatch[1];
    }
    tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
  });
}
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function extractAccessCode(text) {
  if (!text) return '';
  let match = text.match(/[\[【]访问码[:：]\s*([a-z0-9]{4,6})[\]】]/i);
  if (match) return match[1];
  match = text.match(/[\(（]密码[:：]\s*([a-z0-9]{4,6})[\)）]/i);
  if (match) return match[1];
  match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\\s*([a-z0-9]{4,6})\b/i);
  if (match) return match[1];
  const standalone = text.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/i);
  if (standalone) {
    const code = standalone[1];
    if (!/^\d+$/.test(code) && !/^[a-z]+$/i.test(code) && !/^\d{4}$/.test(code)) { return code; }
  }
  return '';
}
function isValidPanUrl(url) { return url ? /https?:\/\/cloud\.189\.cn\/(t|web\/share )\//i.test(url) : false; }
function normalizePanUrl(url) { return url.replace(/\?.*$/, '').toLowerCase(); }
async function getPlayinfo(ext) { return jsonify({ 'urls': [] }); }

// =================================================================================
// --- 修复后的 search 函数 ---
// =================================================================================
async function search(ext) {
  ext = argsify(ext)
  let cards = []
  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`

  const { data } = await $fetch.get(url, {
    headers: {
      'User-Agent': UA,
      'Referer': appConfig.site,
    },
  })

  const $ = cheerio.load(data)
  $('.topicItem').each((index, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return
    const href = $(each).find('h2 a').attr('href')
    const title = $(each).find('h2 a').text()
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/
    const match = title.match(regex)
    const dramaName = match ? match[1] : title
    const r = $(each).find('.summary').text()
    const tag = $(each).find('.tag').text()
    if (/content/.test(r) && !/cloud/.test(r)) return
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return
    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    })
  })
  return jsonify({ list: cards })
}
