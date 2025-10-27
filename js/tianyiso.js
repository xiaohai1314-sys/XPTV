const cheerio = createCheerio()
const CryptoJS = createCryptoJS()
const UA = “Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36”

// 修改配置信息
const appConfig = {
ver: 1,
title: “阿里资源搜索”,
site: “http://stp.ezyro.com/al”,  // 实际网站地址
tabs: [{
name: ‘阿里云盘资源’,
ext: {
url: ‘/’
},
}]
}

// Cookie信息（重要：保持会话）
const COOKIE = ‘__test=95c4dfec08fea30ef427a1c3417f3145;PHPSESSID=cc581e65047b9ec13cdf136e244ec053’

const headers = {
‘Referer’: appConfig.site,
‘Origin’: appConfig.site,
‘User-Agent’: UA,
‘Content-Type’: ‘application/x-www-form-urlencoded’,
‘Cookie’: COOKIE,
}

async function getConfig() {
return jsonify(appConfig)
}

async function getCards(ext) {
ext = argsify(ext)
let cards = []
return jsonify({
list: cards,
})
}

// 修改getTracks函数 - 阿里云盘链接
async function getTracks(ext) {
const { url } = argsify(ext)

// 直接返回阿里云盘链接
return jsonify({
list: [{
title: ‘在线’,
tracks: [{
name: ‘阿里云盘’,
pan: url,  // 直接使用阿里云盘链接
}]
}]
})
}

async function getPlayinfo(ext) {
return jsonify({
urls: [],
})
}

// 主要修改：search函数
async function search(ext) {
ext = argsify(ext)
let cards = [];

let text = ext.text
let page = ext.page || 1

// 阿里资源搜索只有一页，page > 1 直接返回空
if (page > 1) {
return jsonify({
list: cards,
})
}

try {
// 第一步：获取首页以获取CSRF token
const homeResponse = await $fetch.get(appConfig.site, {
headers: {
‘User-Agent’: UA,
‘Cookie’: COOKIE,
}
})

```
const $home = cheerio.load(homeResponse.data)
const csrfToken = $home('input[name="csrf_token"]').val()

if (!csrfToken) {
  console.log('无法获取CSRF token')
  return jsonify({ list: cards })
}

// 第二步：POST搜索请求
const formData = `csrf_token=${encodeURIComponent(csrfToken)}&q=${encodeURIComponent(text)}`

const searchResponse = await $fetch.post(appConfig.site, formData, {
  headers: headers
})

// 第三步：解析搜索结果
const $ = cheerio.load(searchResponse.data)

// 根据HTML结构提取数据
$('.result-card').each((_, element) => {
  const $card = $(element)
  
  // 提取标题
  const title = $card.find('.result-name').text().trim()
  
  // 提取阿里云盘链接
  const link = $card.find('.result-url a').attr('href')
  
  // 提取时间
  const time = $card.find('.result-time').text().trim()
  
  if (title && link) {
    cards.push({
      vod_id: link,
      vod_name: title,
      vod_pic: '',
      vod_remarks: time || '',
      ext: {
        url: link,  // 直接使用阿里云盘链接
      },
    })
  }
})
```

} catch (error) {
console.log(‘搜索出错:’, error)
}

return jsonify({
list: cards,
})
}
