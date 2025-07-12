const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社区',
  site: 'https://www.wpzysq.com',
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-2-' } // 使用类似guangying.js的ID格式
    },
    {
      name: '4k专区',
      ext: { id: 'forum-36-' }
    },
    {
      name: '动漫区',
      ext: { id: 'forum-3-' }
    }
  ],
};

// 存储已回复的帖子ID
const repliedPosts = new Set();

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
    
    // 使用类似guangying.js的URL构建方式
    const url = `${appConfig.site}/${id}${page}.html`;
    log(`加载卡片: ${url}`);

    const { data, status } = await $fetch.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });

    if (status !== 200) {
      log(`请求失败: HTTP ${status}`);
      return jsonify({ list: [] });
    }

    const $ = cheerio.load(data);
    
    // 尝试guangying.js的解析方法：从脚本中提取数据
    const scriptContent = $('script').filter((_, script) => {
      return $(script).html().includes('var data');
    }).html();
    
    if (scriptContent) {
      log("尝试从脚本中提取数据");
      
      // 提取JSON数据
      const jsonMatch = scriptContent.match(/var data\s*=\s*({.*?});/s);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          
          // 处理提取的数据
          jsonData.items.forEach(item => {
            cards.push({
              vod_id: item.id,
              vod_name: item.title,
              vod_pic: item.image,
              vod_remarks: item.info,
              ext: {
                url: `${appConfig.site}/thread-${item.id}-1-1.html`,
                postId: item.id
              },
            });
          });
          
          log(`从脚本中提取到 ${cards.length} 张卡片`);
          return jsonify({ list: cards });
        } catch (e) {
          log(`解析JSON错误: ${e.message}`);
        }
      }
    }
    
    log("回退到HTML解析");
    
    // 如果脚本解析失败，使用HTML解析
    const threadItems = $('tbody[id^="normalthread_"]');
    log(`找到 ${threadItems.length} 个帖子`);
    
    threadItems.each((index, element) => {
      try {
        // 跳过置顶帖、锁帖和失效贴
        if ($(element).hasClass('sticky') || 
            $(element).find('.locked').length > 0 ||
            $(element).find('.expired-tag').length > 0) {
          return;
        }
        
        const titleEl = $(element).find('.s.xst, a.xst');
        const title = titleEl.text().trim();
        const href = titleEl.attr('href');
        
        if (!href || !title) return;
        
        const postId = href.match(/thread-(\d+)/)?.[1] || '';
        const isReplied = postId && repliedPosts.has(postId);
        
        cards.push({
          vod_id: href,
          vod_name: title,
          vod_pic: '',
          vod_remarks: isReplied ? '已回复' : '',
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

    // 第一次请求获取帖子内容
    const { data, status } = await $fetch.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 15000
    });
    
    if (status !== 200) {
      log(`请求失败: HTTP ${status}`);
      return jsonify({ list: [] });
    }
    
    // 尝试guangying.js的方法：查找JSON数据
    const jsonMatch = data.match(/"panlist":\s*({[^}]*})/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const panData = JSON.parse(jsonMatch[1]);
        log(`找到 ${panData.url.length} 个网盘链接`);
        
        panData.url.forEach((item, index) => {
          tracks.push({
            name: panData.name[index] || "网盘资源",
            pan: item,
            ext: {}
          });
        });
        
        return jsonify({ 
          list: [{
            title: "网盘资源",
            tracks,
          }]
        });
      } catch (e) {
        log(`解析网盘JSON错误: ${e.message}`);
      }
    }
    
    // 回退到HTML解析
    const $ = cheerio.load(data);
    
    // 检查资源是否失效
    const isExpired = $('.expired-tag, span:contains("有人标记失效"), font:contains("失效")').length > 0;
    if (isExpired) {
      log("资源已标记为失效");
      return jsonify({ list: [] });
    }
    
    // 检查是否已经回复过此帖
    const alreadyReplied = postId && repliedPosts.has(postId);
    log(`已回复状态: ${alreadyReplied}`);

    // 尝试直接提取网盘链接
    const directLinks = extractPanLinks(data);
    if (directLinks.length > 0 && alreadyReplied) {
      log(`直接提取到 ${directLinks.length} 个网盘链接`);
      return formatTracks(directLinks);
    }
    
    // 检测需要回复的提示
    const replyPrompt = $('div:contains("请回复后再查看"), div:contains("回复后查看")');
    const needsReply = replyPrompt.length > 0 && !alreadyReplied;
    log(`需要回复: ${needsReply}`);
    
    // 如果需要回复且未回复过
    if (needsReply) {
      // 获取回复表单所需参数
      const formhash = $('input[name="formhash"]').val();
      const tid = postId || url.match(/thread-(\d+)/)?.[1];
      
      if (formhash && tid) {
        log(`表单参数 - formhash: ${formhash}, tid: ${tid}`);
        
        // 构造回复请求
        const replyUrl = `${appConfig.site}/forum.php?mod=post&action=reply&tid=${tid}&extra=&replysubmit=yes`;
        
        // 使用第一条快捷回复内容
        const firstReply = $('li.replyfast a').first().text() || '感谢分享';
        log(`自动回复内容: ${firstReply}`);
        
        // 提交回复
        const response = await $fetch.post(replyUrl, {
          form: {
            formhash,
            message: firstReply,
            usesig: 1,
            subject: ''
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': UA,
            'Referer': url
          },
          timeout: 10000
        });
        
        // 标记为已回复
        repliedPosts.add(tid);
        log(`回复成功，标记帖子 ${tid} 为已回复`);
        
        // 等待1秒让服务器处理
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        log("缺少回复所需参数");
      }
    }
    
    // 重新获取帖子内容
    const { data: newData } = await $fetch.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    // 提取网盘链接
    const links = extractPanLinks(newData);
    log(`提取到 ${links.length} 个网盘链接`);
    
    return formatTracks(links);
  } catch (error) {
    log(`获取资源错误: ${error.message}`);
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

// 格式化轨道结果的辅助函数
function formatTracks(links) {
  try {
    const uniqueLinks = [...new Set(links)];
    const tracks = uniqueLinks.map(link => ({
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
  } catch (e) {
    log(`格式化轨道错误: ${e.message}`);
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
    
    // 使用类似guangying.js的搜索URL格式
    const encodedText = encodeURIComponent(text);
    const url = `${appConfig.site}/search.php?q=${encodedText}&page=${page}`;
    log(`搜索: ${text}, 页码: ${page}, URL: ${url}`);

    const { data, status } = await $fetch.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    if (status !== 200) {
      log(`搜索请求失败: HTTP ${status}`);
      return jsonify({ list: [] });
    }

    const $ = cheerio.load(data);
    
    // 尝试guangying.js的解析方法：从脚本中提取数据
    const scriptContent = $('script').filter((_, script) => {
      return $(script).html().includes('var searchData');
    }).html();
    
    if (scriptContent) {
      log("尝试从脚本中提取搜索结果");
      
      // 提取JSON数据
      const jsonMatch = scriptContent.match(/var searchData\s*=\s*({.*?});/s);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          
          // 处理提取的数据
          jsonData.results.forEach(item => {
            cards.push({
              vod_id: item.id,
              vod_name: item.title,
              vod_pic: item.image,
              vod_remarks: item.info,
              ext: {
                url: `${appConfig.site}/thread-${item.id}-1-1.html`,
                postId: item.id
              },
            });
          });
          
          log(`从脚本中提取到 ${cards.length} 个搜索结果`);
          return jsonify({ list: cards });
        } catch (e) {
          log(`解析搜索结果JSON错误: ${e.message}`);
        }
      }
    }
    
    log("回退到HTML解析搜索结果");
    
    // 解析搜索结果 - 使用更可靠的选择器
    const searchItems = $('.xs2 a, a.xst');
    
    log(`找到 ${searchItems.length} 个搜索结果`);
    
    searchItems.each((index, element) => {
      try {
        const title = $(element).text().trim();
        const href = $(element).attr('href');
        
        if (!href || !title) return;
        
        const postId = href.match(/thread-(\d+)/)?.[1] || '';
        
        // 检查是否失效
        const parent = $(element).closest('tr, div');
        const isExpired = parent.find('.expired-tag, .locked').length > 0;
        
        if (isExpired) return;
        
        const isReplied = postId && repliedPosts.has(postId);
        
        cards.push({
          vod_id: href,
          vod_name: title,
          vod_pic: '',
          vod_remarks: isReplied ? '已回复' : '',
          ext: {
            url: href.startsWith('http') ? href : `${appConfig.site}/${href}`,
            postId
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
