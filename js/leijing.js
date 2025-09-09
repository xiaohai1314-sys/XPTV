/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v29 (异步登录修正版)
 *
 * 最终修正说明:
 * - 修正了因登录异步执行导致分类列表为空的问题。
 * - 引入 initializationPromise 来确保所有需要登录的请求都会等待登录完成后再执行。
 * - 优化了登录流程，使其更加健壮，能正确处理并发请求。
 * - 保持所有其他功能与逻辑不变。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// 全局变量，用于存储登录成功后的 Cookie
let sessionCookie = null;
// 全局Promise，用于确保登录只执行一次，并让后续操作可以等待它完成
let initializationPromise = null;

const appConfig = {
  ver: 29,
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

// --- 登录与加密模块 ---

async function sha256(str ) {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function login(account, password) {
  try {
    console.log('正在尝试登录...');
    const preLoginRes = await $fetch.get(`${appConfig.site}/login`, { headers: { 'User-Agent': UA } });
    const preLoginCookies = preLoginRes.headers['set-cookie'] || [];
    const cmsTokenCookie = preLoginCookies.find(c => c.startsWith('cms_token='));
    
    if (!cmsTokenCookie) {
      console.error('登录失败：未能获取到临时的 cms_token。');
      return null;
    }
    const cmsToken = cmsTokenCookie.split(';')[0].split('=')[1];

    const hashedPassword = await sha256(password);
    const formData = new URLSearchParams({
      jumpUrl: '', token: cmsToken, captchaKey: '', captchaValue: '', type: '10', account, password: hashedPassword,
    }).toString();

    const loginRes = await $fetch.post(`${appConfig.site}/login`, formData, {
      headers: {
        'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest', 'Referer': `${appConfig.site}/login`, 'Cookie': `cms_token=${cmsToken}`
      }
    });

    const responseData = typeof loginRes.data === 'string' ? JSON.parse(loginRes.data) : loginRes.data;
    if (responseData && responseData.success) {
      const finalCookies = (loginRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      console.log('登录成功！已保存会话 Cookie。');
      return finalCookies;
    } else {
      console.error('登录失败:', responseData ? responseData.msg : '未知错误');
      return null;
    }
  } catch (e) {
    console.error('登录过程中发生网络错误:', e);
    return null;
  }
}

/**
 * 脚本初始化函数，负责执行登录并保存Cookie
 */
async function initialize() {
    if (!sessionCookie) { // 只有在没有Cookie时才执行登录
        sessionCookie = await login("xiaohai1314", "xiaohai1314");
    }
    if (!sessionCookie) {
        // 如果登录失败，抛出错误以阻止后续操作
        throw new Error("登录失败，无法继续操作。");
    }
}

// 将初始化函数包装在Promise中，这样任何地方都可以等待它
initializationPromise = initialize();


// --- 原有函数修改 ---

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  await initializationPromise; // 等待登录完成
  if (!sessionCookie) return jsonify({ list: [] }); // 如果登录失败，返回空

  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { 
    headers: { 'Referer': appConfig.site, 'User-Agent': UA, 'Cookie': sessionCookie } 
  });
  const $ = cheerio.load(data);
  $('.topicItem').each((index, each) => {
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
      vod_id: href, vod_name: dramaName, vod_pic: '', vod_remarks: '',
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
    const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
    return match ? match[0] : null;
}

async function getTracks(ext) {
    await initializationPromise; // 等待登录完成
    if (!sessionCookie) return jsonify({ list: [] });

    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { 
          headers: { 'Referer': appConfig.site, 'User-Agent': UA, 'Cookie': sessionCookie } 
        });
        const $ = cheerio.load(data);
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();

        // ... (此处省略了正则匹配的逻辑，与上一版相同)
        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+   ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;
            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }
        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const $el = $(el);
            let href = $el.attr('href');
            if (!href) return;
            let agnosticUrl = getProtocolAgnosticUrl(href);
            if (!agnosticUrl || uniqueLinks.has(agnosticUrl)) return;
            href = href.replace('http://', 'https://' );
            let trackName = $el.text().trim();
            if (trackName.startsWith('http' ) || trackName === '') trackName = pageTitle;
            tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });
        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText )) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;
            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }

        return tracks.length ? jsonify({ list: [{ title: '天翼云盘', tracks }] }) : jsonify({ list: [] });
    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '加载失败', pan: 'about:blank', ext: { accessCode: '' } }] }] });
    }
}

async function search(ext) {
  await initializationPromise; // 等待登录完成
  if (!sessionCookie) return jsonify({ list: [] });

  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { 
    headers: { 'User-Agent': UA, 'Cookie': sessionCookie } 
  });
  const $ = cheerio.load(data);
  $('.topicItem').each((_, el) => {
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $(el).find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: href, vod_name: title, vod_pic: '', vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
