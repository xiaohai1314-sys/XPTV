const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社区',
  site: 'https://www.wpzysq.com',
  tabs: [
    {
      name: '影视/剧集',
      ext: {
        id: 'forum-1?page=', // 修正forum id
      },
    },
    {
      name: '4k专区',
      ext: {
        id: 'forum-12?page=', // 修正forum id
      },
    },
    {
      name: '动漫区',
      ext: {
        id: 'forum-3?page=', // 修正forum id
      },
    }
  ],
};

// 增加CORS代理
const proxyUrl = 'https://cors-anywhere.herokuapp.com/';

// 调试日志函数
function log(message) {
  try {
    $log(`[网盘资源社] ${message}`);
  } catch (e) {
    // 如果$log不可用，忽略
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
    
    // 使用修正后的URL格式
    const url = `${appConfig.site}/${id}${page}`;
    log(`加载卡片: ${url}`);

    const { data, status } = await $fetch.get(proxyUrl + url, { // 使用CORS代理
      headers: { 'User-Agent': UA },
      timeout: 10000
    });

    if (status !== 200) {
      log(`请求失败: HTTP ${status}`);
      return jsonify({ list: [] });
    }

    const $ = cheerio.load(data);
    
    // 使用修正后的选择器
    $('.threadlist li.thread').each((index, element) => {
      try {
        const titleEl = $(element).find('.style3_subject a');
        const title = titleEl.text().trim();
        const href = titleEl.attr('href');
        
        if (!href || !title) return;
        
        // 图片
        const imgEl = $(element).find('.thread-image, .thumbnail');
        const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
        
        // 备注信息
        const remarksEl = $(element).find('.thread-meta, .thread-info');
        const remarks = remarksEl.text().trim();
        
        // 提取帖子ID
        const postId = href.match(/thread-(\d+)/)?.[1] || '';
        
        cards.push({
          vod_id: href,
          vod_name: title,
          vod_pic: imgSrc,
          vod_remarks: remarks,
          ext: {
            url: href.startsWith('http') ? href : `${appConfig.site}/${href}`,
            postId
          },
        });
      } catch (e) {
        log(`解析帖子错误: ${e.message}`);
      }
    });

    log(`成功解析 ${cards.length} 张卡片`);
    
    return jsonify({ list: cards });
  } catch (error) {
    log(`获取卡片错误: ${error.message}`);
    return jsonify({ list: [] });
  }
}

async function getTracks(ext) {
  try {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url;
    const postId = ext.postId || '';
    
    if (!url) {
      log("缺少URL参数");
      return jsonify({ list: [] });
    }
    
    log(`加载资源: ${url}, 帖子ID: ${postId}`);

    const { data, status } = await $fetch.get(proxyUrl + url, { // 使用CORS代理
      headers: { 'User-Agent': UA },
      timeout: 15000
    });
    
    if (status !== 200) {
      log(`请求失败: HTTP ${status}`);
      return jsonify({ list: [] });
    }
    
    // 使用修正后的HTML解析逻辑
    const $ = cheerio.load(data);
    
    // 检查资源是否失效
    const isExpired = $('.expired-tag, span:contains("有人标记失效"), font:contains("失效")').length > 0;
    if (isExpired) {
      log("资源已标记为失效");
      return jsonify({ list: [] });
    }
    
    // 直接提取网盘链接
    const links = extractPanLinks(data);
    log(`提取到 ${links.length} 个网盘链接`);
    
    tracks = links.map(link => ({
      name: "网盘资源",
      pan: link,
      ext: {}
    }));
    
    return jsonify({ 
      list: [{
        title: "网盘资源",
        tracks,
      }]
    });
  } catch (error) {
    log(`获取资源错误: ${error.message}`);
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
      return jsonify({ list: [] });
    }
    
    // 使用修正后的搜索URL格式
    const url = `${appConfig.site}/search/${encodeURIComponent(text)}-page-${page}.html`;
    log(`搜索: ${text}, 页码: ${page}, URL: ${url}`);

    const { data, status } = await $fetch.get(proxyUrl + url, { // 使用CORS代理
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    if (status !== 200) {
      log(`搜索请求失败: HTTP ${status}`);
      return jsonify({ list: [] });
    }

    const $ = cheerio.load(data);
    
    // 使用修正后的选择器
    $('.search-list li').each((index, element) => {
      try {
        const titleEl = $(element).find('.result_title a');
        const title = titleEl.text().trim();
        const href = titleEl.attr('href');
        
        if (!href || !title) return;
        
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
    return jsonify({ list: cards });
  } catch (error) {
    log(`搜索错误: ${error.message}`);
    return jsonify({ list: [] });
  }
}

// 提取网盘链接的辅助函数
function extractPanLinks(html) {
  try {
    // 在整个网页中搜索网盘链接
    const linkRegex = /(https?:\/\/[^\s'"]+)/g;
    const matches = html.match(linkRegex) || [];
    
    // 筛选夸克和阿里云盘链接
    return matches.filter(link => 
      (link.includes('quark.cn') || 
       link.includes('aliyundrive.com')) &&
      !link.includes('wpzysq.com') && // 过滤本站链接
      !link.includes('.css') &&       // 过滤CSS文件
      !link.includes('.js')           // 过滤JS文件
    );
  } catch (e) {
    log(`提取链接错误: ${e.message}`);
    return [];
  }
}
