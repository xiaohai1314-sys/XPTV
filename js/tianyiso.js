const cheerio = createCheerio()
const CryptoJS = createCryptoJS()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
  'Content-Type': 'application/json' // 新增：指定请求体为JSON
}

const appConfig = {
  ver: 1,
  title: "天逸搜",
  site: "https://www.tianyiso.com",
  tabs: [{
    name: '只有搜索功能',
    ext: {
      url: '/'
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
  const { url } = argsify(ext)
  const { data } = await $fetch.get(url, {
    headers
  })
  // 详情页的解析逻辑可能仍然有效，因为它是直接从HTML中提取网盘链接
  // 如果未来详情页结构变化，这里可能需要再次调整
  let pan = data.match(/


("https://cloud.189.cn/t/.*)",/)[1]
  return jsonify({ 
    list: [{
      title: '在线',
      tracks: [{
        name: '网盘',
        pan,
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

  const apiUrl = appConfig.site + '/api/v1/search';
  const payload = {
    keyword: ext.text,
    page: ext.page || 1,
    type: 'all'
  };

  try {
    const { data } = await $fetch.post(apiUrl, payload, {
      headers,
      // 确保将payload序列化为JSON字符串
      body: JSON.stringify(payload)
    });

    // API返回的是JSON，直接解析
    if (data && data.data && Array.isArray(data.data)) {
      data.data.forEach(item => {
        cards.push({
          vod_id: item.Url, // API返回的路径
          vod_name: item.Name, // API返回的标题
          vod_pic: '',
          vod_remarks: '',
          ext: {
            url: appConfig.site + item.Url,
          },
        });
      });
    }
  } catch (error) {
    // 打印错误信息，方便调试
    console.error('Search API request failed:', error);
  }

  return jsonify({
      list: cards,
  });
}


