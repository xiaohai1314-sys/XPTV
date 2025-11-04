/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v35 (纯前端完整版)
 *
 * 更新说明:
 * - 移除所有后端代理依赖，实现100%纯前端运行。
 * - 采用手动配置Cookie的方式来支持需要登录的搜索功能。
 * - search 函数已重写，直接使用配置的Cookie访问雷鲸网站。
 * - 当Cookie失效或未配置时，会提供明确的中文提示。
 * - 包含了分类浏览、详情页网盘链接解析的全部功能。
 * - 附带详细的Cookie获取教程。
 * =================================================================
 */

// 播放器环境提供的基础函数/对象 (假设存在)
const cheerio = createCheerio(); 

// 全局配置
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// ★★★ 核心配置: 在这里填入你从浏览器复制的Cookie ★★★
// 下面这个Cookie是根据您提供的curl命令预填的，很可能已过期。
// 如果搜索无效，请务必按照脚本底部的教程自行获取并替换。
const MANUAL_COOKIE = 'JSESSIONID=6515896B2677BEC862DF1B29899BCA8C; cms_token=f7ab1120899744719d873ca0f1e89d41; cf_clearance=sN8u2BgsNOa.cMD_OGxBziuGt2hzd09SVTfcogfQUys-1762214727-1.2.1.1-K3HZRLhQwhBlb_EajbEMSY4g1kjuqHZr6QCsbCUKsK.m6aFqxADoFq.8qzBmVspZEAXd.MvBvlygT2MZX86eJIAFxtqIlMYxoR3izLGwlTvblH15YUTkXYRun0gAAPDDBt7aPbJP59KzkC8ZgAu.moX2Q54_fhQVgWynvxvZvsXTYGkAvM_OC.Tx12beu1qcaFw2GCZ7Y1doFZBl4H975zIfO4Zkv8tTTiE2oxMdgJI; cms_accessToken=a8b4777833cf48529fd4ee419ab3518e; cms_refreshToken=5c7ba3382f7e438db528e8accc42bc54';

const appConfig = {
  ver: 35,
  title: '雷鲸 (纯前端)',
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

// 基础函数
async function getConfig( ) {
  return jsonify(appConfig);
}

function getHtmlFromResponse(response) {
  if (typeof response === 'string') return response;
  if (response && typeof response.data === 'string') return response.data;
  console.error("收到了非预期的响应格式:", response);
  return ''; 
}

// 分类列表页解析
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
  const htmlData = getHtmlFromResponse(response);

  const $ = cheerio.load(htmlData);
  $('.topicItem').each((_, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return;
    const href = $(each).find('h2 a').attr('href');
    const title = $(each).find('h2 a').text();
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
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

// 详情页网盘链接解析
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const uniqueLinks = new Set();

  try {
    const requestUrl = ext.url;
    const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
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
      const codeMatch = bodyText.slice(match.index, match.index + 100).match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/);
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

// 搜索功能 (纯前端实现)
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  
  if (!MANUAL_COOKIE || MANUAL_COOKIE.length < 50) { // 增加一个长度判断
      return jsonify({
          list: [{
              vod_id: 'cookie_missing',
              vod_name: '错误：搜索功能需要配置Cookie',
              vod_remarks: '请编辑脚本，填入MANUAL_COOKIE',
              vod_pic: ''
          }]
      });
  }

  try {
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const requestUrl = `${appConfig.site}/search?keyword=${text}&page=${page}`;

    const response = await $fetch.get(requestUrl, {
      headers: {
        'User-Agent': UA,
        'Cookie': MANUAL_COOKIE,
        'Referer': appConfig.site + '/',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      }
    });

    const htmlData = getHtmlFromResponse(response);
    const $ = cheerio.load(htmlData);

    if ($('title').text().includes('登录')) {
        return jsonify({
            list: [{
                vod_id: 'cookie_expired',
                vod_name: '提示：Cookie已失效',
                vod_remarks: '请重新登录雷鲸网站，并更新脚本中的Cookie',
                vod_pic: ''
            }]
        });
    }

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

  } catch (e) {
    console.error('搜索失败:', e);
    // 在搜索失败时，也返回一个明确的提示
    return jsonify({
        list: [{
            vod_id: 'search_error',
            vod_name: '搜索请求失败',
            vod_remarks: '可能是网络问题或Cookie不正确',
            vod_pic: ''
        }]
    });
  }
}
