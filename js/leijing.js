/**
 * =================================================================
 * 优化版雷鲸脚本 - 增强链接识别和错误处理
 * 版本: 24
 *
 * 更新日志:
 * - 进一步优化了 parseAndAddTrack 函数，使其能够更鲁棒地处理天翼云盘链接。
 * - 改进了从 `web/share?code=` 形式的URL中提取分享码和访问码的逻辑，确保即使访问码被URL编码在code参数中也能正确解析。
 * - 简化了URL匹配正则表达式，并利用URLSearchParams进行参数解析，提高了代码的清晰度和健壮性。
 * - 增加了更全面的链接选择器，确保能捕获到页面中的天翼云盘链接。
 * - 增加了调试日志功能，方便排查问题。
 * - 修复了URL解析时，`rawUrl` 包含括号导致 `URL` 对象创建失败的问题。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 24,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
};

// 调试模式开关
const DEBUG_MODE = true; // 开启调试模式

// 调试日志函数
function debugLog(message, data = null) {
  if (DEBUG_MODE) {
    console.log(`[雷鲸脚本] ${message}`, data || '');
  }
}

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  
  try {
    const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
    const $ = cheerio.load(data);
    
    $('.topicItem').each((index, each) => {
      if ($(each).find('.cms-lock-solid').length > 0) return;
      
      const href = $(each).find('h2 a').attr('href');
      const title = $(each).find('h2 a').text();
      
      if (!href || !title) return;
      
      const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
      const match = title.match(regex);
      const dramaName = match ? match[1] : title;
      const r = $(each).find('.summary').text();
      const tag = $(each).find('.tag').text();
      
      // 过滤不需要的内容
      if (/content/.test(r) && !/cloud/.test(r)) return;
      if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
      
      cards.push({
        vod_id: href,
        vod_name: dramaName,
        vod_pic: '',
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    });
    
    debugLog(`获取到 ${cards.length} 个卡片`);
    return jsonify({ list: cards });
  } catch (error) {
    debugLog('获取卡片失败', error);
    return jsonify({ list: [] });
  }
}

async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const uniqueLinks = new Set();

  try {
    debugLog('开始获取详情页', url);
    const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || "网盘资源";
    
    debugLog('页面标题', title);
    
    // 多种选择器并存，提高识别成功率
    const linkSelectors = [
      'a[href*="cloud.189.cn"]',
      '.topicContent a[href*="cloud.189.cn"]',
      '.content a[href*="cloud.189.cn"]',
      'a[href*="189.cn"]',
      'div.topicContent a' // 增加更通用的a标签选择器
    ];
    
    let combinedText = "";
    let foundLinks = false;
    
    // 遍历所有选择器
    for (const selector of linkSelectors) {
      $(selector).each((i, el) => {
        const $el = $(el);
        const hrefAttr = $el.attr('href') || '';
        const linkText = $el.text() || '';
        if (hrefAttr.includes('cloud.189.cn')) {
          combinedText += hrefAttr + ' ' + linkText + '\n';
          foundLinks = true;
        }
      });
      if (foundLinks) break; // 找到链接就停止
    }

    debugLog('找到的链接文本', combinedText);

    if (combinedText) {
      parseAndAddTrack(combinedText, title, tracks, uniqueLinks);
    }

    // 如果没有找到链接，尝试从内容中提取
    if (tracks.length === 0) {
      debugLog('从内容中提取链接');
      const content = $('.topicContent').text();
      parseAndAddTrack(content, title, tracks, uniqueLinks);
    }

    // 最后尝试从整个页面提取
    if (tracks.length === 0) {
      debugLog('从整个页面提取链接');
      const bodyText = $('body').text();
      parseAndAddTrack(bodyText, title, tracks, uniqueLinks);
    }

    debugLog(`提取到 ${tracks.length} 个链接`);

    if (tracks.length > 0) {
      return jsonify({ list: [{ title: "天翼云盘", tracks }] });
    } else {
      return jsonify({ list: [] });
    }

  } catch (e) {
    debugLog('获取详情页失败', e);
    return jsonify({ 
      list: [{ 
        title: "资源列表", 
        tracks: [{ 
          name: "加载失败", 
          pan: "请检查网络或链接", 
          ext: { accessCode: "" } 
        }] 
      }] 
    });
  }
}

function parseAndAddTrack(textToParse, title, tracks, uniqueLinks) {
  if (!textToParse) return;
  
  debugLog('开始解析文本', textToParse.substring(0, Math.min(textToParse.length, 200)) + '...');
  
  // 优化的URL匹配正则表达式
  const urlPatterns = [
    // 标准分享链接，捕获code参数，不包含括号
    /https?:\/\/cloud\.189\.cn\/web\/share\?code=([a-zA-Z0-9%]+)/g,
    // 短链接
    /https?:\/\/cloud\.189\.cn\/t\/([a-zA-Z0-9]+)/g
  ];
  
  for (const urlPattern of urlPatterns) {
    let match;
    while ((match = urlPattern.exec(textToParse)) !== null) {
      const rawUrl = match[0];
      debugLog('找到URL', rawUrl);
      
      let panUrl = rawUrl;
      let accessCode = '';

      try {
        const urlObj = new URL(rawUrl);
        if (urlObj.pathname.startsWith('/web/share')) {
          const codeParam = urlObj.searchParams.get('code');
          if (codeParam) {
            const decodedCodeParam = decodeURIComponent(codeParam);
            
            // 尝试从解码后的code参数中提取访问码
            const codeMatch = decodedCodeParam.match(/(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})/i);
            if (codeMatch && codeMatch[1]) {
              accessCode = codeMatch[1];
              // 清理URL，移除访问码部分
              const cleanCode = decodedCodeParam.replace(/(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})/i, '').trim();
              panUrl = urlObj.origin + urlObj.pathname + '?code=' + encodeURIComponent(cleanCode);
              
              // 如果清理后code为空，使用原始分享码
              if (panUrl.endsWith('?code=')) {
                const originalCode = decodedCodeParam.split('（')[0].split('(')[0].trim();
                panUrl = urlObj.origin + urlObj.pathname + '?code=' + encodeURIComponent(originalCode);
              }
            } else {
              panUrl = rawUrl;
            }
          }
        }
      } catch (e) {
        debugLog('URL解析失败', e);
        // URL解析失败时保持原URL
      }

      // 如果还没有访问码，尝试从周围文本提取
      if (!accessCode) {
        accessCode = extractAccessCodeFromContext(textToParse, rawUrl);
      }

      if (!panUrl) continue;

      const normalizedUrl = normalizePanUrl(panUrl);
      if (uniqueLinks.has(normalizedUrl)) continue;

      debugLog('添加链接', { panUrl, accessCode });
      
      tracks.push({
        name: title,
        pan: panUrl,
        ext: { accessCode: accessCode || '' }
      });
      uniqueLinks.add(normalizedUrl);
    }
  }
}

// 增强的访问码提取函数
function extractAccessCodeFromContext(text, url) {
  if (!text) return '';
  
  // 在URL附近查找访问码
  const urlIndex = text.indexOf(url);
  if (urlIndex !== -1) {
    // 取URL前后100个字符
    const contextStart = Math.max(0, urlIndex - 100);
    const contextEnd = Math.min(text.length, urlIndex + url.length + 100);
    const context = text.substring(contextStart, contextEnd);
    
    debugLog('上下文文本', context);
    
    // 多种访问码提取模式
    const patterns = [
      /(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})/i,
      /[\uFF3B\u3010\uFF08\(]\s*(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})\s*[\uFF3D\u3011\uFF09\)]/i,
      /（\s*访问码\s*[:：]\s*([a-zA-Z0-9]{4,6})\s*）/i,
      /\(\s*访问码\s*[:：]\s*([a-zA-Z0-9]{4,6})\s*\)/i,
      /访问码\s*[:：]\s*([a-zA-Z0-9]{4,6})/i,
      /密码\s*[:：]\s*([a-zA-Z0-9]{4,6})/i,
      /提取码\s*[:：]\s*([a-zA-Z0-9]{4,6})/i
    ];
    
    for (const pattern of patterns) {
      const match = context.match(pattern);
      if (match && match[1]) {
        debugLog('找到访问码', match[1]);
        return match[1];
      }
    }
  }
  
  return '';
}

function extractAccessCode(text) {
  if (!text) return '';
  
  const patterns = [
    /(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})/i,
    /[\uFF3B\u3010\uFF08\(]\s*(?:访问码|密码|提取码|code)[:：\s]*([a-zA-Z0-9]{4,6})\s*[\uFF3D\u3011\uFF09\)]/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1];
  }
  
  return '';
}

function normalizePanUrl(url) {
  try {
    const urlObj = new URL(url);
    return (urlObj.origin + urlObj.pathname).toLowerCase();
  } catch (e) {
    const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<)]+/);
    return match ? match[0].toLowerCase() : url.toLowerCase();
  }
}

async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  
  try {
    debugLog('搜索URL', url);
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    
    // 多种搜索结果选择器
    const searchSelectors = [
      '.search-result ul > li',
      '.topic-list > .topic-item',
      '.result-list > .item',
      'ul.search-results > li.result-item',
      '.topicItem',
      '.searchModule .item'
    ];
    
    let searchItems = $();
    for (const selector of searchSelectors) {
      const items = $(selector);
      if (items.length > 0) {
        searchItems = items;
        break;
      }
    }
    
    searchItems.each((index, each) => {
      const $item = $(each);
      
      // 多种标题选择器
      const titleSelectors = ['a.title', 'h2 a', 'h3 a', '.item-title a', '.title > span a'];
      let a = null;
      
      for (const selector of titleSelectors) {
        a = $item.find(selector);
        if (a.length > 0) break;
      }
      
      if (!a || a.length === 0) return;
      
      const href = a.attr('href');
      const title = a.text();
      if (!href || !title) return;
      
      const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
      const match = title.match(regex);
      const dramaName = match ? match[1] : title;
      const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim();
      
      // 过滤不需要的内容
      if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
      
      cards.push({
        vod_id: href,
        vod_name: dramaName,
        vod_pic: $item.find('img').attr('src') || '',
        vod_remarks: tag,
        ext: { url: `${appConfig.site}/${href}` },
      });
    });
    
    debugLog(`搜索到 ${cards.length} 个结果`);
    return jsonify({ list: cards });
  } catch (error) {
    debugLog('搜索失败', error);
    return jsonify({ list: [] });
  }
}

