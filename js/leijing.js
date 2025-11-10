/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v38 完整修正版
 *
 * 更新说明 (v37):
 * - 修正选择器为实际 HTML 结构：.topicList .item
 * - 修复 URL 拼接问题
 * - 增加详细的调试日志
 * - 兼容 Vue router-link 结构
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();
const BACKEND_URL = 'http://192.168.1.3:3001'; 

// ============================ 关键配置 ============================
// ⚠️ 请将下面的字符串替换为您自己的完整 Cookie
const USER_COOKIE = 'eoi=ID=0dbb28bf1e95b293:T=1760889219:RT=1760889219:S=AA-AfjYdK1a9Hn9QyIpTjcD9Dy1w; cf_clearance=1KSgiw7quPKkMiFpRseR8YlHhPJjE_fl0v.L6LbMzlo-1762633022-1.2.1.1-WPvSiDK.w5XsUlu3sIwM4r5pg8AbCqXfGCsZYrFulDsMxo0Z0oKHy4YZNU1C.70_VsKU.D5AgZOZPChSUtnGk8iYVjvnTdrsprQVVyupyTPYq9xRR1KlQoeJ1JqAtjGSqYQu0y_UHuMqdpX.7UDjjQIpRK_gyc2kt5DiEcH2u.Vug6xqZtMX96KOmgB2tsb_I9aWRs5Hl7_UneGjZeeVXPUxtaPY4Fl.0n2z3btGdbYs3hYuja0aWXP0oJSUIs1i; __gads=ID=ebf773339e181721:T=1760889219:RT=1760889219:S=ALNI_MZfqUGthmjWHR1DiGAkynLdHaoVZw; __gpi=UID=000012b7ed6f2a8b:T=1760889219:RT=1760889219:S=ALNI_MaypqVukBihQplCbqa_MrCVPwJkTQ; _ga=GA1.1.1766815720.1762630882; _ga_FM8S5GPFE1=GS2.1.s1762633030$o2$g1$t1762633035$j55$l0$h0; _ga_WPP9075S5T=GS2.1.s1762633030$o2$g1$t1762633035$j55$l0$h0; cms_token=67de22ffa3184ee89c74e1d1eb5bb4aa; JSESSIONID=15D09C7857B0243558DC7B2ECF5802F4';
// =================================================================

const appConfig = {
  ver: 37,
  title: '雷鲸',
  site: 'https://www.leijing1.com/',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
};

// 统一的请求头
const requestHeaders = {
  'User-Agent': UA,
  'Cookie': USER_COOKIE,
};

async function getConfig() {
  return jsonify(appConfig);
}

function getHtmlFromResponse(response) {
  if (typeof response === 'string') return response;
  if (response && typeof response.data === 'string') return response.data;
  console.error("收到了非预期的响应格式:", response);
  return ''; 
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  // 修正 URL 拼接（site 末尾没有 /，id 开头有 ?）
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  console.log('========== getCards 调试信息 ==========');
  console.log('请求 URL:', requestUrl);
  console.log('页码:', page);
  
  try {
    const response = await $fetch.get(requestUrl, { headers: requestHeaders });
    const htmlData = getHtmlFromResponse(response);
    
    console.log('HTML 长度:', htmlData.length);
    console.log('HTML 前 200 字符:', htmlData.substring(0, 200));
    
    const $ = cheerio.load(htmlData);
    
    // 测试各种选择器
    console.log('测试选择器:');
    console.log('  .topicList 数量:', $('.topicList').length);
    console.log('  .item 数量:', $('.item').length);
    console.log('  .topicList .item 数量:', $('.topicList .item').length);
    console.log('  .topicItem 数量:', $('.topicItem').length);
    console.log('  .post-item 数量:', $('.post-item').length);

    // 使用正确的选择器
    $('.topicList .item').each((index, each) => {
      const $item = $(each);
      
      console.log(`\n处理第 ${index + 1} 个条目:`);
      
      // 检查是否有锁定图标
      if ($item.find('.cms-lock-solid').length > 0) {
        console.log('  → 跳过（有锁定图标）');
        return;
      }

      // 获取标题
      const title = $item.find('.titleBox .title').text().trim();
      console.log('  标题:', title);
      
      if (!title) {
        console.log('  → 跳过（无标题）');
        return;
      }

      // 尝试多种方式获取链接
      let href = null;
      
      // 方法1: 查找 router-link 的 to 属性（Vue）
      const routerLink = $item.find('[to]');
      if (routerLink.length > 0) {
        href = routerLink.attr('to');
        console.log('  链接(router-link):', href);
      }
      
      // 方法2: 查找普通链接
      if (!href) {
        const link = $item.find('a[href]');
        if (link.length > 0) {
          href = link.attr('href');
          console.log('  链接(a标签):', href);
        }
      }
      
      // 方法3: 从父元素或数据属性中查找
      if (!href) {
        href = $item.attr('data-href') || $item.attr('data-id');
        console.log('  链接(data属性):', href);
      }

      // 如果实在找不到链接，尝试从整个 HTML 中提取 topicId
      if (!href && title) {
        // 查看完整的 item HTML 结构
        const itemHtml = $item.html();
        const topicIdMatch = itemHtml.match(/topicId[=:]?\s*['"]?(\d+)/);
        if (topicIdMatch) {
          href = `/thread?topicId=${topicIdMatch[1]}`;
          console.log('  链接(提取topicId):', href);
        }
      }

      if (!href) {
        console.log('  → 跳过（无链接）');
        // 输出第一个 item 的完整 HTML 用于调试
        if (index === 0) {
          console.log('  完整HTML示例:', $item.html().substring(0, 500));
        }
        return;
      }

      // 获取标签
      const tag = $item.find('.detailInfo .tagName').text().trim();
      console.log('  标签:', tag);

      // 过滤不需要的标签
      if (tag && /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) {
        console.log('  → 跳过（过滤标签）');
        return;
      }

      // 提取剧名（去除多余的标记）
      const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
      const match = title.match(regex);
      const dramaName = match ? match[1] : title;

      // 确保 href 是完整路径
      if (href && !href.startsWith('http') && !href.startsWith('/')) {
        href = '/' + href;
      }

      const fullUrl = href.startsWith('http') ? href : `${appConfig.site}${href}`;

      cards.push({
        vod_id: href,
        vod_name: dramaName,
        vod_pic: '',
        vod_remarks: tag || '',
        ext: { url: fullUrl },
      });
      
      console.log('  ✓ 已添加');
    });

    console.log('\n最终返回卡片数:', cards.length);
    console.log('======================================\n');
    
  } catch (error) {
    console.error('getCards 错误:', error);
  }

  return jsonify({ list: cards });
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

function getProtocolAgnosticUrl(rawUrl) {
  if (!rawUrl) return null;
  const cleaned = rawUrl.replace(/（访问码[:：\uff1a][a-zA-Z0-9]{4,6}）/g, '');
  const match = cleaned.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
  return match ? match[0] : null;
}

async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();

  try {
    const requestUrl = ext.url;
    const response = await $fetch.get(requestUrl, { headers: requestHeaders });
    const htmlData = getHtmlFromResponse(response);
    const $ = cheerio.load(htmlData);

    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    // 精确匹配：URL + 访问码
    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    // 从链接中提取
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const $el = $(el);
      let href = $el.attr('href');
      if (!href) return;
      let agnosticUrl = getProtocolAgnosticUrl(href);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) return;
      href = href.replace('http://', 'https://');
      let trackName = $el.text().trim() || pageTitle;
      tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    });

    // 从文本中提取 URL
    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<>）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let accessCode = '';
      const codeMatch = bodyText.slice(match.index, match.index + 100)
        .match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/);
      if (codeMatch) accessCode = codeMatch[1];
      panUrl = panUrl.trim().replace(/[）\)]+$/, '');
      if (accessCode) panUrl = `${panUrl}（访问码：${accessCode}）`;
      const agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    return tracks.length
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    console.error('获取详情页失败:', e);
    return jsonify({
      list: [{
        title: '错误',
        tracks: [{ name: '加载失败', pan: 'about:blank', ext: { accessCode: '' } }]
      }]
    });
  }
}

async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`;
  const response = await $fetch.get(requestUrl, { headers: requestHeaders });
  const htmlData = getHtmlFromResponse(response);
  const $ = cheerio.load(htmlData);

  // 搜索结果可能使用不同的结构，先测试
  const items = $('.topicList .item').length > 0 ? $('.topicList .item') : $('.topicItem');
  
  items.each((_, el) => {
    const $el = $(el);
    
    // 尝试多种方式获取标题和链接
    let title = $el.find('.titleBox .title').text().trim() || $el.find('h2 a').text().trim();
    let href = $el.find('a').attr('href');
    const tag = $el.find('.detailInfo .tagName').text().trim() || $el.find('.tag').text().trim();
    
    if (!href || !title || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    
    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}${href.startsWith('/') ? href : '/' + href}` },
    });
  });
  
  return jsonify({ list: cards });
}
