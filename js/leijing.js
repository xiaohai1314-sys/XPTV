/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v36 调试专用版
 *
 * 更新说明 (v36-debug):
 * - 这是一个用于调试的特殊版本。
 * - 它会拦截分类页的请求，并将服务器返回的原始 HTML 内容作为“影片标题”显示在APP界面上。
 * - 目的是为了查看脚本在APP环境下到底获取了什么样的网页内容，以诊断“分类点开无内容”的问题。
 * - 调试完成后，需要将 getCards 函数恢复正常。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();
// ⚠️ 注意：这个 IP 地址是本地地址，如果您的运行环境无法访问，请修改为正确的后端服务地址。
const BACKEND_URL = 'http://192.168.1.3:3001'; 

// ============================ 关键配置 ============================
// ⚠️ 请将下面的字符串替换为您自己的完整 Cookie
const USER_COOKIE = 'eoi=ID=0dbb28bf1e95b293:T=1760889219:RT=1760889219:S=AA-AfjYdK1a9Hn9QyIpTjcD9Dy1w; cf_clearance=1KSgiw7quPKkMiFpRseR8YlHhPJjE_fl0v.L6LbMzlo-1762633022-1.2.1.1-WPvSiDK.w5XsUlu3sIwM4r5pg8AbCqXfGCsZYrFulDsMxo0Z0oKHy4YZNU1C.70_VsKU.D5AgZOZPChSUtnGk8iYVjvnTdrsprQVVyupyTPYq9xRR1KlQoeJ1JqAtjGSqYQu0y_UHuMqdpX.7UDjjQIpRK_gyc2kt5DiEcH2u.Vug6xqZtMX96KOmgB2tsb_I9aWRs5Hl7_UneGjZeeVXPUxtaPY4Fl.0n2z3btGdbYs3hYuja0aWXP0oJSUIs1i; __gads=ID=ebf773339e181721:T=1760889219:RT=1760889219:S=ALNI_MZfqUGthmjWHR1DiGAkynLdHaoVZw; __gpi=UID=000012b7ed6f2a8b:T=1760889219:RT=1760889219:S=ALNI_MaypqVukBihQplCbqa_MrCVPwJkTQ; _ga=GA1.1.1766815720.1762630882; _ga_FM8S5GPFE1=GS2.1.s1762633030$o2$g1$t1762633035$j55$l0$h0; _ga_WPP9075S5T=GS2.1.s1762633030$o2$g1$t1762633035$j55$l0$h0; cms_token=67de22ffa3184ee89c74e1d1eb5bb4aa; JSESSIONID=15D09C7857B0243558DC7B2ECF5802F4';
// =================================================================

const appConfig = {
  ver: 36, // 版本号更新为调试版
  title: '雷鲸 (调试中 )',
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

// 统一的请求头 ，包含 User-Agent 和 Cookie
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

// ==================== 调试专用 getCards 函数 ====================
// 目的：将脚本实际获取到的HTML内容，通过影片标题显示在APP界面上。
async function getCards(ext) {
  ext = argsify(ext);
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  
  try {
    // 发起网络请求
    const response = await $fetch.get(requestUrl, { headers: requestHeaders });
    const htmlData = getHtmlFromResponse(response);

    // 创建一个只包含一个“影片”的列表
    const debugCard = {
      vod_id: 'debug_info_1',
      // 核心：将获取到的 HTML 内容作为影片的标题
      vod_name: '【调试信息】脚本获取的HTML内容如下：' + htmlData, 
      vod_pic: 'https://img.zcool.cn/community/01a8545da68075a8012187f4458842.png@1280w_1l_2o_100sh.png', // 放一个调试图标
      vod_remarks: '请将完整的标题内容复制给我',
      ext: {}
    };

    // 将这个特殊的“影片”卡片返回给APP
    return jsonify({ list: [debugCard] } );

  } catch (e) {
    // 如果请求过程中发生错误（比如网络问题），也将错误信息返回
    const errorCard = {
      vod_id: 'debug_error_1',
      vod_name: '【调试错误】请求失败，错误信息：' + e.toString(),
      vod_pic: 'https://img.zcool.cn/community/01a8545da68075a8012187f4458842.png@1280w_1l_2o_100sh.png',
      vod_remarks: '请将这个错误信息截图或复制给我',
      ext: {}
    };
    return jsonify({ list: [errorCard] } );
  }
}
// ==================== 调试函数结束 ====================


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
      href = href.replace('http://', 'https://' );
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
  const response = await $fetch.get(requestUrl, { headers: requestHeaders });
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
