// 这个前端脚本现在非常简单，只负责调用后端API和展示数据
// 它不再需要 cheerio 或 crypto-js

// 您的后端服务器地址。
// 如果您在本地测试，就是 'http://localhost:3000' 或您的局域网IP
// 如果部署到云服务器 ，就换成您的服务器公网地址或域名。
const BACKEND_API_HOST = 'http://192.168.10.103:3000'; // <--- !! 请务必修改成您的后端服务器地址 !!

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

// headers 现在只用于标识User-Agent，以备不时之需
const headers = {
  'User-Agent': UA,
};

const appConfig = {
  ver: 1,
  title: "天逸搜",
  site: "https://www.tianyiso.com", // 这个site现在几乎没用了 ，但保留以防万一
  tabs: [{
    name: '只有搜索功能',
    ext: {
      url: '/'
    },
  }]
};

// =================================================================
//  无需修改的函数
// =================================================================
async function getConfig() {
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

// =================================================================
//  search 函数 (调用后端 /search API)
// =================================================================
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let page = ext.page || 1;

  // 您的后端API目前只支持第一页
  if (page > 1) {
    return jsonify({
      list: cards,
    });
  }

  // 1. 构造指向您自己后端服务器的 /search API URL
  const apiUrl = `${BACKEND_API_HOST}/search?keyword=${encodeURIComponent(ext.text)}`;
  console.log('前端请求搜索API:', apiUrl);

  try {
    // 2. 使用 $fetch.get 请求您自己的后端API
    const { data } = await $fetch.get(apiUrl, {
      headers,
      timeout: 60000 // 超时时间设置长一点，因为后端Puppeteer需要时间
    });

    // 3. 解析后端返回的JSON数据
    let responseData = (typeof data === 'string') ? JSON.parse(data) : data;
    
    // 4. 直接使用后端处理好的 cards 列表
    if (responseData && responseData.list && responseData.list.length > 0) {
        cards = responseData.list;
        console.log(`成功从后端获取到 ${cards.length} 个搜索结果。`);
    } else {
        cards.push({
            vod_id: 'no_results_from_backend',
            vod_name: '未找到相关资源',
            vod_pic: '',
            vod_remarks: '请尝试其他关键词',
            ext: { url: '' },
        });
    }

  } catch (error) {
    console.log('请求后端搜索API时发生错误:', error);
    cards.push({
      vod_id: 'api_error',
      vod_name: `请求后端服务器失败`,
      vod_pic: '',
      vod_remarks: error.message || '网络错误，请检查后端服务器是否在线',
      ext: { url: '' },
    });
  }

  return jsonify({
    list: cards,
  });
}

// =================================================================
//  getTracks 函数 (调用后端 /getTracks API)
// =================================================================
async function getTracks(ext) {
    const { url } = argsify(ext);
    
    // 1. 构造指向后端 /getTracks API 的 URL
    const apiUrl = `${BACKEND_API_HOST}/getTracks?url=${encodeURIComponent(url)}`;
    console.log('前端请求详情页API:', apiUrl);

    try {
        // 2. 请求后端API
        const { data } = await $fetch.get(apiUrl, { timeout: 60000 });
        
        // 3. 解析返回的JSON
        let responseData = (typeof data === 'string') ? JSON.parse(data) : data;
        
        // 4. 如果后端成功返回了数据，就直接使用
        if (responseData && responseData.list) {
            console.log('成功从后端获取到详情页资源链接。');
            return jsonify(responseData);
        }
        
    } catch (error) {
        console.log('请求后端详情页API时出错:', error);
    }

    // 如果请求失败或后端没有返回有效数据，给出一个默认的错误/提示
    return jsonify({
        list: [{
            title: '错误',
            tracks: [{
                name: '获取资源链接失败',
                pan: url, // 仍然提供原始链接，让用户可以手动尝试
            }]
        }]
    });
}
