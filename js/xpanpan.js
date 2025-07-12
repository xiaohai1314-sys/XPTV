const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
  title: '网盘资源社区',
  site: 'https://www.wpzysq.com',
  tabs: [
    {
      name: '影视/剧集',
      ext: { category: 'forum-2' }
    },
    {
      name: '4k专区',
      ext: { category: 'forum-36' }
    },
    {
      name: '动漫区',
      ext: { category: 'forum-3' }
    }
  ],
};

// 存储已回复的帖子ID
const repliedPosts = new Set();

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, category } = ext;

  const url = `${appConfig.site}/${category}-${page}.html`;

  try {
    const { data } = await $fetch.get(url, {
      headers: { 'User-Agent': UA }
    });

    const $ = cheerio.load(data);
    
    // 解析帖子列表 - 使用更通用的选择器
    $('tbody').each((index, element) => {
      // 跳过置顶帖、锁帖和失效贴
      if ($(element).hasClass('sticky') || 
          $(element).find('.locked').length > 0 ||
          $(element).find('.expired-tag').length > 0) {
        return;
      }
      
      const titleEl = $(element).find('.s.xst');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href');
      const postId = href.match(/thread-(\d+)/)?.[1];
      
      if (href && title) {
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
      }
    });

    return jsonify({ list: cards });
  } catch (error) {
    return jsonify({ list: [] });
  }
}

async function getTracks(ext) {
  ext = argsify(ext);
  let tracks = [];
  let url = ext.url;
  const postId = ext.postId;
  
  // 检查是否已经回复过此帖
  const alreadyReplied = postId && repliedPosts.has(postId);
  
  try {
    // 第一次请求获取帖子内容
    const { data } = await $fetch.get(url, {
      headers: { 'User-Agent': UA }
    });
    
    const $ = cheerio.load(data);
    
    // 检查资源是否失效
    if ($('.expired-tag').length > 0 || 
        $('span:contains("有人标记失效")').length > 0 || 
        $('font:contains("失效")').length > 0) {
      return jsonify({ list: [] });
    }
    
    // 尝试直接提取网盘链接
    const directLinks = extractPanLinks(data);
    if (directLinks.length > 0 && alreadyReplied) {
      return formatTracks(directLinks);
    }
    
    // 检测需要回复的提示
    const replyPrompt = $('div:contains("请回复后再查看")');
    const needsReply = replyPrompt.length > 0 && !alreadyReplied;
    
    // 如果需要回复且未回复过
    if (needsReply) {
      // 获取回复表单所需参数
      const formhash = $('input[name="formhash"]').val();
      const tid = url.match(/thread-(\d+)/)?.[1];
      
      if (formhash && tid) {
        // 构造回复请求
        const replyUrl = `${appConfig.site}/forum.php?mod=post&action=reply&tid=${tid}&extra=&replysubmit=yes`;
        
        // 使用第一条快捷回复内容
        const firstReply = $('li.replyfast a').first().text() || '感谢分享';
        
        // 提交回复
        await $fetch.post(replyUrl, {
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
          }
        });
        
        // 标记为已回复
        repliedPosts.add(tid);
        
        // 等待1秒让服务器处理
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 重新获取帖子内容
    const { data: newData } = await $fetch.get(url, {
      headers: { 'User-Agent': UA }
    });
    
    // 提取网盘链接 - 使用更精确的正则表达式
    const links = extractPanLinks(newData);
    
    return formatTracks(links);
  } catch (error) {
    return jsonify({ list: [] });
  }
}

// 提取网盘链接的辅助函数
function extractPanLinks(html) {
  // 在整个网页中搜索网盘链接
  const linkRegex = /(https?:\/\/[^\s'"]+)/g;
  const matches = html.match(linkRegex) || [];
  
  // 筛选夸克和阿里云盘链接
  return matches.filter(link => 
    (link.includes('quark.cn') || 
     link.includes('aliyundrive.com')) &&
    !link.includes('wpzysq.com') // 过滤本站链接
  );
}

// 格式化轨道结果的辅助函数
function formatTracks(links) {
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
}

async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] });
}

async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search.php?mod=forum&q=${text}&page=${page}`;

  try {
    const { data } = await $fetch.get(url, {
      headers: { 'User-Agent': UA }
    });

    const $ = cheerio.load(data);
    
    // 解析搜索结果 - 使用更通用的选择器
    $('.xs2 a').each((index, element) => {
      const title = $(element).text().trim();
      const href = $(element).attr('href');
      const postId = href.match(/thread-(\d+)/)?.[1];
      
      // 跳过失效和锁定结果
      const parentRow = $(element).closest('tr');
      if (parentRow.find('.expired-tag').length > 0 || 
          parentRow.find('.locked').length > 0) {
        return;
      }
      
      if (href && title) {
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
      }
    });

    return jsonify({ list: cards });
  } catch (error) {
    return jsonify({ list: [] });
  }
}
