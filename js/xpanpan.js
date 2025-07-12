const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社区',
  site: 'https://www.wpzysq.com',
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-2?page=' }
    },
    {
      name: '4k专区',
      ext: { id: 'forum-36?page=' }
    },
    {
      name: '动漫区',
      ext: { id: 'forum-3?page=' }
    }
  ],
};

// 调试日志函数
function log(message) {
  try {
    $log(`[网盘资源社] ${message}`);
  } catch (e) {
    // 备用处理
  }
}

// 显示调试弹窗
function showDebugAlert(title, content) {
  try {
    $utils.alert(title, content);
  } catch (e) {
    log(`无法显示弹窗: ${e.message}`);
  }
}

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  try {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    
    // 确保页码有效
    page = Math.max(1, parseInt(page) || 1);
    
    // 构建URL
    const url = `${appConfig.site}/${id}${page}`;
    log(`加载卡片: ${url}`);
    
    // 显示加载提示
    showDebugAlert("调试信息", `正在加载: ${url}`);

    // 发送请求
    const { data, status } = await $fetch.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });

    if (status !== 200) {
      log(`请求失败: HTTP ${status}`);
      showDebugAlert("请求失败", `HTTP状态码: ${status}`);
      return jsonify({ list: [] });
    }
    
    // 检查响应内容
    log(`响应长度: ${data.length} 字符`);
    if (data.length < 500) {
      log(`响应内容过短: ${data}`);
      showDebugAlert("响应过短", `内容: ${data.substring(0, 200)}...`);
    }

    const $ = cheerio.load(data);
    
    // 方法1: 尝试从脚本中提取JSON数据
    const scriptContent = $('script').filter((_, script) => {
      return $(script).html() && $(script).html().includes('_obj');
    }).html();
    
    if (scriptContent) {
      log("尝试从脚本中提取数据");
      showDebugAlert("解析方法", "尝试从脚本中提取JSON数据");
      
      try {
        // 查找可能的JSON结构
        const jsonMatches = scriptContent.match(/_obj\s*=\s*({[^;]+});/);
        if (jsonMatches && jsonMatches[1]) {
          const objData = JSON.parse(jsonMatches[1]);
          
          if (objData.inlist && objData.inlist.i) {
            objData.inlist.i.forEach((item, index) => {
              cards.push({
                vod_id: item,
                vod_name: objData.inlist.t[index],
                vod_pic: `https://s.tutu.pm/img/${objData.inlist.ty}/${item}.webp`,
                vod_remarks: objData.inlist.g[index],
                ext: {
                  url: `${appConfig.site}/res/downurl/${objData.inlist.ty}/${item}`,
                  postId: item
                },
              });
            });
            
            log(`从脚本中提取到 ${cards.length} 张卡片`);
            showDebugAlert("解析成功", `找到 ${cards.length} 张卡片`);
            return jsonify({ list: cards });
          }
        }
      } catch (e) {
        log(`JSON解析错误: ${e.message}`);
        showDebugAlert("JSON解析错误", e.message);
      }
    }
    
    // 方法2: 尝试通用HTML解析
    log("回退到HTML解析");
    showDebugAlert("解析方法", "回退到HTML解析");
    
    // 最通用的选择器
    const listItems = $('body').find('div, section, article, ul, li').filter((i, el) => {
      return $(el).find('a').length > 0 && $(el).text().trim().length > 20;
    });
    
    log(`找到 ${listItems.length} 个可能包含卡片的元素`);
    
    listItems.each((index, element) => {
      try {
        const linkElement = $(element).find('a').first();
        const title = linkElement.text().trim() || $(element).text().trim().substring(0, 50);
        const href = linkElement.attr('href');
        
        if (!href || !title) return;
        
        // 图片
        const imgElement = $(element).find('img').first();
        const imgSrc = imgElement.attr('src') || imgElement.attr('data-src') || '';
        
        // 提取帖子ID
        const postId = href.match(/thread-(\d+)/)?.[1] || '';
        
        cards.push({
          vod_id: href,
          vod_name: title,
          vod_pic: imgSrc,
          vod_remarks: '',
          ext: {
            url: href.startsWith('http') ? href : `${appConfig.site}/${href}`,
            postId
          },
        });
      } catch (e) {
        log(`解析元素错误: ${e.message}`);
      }
    });

    log(`成功解析 ${cards.length} 张卡片`);
    
    // 如果没有卡片，显示HTML结构用于调试
    if (cards.length === 0) {
      const htmlSample = $.html().substring(0, 1000);
      log("未找到卡片，HTML片段:\n" + htmlSample);
      showDebugAlert("HTML结构", htmlSample);
    } else {
      showDebugAlert("解析成功", `找到 ${cards.length} 张卡片`);
    }
    
    return jsonify({ list: cards });
  } catch (error) {
    log(`获取卡片错误: ${error.message}`);
    showDebugAlert("脚本错误", error.message);
    return jsonify({ list: [] });
  }
}

async function getTracks(ext) {
  try {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url;
    
    if (!url) {
      log("缺少URL参数");
      showDebugAlert("参数错误", "缺少URL参数");
      return jsonify({ list: [] });
    }
    
    log(`加载资源: ${url}`);
    showDebugAlert("加载资源", url);

    // 发送请求
    const { data, status } = await $fetch.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 15000
    });
    
    if (status !== 200) {
      log(`请求失败: HTTP ${status}`);
      showDebugAlert("请求失败", `HTTP状态码: ${status}`);
      return jsonify({ list: [] });
    }
    
    // 尝试解析JSON响应
    if (data.startsWith('{') || data.startsWith('[')) {
      try {
        const jsonData = JSON.parse(data);
        
        if (jsonData.panlist && jsonData.panlist.url) {
          log("找到JSON格式的网盘数据");
          
          jsonData.panlist.url.forEach((link, index) => {
            tracks.push({
              name: jsonData.panlist.name[index] || "网盘资源",
              pan: link,
              ext: {}
            });
          });
          
          showDebugAlert("资源获取", `找到 ${tracks.length} 个网盘链接`);
          return jsonify({ 
            list: [{
              title: "网盘资源",
              tracks,
            }]
          });
        }
      } catch (e) {
        log(`JSON解析错误: ${e.message}`);
      }
    }
    
    // 回退到HTML解析
    log("回退到HTML解析资源");
    showDebugAlert("解析方法", "回退到HTML解析");
    
    const $ = cheerio.load(data);
    
    // 最通用的链接提取
    $('a').each((index, element) => {
      const href = $(element).attr('href') || '';
      const text = $(element).text().trim();
      
      // 筛选网盘链接
      if ((href.includes('quark.cn') || href.includes('aliyundrive.com')) {
        tracks.push({
          name: text || "网盘资源",
          pan: href,
          ext: {}
        });
      }
    });
    
    log(`提取到 ${tracks.length} 个网盘链接`);
    
    if (tracks.length === 0) {
      const htmlSample = $.html().substring(0, 1000);
      log("未找到网盘链接，HTML片段:\n" + htmlSample);
      showDebugAlert("HTML结构", htmlSample);
    } else {
      showDebugAlert("资源获取", `找到 ${tracks.length} 个网盘链接`);
    }
    
    return jsonify({ 
      list: [{
        title: "网盘资源",
        tracks,
      }]
    });
  } catch (error) {
    log(`获取资源错误: ${error.message}`);
    showDebugAlert("脚本错误", error.message);
    return jsonify({ list: [] });
  }
}

async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] });
}

async function search(ext) {
  try {
    ext = argsify(ext);
    let cards = [];
    let text = ext.text || '';
    let page = Math.max(1, parseInt(ext.page) || 1);
    
    if (!text) {
      log("缺少搜索关键词");
      showDebugAlert("参数错误", "缺少搜索关键词");
      return jsonify({ list: [] });
    }
    
    // 构建搜索URL
    const url = `${appConfig.site}/search.php?q=${encodeURIComponent(text)}&page=${page}`;
    log(`搜索: ${text}, 页码: ${page}, URL: ${url}`);
    showDebugAlert("搜索请求", url);

    const { data, status } = await $fetch.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    if (status !== 200) {
      log(`搜索请求失败: HTTP ${status}`);
      showDebugAlert("请求失败", `HTTP状态码: ${status}`);
      return jsonify({ list: [] });
    }
    
    const $ = cheerio.load(data);
    
    // 最通用的搜索解析
    $('div, section, article').each((index, element) => {
      try {
        const linkElement = $(element).find('a').first();
        const title = linkElement.text().trim() || $(element).text().trim().substring(0, 50);
        const href = linkElement.attr('href');
        
        if (!href || !title || title.length < 3) return;
        
        cards.push({
          vod_id: href,
          vod_name: title,
          vod_pic: '',
          vod_remarks: '',
          ext: {
            url: href.startsWith('http') ? href : `${appConfig.site}/${href}`,
          },
        });
      } catch (e) {
        log(`解析搜索结果错误: ${e.message}`);
      }
    });

    log(`成功解析 ${cards.length} 个搜索结果`);
    showDebugAlert("搜索结果", `找到 ${cards.length} 个结果`);
    
    return jsonify({ list: cards });
  } catch (error) {
    log(`搜索错误: ${error.message}`);
    showDebugAlert("脚本错误", error.message);
    return jsonify({ list: [] });
  }
}
