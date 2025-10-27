const cheerio = createCheerio()
const CryptoJS = createCryptoJS()
const UA = “Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36”

const headers = {
‘Referer’: ‘https://alipan.qqjzw.top/’,
‘Origin’: ‘https://alipan.qqjzw.top’,
‘User-Agent’: UA,
}

const appConfig = {
ver: 1,
title: “阿里资源搜索”,
site: “https://alipan.qqjzw.top”,
tabs: [{
name: ‘阿里云盘资源’,
ext: {
url: ‘/’
},
}]
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

async function getTracks(ext) {
const { url, name } = argsify(ext)

return jsonify({
list: [{
title: ‘在线观看’,
tracks: [{
name: name || ‘阿里云盘’,
pan: url,
}]
}]
})
}

async function getPlayinfo(ext) {
return jsonify({
urls: [],
})
}

async function search(ext) {
ext = argsify(ext)
let cards = [];

let text = ext.text
let page = ext.page || 1

// 构建搜索URL（POST请求）
const url = appConfig.site

try {
const { data } = await $fetch.post(url, `q=${encodeURIComponent(text)}&csrf_token=`, {
headers: {
…headers,
‘Content-Type’: ‘application/x-www-form-urlencoded’,
}
})

```
const $ = cheerio.load(data)

// 解析搜索结果
$('.result-card').each((_, element) => {
  const $card = $(element)
  const $content = $card.find('.card-content')
  
  // 提取标题
  const name = $content.find('.result-name').text().trim()
  
  // 提取链接
  const link = $content.find('.result-url a').attr('href') || ''
  
  // 提取时间
  const time = $content.find('.result-time').text().trim()
  
  if (name && link) {
    cards.push({
      vod_id: link,
      vod_name: name,
      vod_pic: '',
      vod_remarks: time || '',
      ext: {
        url: link,
        name: name,
      },
    })
  }
})
```

} catch (error) {
console.error(‘搜索失败:’, error)
}

return jsonify({
list: cards,
})
}

// 导出函数
export default {
getConfig,
getCards,
getTracks,
getPlayinfo,
search,
}
