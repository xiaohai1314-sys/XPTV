const cheerio = createCheerio()
const CryptoJS = createCryptoJS()

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
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
  
  try {
    const { data } = await $fetch.get(url, {
      headers
    })
    
    console.log('详情页URL:', url)
    
    // 多种方式提取网盘链接
    let pan = null
    
    // 方式1: 天翼云盘链接（各种格式）
    const patterns = [
      /"(https:\/\/cloud\.189\.cn\/t\/[^"]*)"/, // 带引号
      /https:\/\/cloud\.189\.cn\/t\/[A-Za-z0-9]+/, // 不带引号
      /"(https:\/\/pan\.baidu\.com\/s\/[^"]*)"/, // 百度网盘
      /"(https:\/\/www\.aliyundrive\.com\/s\/[^"]*)"/, // 阿里云盘
      /"(https:\/\/pan\.quark\.cn\/s\/[^"]*)"/, // 夸克网盘
      /https:\/\/pan\.baidu\.com\/s\/[A-Za-z0-9]+/, // 百度网盘无引号
      /https:\/\/www\.aliyundrive\.com\/s\/[A-Za-z0-9]+/, // 阿里云盘无引号
      /https:\/\/pan\.quark\.cn\/s\/[A-Za-z0-9]+/, // 夸克网盘无引号
    ]
    
    for (let pattern of patterns) {
      const match = data.match(pattern)
      if (match) {
        pan = match[1] || match[0]
        break
      }
    }
    
    console.log('找到的网盘链接:', pan)
    
    if (!pan) {
      // 如果没找到链接，可能是页面结构变化，返回原URL让用户手动访问
      return jsonify({ 
        list: [{
          title: '需要手动访问',
          tracks: [{
            name: '点击打开网页',
            pan: url,
          }]
        }]
      })
    }
    
    return jsonify({ 
      list: [{
        title: '在线',
        tracks: [{
          name: '网盘',
          pan,
        }]
      }]
    })
    
  } catch (error) {
    console.log('获取详情页错误:', error)
    return jsonify({ 
      list: [{
        title: '错误',
        tracks: [{
          name: '请求失败: ' + error.message,
          pan: url,
        }]
      }]
    })
  }
}

async function getPlayinfo(ext) {
  return jsonify({
    urls: [],
  })
}

async function search(ext) {
  ext = argsify(ext)
  let cards = [];
  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1
  
  if (page > 1) {
    return jsonify({
      list: cards,
    })
  }
  
  const url = appConfig.site + `/search?k=${text}`
  console.log('搜索URL:', url)
  
  try {
    const { data } = await $fetch.get(url, {
      headers,
      timeout: 15000
    })
    
    console.log('搜索页面HTML长度:', data.length)
    
    // 重要发现：Vue.js渲染的页面，需要从HTML中提取数据而不是解析DOM结构
    // 从HTML源码中直接提取链接和标题信息
    
    // 方法1：从HTML注释或脚本中查找数据
    // 检查是否有JSON数据
    const jsonMatch = data.match(/window\.__INITIAL_STATE__\s*=\s*(\{[^}]+\})/);
    if (jsonMatch) {
      try {
        const initialState = JSON.parse(jsonMatch[1]);
        console.log('找到初始状态数据:', initialState);
        // 根据数据结构解析结果
      } catch (e) {
        console.log('解析初始状态失败:', e);
      }
    }
    
    // 方法2：正则表达式直接从HTML源码提取链接和标题
    // 查找所有的 /s/ 链接
    const linkPattern = /href="(\/s\/[^"]+)"/g;
    let linkMatch;
    const links = [];
    
    while ((linkMatch = linkPattern.exec(data)) !== null) {
      links.push(linkMatch[1]);
    }
    
    console.log('找到的链接:', links);
    
    if (links.length > 0) {
              // 对每个链接，尝试从周围的HTML中提取标题
      for (let link of links) {
        let title = '';
        
        // 在HTML中查找这个链接的上下文，提取标题
        const linkIndex = data.indexOf(`href="${link}"`);
        if (linkIndex > -1) {
          // 获取链接周围的HTML片段
          const contextStart = Math.max(0, linkIndex - 1000);
          const contextEnd = Math.min(data.length, linkIndex + 1500);
          const context = data.substring(contextStart, contextEnd);
          
          // 获取搜索关键词用于匹配
          const searchTerm = decodeURIComponent(text);
          
          // 多种方式提取标题
          const titlePatterns = [
            // Vue模板中的标题结构
            /<template[^>]*#title[^>]*>[\s\S]*?<div[^>]*>([^<]*(?:<span[^>]*>[^<]*<\/span>[^<]*)*)<\/div>[\s\S]*?<\/template>/,
            // 包含搜索关键词的文本段
            new RegExp(`([^<>"]*${searchTerm}[^<>"]{0,50})`, 'i'),
            // span标签中的内容
            /<span[^>]*style='color:red;'>[^<]*<\/span>([^<]{5,100})/,
            // div中的标题
            /<div[^>]*font-size:medium[^>]*>([^<]+)<\/div>/,
            // 通用文本匹配
            /"([^"]{10,100})"/,
          ];
          
          for (let pattern of titlePatterns) {
            const titleMatch = context.match(pattern);
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1]
                .replace(/<[^>]*>/g, '') // 移除HTML标签
                .replace(/&nbsp;/g, ' ') // 替换空格实体
                .trim();
              
              // 确保标题有意义且不太长
              if (title.length > 3 && title.length < 200) {
                break;
              }
            }
          }
          
          // 如果还是没有标题，生成一个描述性标题
          if (!title) {
            const linkId = link.replace('/s/', '');
            title = `${searchTerm} - 资源${linkId.substring(0, 8)}`;
          }
          
          // 清理标题
          title = title
            .replace(/\s+/g, ' ')
            .replace(/^[^\w\u4e00-\u9fff]*/, '') // 移除开头的特殊字符
            .replace(/[^\w\u4e00-\u9fff]*$/, '') // 移除结尾的特殊字符
            .trim();
        }
        
        if (title) {
          console.log('解析结果:', { title, link });
          cards.push({
            vod_id: link,
            vod_name: title,
            vod_pic: '',
            vod_remarks: '点击获取网盘链接',
            ext: {
              url: appConfig.site + link,
            },
          });
        }
      }
    }
    
    // 方法3：如果上述方法都失败，尝试更简单的文本匹配
    if (cards.length === 0) {
      console.log('尝试简单文本匹配');
      
      // 直接搜索包含搜索词的文本段落
      const searchTerm = decodeURIComponent(text);
      const textPattern = new RegExp(`([^<>]*${searchTerm}[^<>]*)`, 'gi');
      let textMatch;
      let index = 0;
      
      while ((textMatch = textPattern.exec(data)) !== null && index < 10) {
        const title = textMatch[1].trim();
        if (title.length > 10 && title.length < 200) {
          cards.push({
            vod_id: `result_${index}`,
            vod_name: title,
            vod_pic: '',
            vod_remarks: '需要手动查找链接',
            ext: {
              url: url,
            },
          });
          index++;
        }
      }
    }
    
    console.log('最终解析结果数量:', cards.length);
    
    if (cards.length === 0) {
      // 如果完全没有结果，可能是搜索词没有匹配或网站结构变化
      cards.push({
        vod_id: 'no_results',
        vod_name: '未找到搜索结果',
        vod_pic: '',
        vod_remarks: '请尝试其他关键词或直接访问网站',
        ext: {
          url: url,
        },
      });
    }
    
  } catch (error) {
    console.log('搜索请求错误:', error);
    
    cards.push({
      vod_id: 'error',
      vod_name: `搜索失败: ${error.message || '网络错误'}`,
      vod_pic: '',
      vod_remarks: '请检查网络连接',
      ext: {
        url: url,
      },
    });
  }
  
  return jsonify({
    list: cards,
  });
}
