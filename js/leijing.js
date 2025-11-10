/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v38 终极修正版
 *
 * 更新说明 (v38):
 * - 尝试最终解决方案：使用更强大的 $httpClient 来模拟浏览器请求 。
 * - 之前的方案均失败，表明网站可能存在需要执行JS的强力反爬虫机制。
 * - $httpClient 相比 $fetch 能更好地模拟浏览器环境 ，有希望绕过检测。
 * - 这次我们再次带上Cookie，因为 $httpClient 配合正确的Cookie 成功率更高 。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();
const BACKEND_URL = 'http://192.168.1.3:3001'; 

const USER_COOKIE = 'eoi=ID=0dbb28bf1e95b293:T=1760889219:RT=1760889219:S=AA-AfjYdK1a9Hn9QyIpTjcD9Dy1w; cf_clearance=1KSgiw7quPKkMiFpRseR8YlHhPJjE_fl0v.L6LbMzlo-1762633022-1.2.1.1-WPvSiDK.w5XsUlu3sIwM4r5pg8AbCqXfGCsZYrFulDsMxo0Z0oKHy4YZNU1C.70_VsKU.D5AgZOZPChSUtnGk8iYVjvnTdrsprQVVyupyTPYq9xRR1KlQoeJ1JqAtjGSqYQu0y_UHuMqdpX.7UDjjQIpRK_gyc2kt5DiEcH2u.Vug6xqZtMX96KOmgB2tsb_I9aWRs5Hl7_UneGjZeeVXPUxtaPY4Fl.0n2z3btGdbYs3hYuja0aWXP0oJSUIs1i; __gads=ID=ebf773339e181721:T=1760889219:RT=1760889219:S=ALNI_MZfqUGthmjWHR1DiGAkynLdHaoVZw; __gpi=UID=000012b7ed6f2a8b:T=1760889219:RT=1760889219:S=ALNI_MaypqVukBihQplCbqa_MrCVPwJkTQ; _ga=GA1.1.1766815720.1762630882; _ga_FM8S5GPFE1=GS2.1.s1762633030$o2$g1$t1762633035$j55$l0$h0; _ga_WPP9075S5T=GS2.1.s1762633030$o2$g1$t1762633035$j55$l0$h0; cms_token=67de22ffa3184ee89c74e1d1eb5bb4aa; JSESSIONID=15D09C7857B0243558DC7B2ECF5802F4';

const appConfig = {
  ver: 38, // 版本号更新
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

const requestHeaders = {
  'User-Agent': UA,
  'Cookie': USER_COOKIE,
};

async function getConfig( ) {
  return jsonify(appConfig);
}

function getHtmlFromResponse(response) {
  // $httpClient 返回的可能是对象 ，也可能是字符串，这里做兼容处理
  if (typeof response === 'string') return response;
  if (response && response.body && typeof response.body === 'string') return response.body;
  if (response && response.data && typeof response.data === 'string') return response.data;
  return ''; 
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  
  try {
    // ===================== 核心修改 =====================
    // 使用 $httpClient 替代 $fetch ，它能更好地模拟浏览器
    const response = await $httpClient.get(requestUrl, { 
      headers: requestHeaders // 重新带上Cookie和UA
    } );
    // ================================================

    const htmlData = getHtmlFromResponse(response);
    
    // 如果返回的还是空内容，我们再次启用调试模式，看看这次拿到了什么
    if (!htmlData || htmlData.length < 500) {
        return jsonify({ list: [{
            vod_id: 'debug_info_2',
            vod_name: '【终极调试】$httpClient获取内容如下：' + htmlData,
            vod_pic: '',
            vod_remarks: '如果仍无内容 ，请复制此标题给我'
        }]});
    }

    const $ = cheerio.load(htmlData);

    $('.topicItem').each((_, each) => {
      const href = $(each).find('h2 a').attr('href');
      if (!href) return;

      const title = $(each).find('h2 a').text();
      const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
      const match = title.match(regex);
      const dramaName = match ? match[1] : title;
      const r = $(each).find('.summary').text();
      const tag = $(each).find('.tag').text();
      
      if (/content/.test(r) && !/cloud/.test(r)) return;
      if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;

      const isLocked = $(each).find('.cms-lock-solid').length > 0;
      
      cards.push({
        vod_id: href,
        vod_name: (isLocked ? '🔒 ' : '') + dramaName,
        vod_pic: '',
        vod_remarks: '',
        ext: { url: `${appConfig.site}/${href}` },
      });
    });

    // 如果解析后卡片列表为空，也返回一条提示信息
    if (cards.length === 0) {
        return jsonify({ list: [{
            vod_id: 'debug_info_3',
            vod_name: '【解析失败】已获取到HTML，但未能解析出任何影片。',
            vod_pic: '',
            vod_remarks: '这表示网站结构可能已改变'
        }]});
    }

    return jsonify({ list: cards });

  } catch (e) {
    return jsonify({ list: [{
        vod_id: 'debug_error_2',
        vod_name: '【请求错误】$httpClient请求失败：' + e.toString( ),
        vod_pic: '',
        vod_remarks: '请复制此错误信息'
    }]});
  }
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
    const response = await $httpClient.get(requestUrl, { headers: requestHeaders } );
    const htmlData = getHtmlFromResponse(response);
    const $ = cheerio.load(htmlData);

    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text();

    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+   ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://' );
      let agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const $el = $(el);
      let href = $el.attr('href');
      if (!href) return;
      let agnosticUrl = getProtocolAgnosticUrl(href);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) return;
      href = href.replace('http://', 'https' );
      let trackName = $el.text().trim() || pageTitle;
      tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    });

    const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<> ）)]+/g;
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://' );
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
  const response = await $httpClient.get(requestUrl, { headers: requestHeaders } );
  const htmlData = getHtmlFromResponse(response);
  const $ = cheerio.load(htmlData);

  $('.topicItem').each((_, el) => {
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $(el).find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
