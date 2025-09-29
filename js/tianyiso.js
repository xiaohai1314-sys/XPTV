// 这个前端脚本现在非常简单，不再需要 Cheerio 或 CryptoJS
// const cheerio = createCheerio()
// const CryptoJS = createCryptoJS()

// 您的后端服务器地址。
// 如果您在本地测试，就是 'http://localhost:3000'
// 如果部署到云服务器 ，就换成您的服务器公网地址或域名。
const BACKEND_API_HOST = 'http://192.168.10.103:3000'; // <--- !! 请务必修改成您的后端服务器地址 !!

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

// headers 现在可能不是必需的了，因为请求是发给您自己的服务器
const headers = {
  'User-Agent': UA,
};

const appConfig = {
  ver: 1,
  title: "天逸搜",
  site: "https://www.tianyiso.com", // 这个site现在主要用于拼接详情页链接
  tabs: [{
    name: '只有搜索功能',
    ext: {
      url: '/'
    },
  }]
};

// getConfig, getCards, getPlayinfo 函数保持不变
async function getConfig( ) {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  return jsonify({
    list: cards,
  });
}

async function getPlayinfo(ext) {
  return jsonify({
    urls: [],
  });
}


// getTracks 函数也需要修改，让它去调用后端的 /getTracks API
// (我们稍后可以实现这个)
async function getTracks(ext) {
    // ... 暂时保持原样，但最终也需要改成调用后端API
    const { url } = argsify(ext);
    return jsonify({
        list: [{
            title: '需要手动访问',
            tracks: [{
                name: '点击打开网页',
                pan: url,
            }]
        }]
    });
}


// =================================================================
//  核心修改在这里：search 函数
// =================================================================
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let page = ext.page || 1;

  // 您的后端API目前只支持第一页，所以这里保持不变
  if (page > 1) {
    return jsonify({
      list: cards,
    });
  }

  // 1. 构造指向您自己后端服务器的API URL
  const apiUrl = `${BACKEND_API_HOST}/search?keyword=${encodeURIComponent(ext.text)}`;
  console.log('前端请求API URL:', apiUrl);

  try {
    // 2. 使用 $fetch.get 请求您自己的后端API
    const { data } = await $fetch.get(apiUrl, {
      headers,
      timeout: 60000 // 超时时间可以长一点，因为后端Puppeteer需要时间
    });

    // 3. 解析后端返回的JSON数据
    //    注意：根据您环境的$fetch实现，data可能已经是JSON对象，也可能是JSON字符串
    let responseData;
    if (typeof data === 'string') {
        responseData = JSON.parse(data);
    } else {
        responseData = data;
    }
    
    // 4. 直接使用后端处理好的 cards 列表
    if (responseData && responseData.list && responseData.list.length > 0) {
        cards = responseData.list;
        console.log(`成功从后端获取到 ${cards.length} 个结果。`);
    } else {
        // 如果后端没有返回结果或返回空列表
        cards.push({
            vod_id: 'no_results_from_backend',
            vod_name: '后端未返回有效结果',
            vod_pic: '',
            vod_remarks: '请检查后端服务器状态',
            ext: { url: '' },
        });
    }

  } catch (error) {
    console.log('请求后端API时发生错误:', error);
    cards.push({
      vod_id: 'api_error',
      vod_name: `前端请求后端失败`,
      vod_pic: '',
      vod_remarks: error.message || '网络错误，请检查后端服务器是否在线',
      ext: { url: '' },
    });
  }

  return jsonify({
    list: cards,
  });
}
