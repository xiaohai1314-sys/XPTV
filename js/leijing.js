/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v28 (后端Cookie分离版)
 *
 * 变更说明:
 * - 这是一个前后端分离的版本。
 * - 后端是一个独立的Node.js服务，负责通过Puppeteer自动登录并维护有效的Cookie。
 * - 本脚本在执行任何需要登录的请求前，会先从后端服务获取最新的Cookie。
 * - 移除了所有硬编码的Cookie，实现了登录状态的动态化和自动化。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// =================== 新增配置 START ===================
// 后端Cookie服务的地址。如果你的后端部署在其他服务器，请修改'localhost'为服务器IP地址。
const COOKIE_PROVIDER_URL = 'http://192.168.10.111:3001/get-cookie';

// 用于在脚本运行期间缓存从后端获取的Cookie ，避免重复请求。
let dynamicCookie = null; 

/**
 * 确保获取到有效的Cookie。
 * 如果尚未获取，则从后端服务请求；如果已获取，则直接返回缓存的Cookie。
 * @returns {Promise<string>} 返回Cookie字符串，如果失败则为空字符串。
 */
async function ensureCookie() {
    if (dynamicCookie) {
        return dynamicCookie;
    }
    
    try {
        console.log('正在从后端服务获取最新Cookie...');
        const { data } = await $fetch.get(COOKIE_PROVIDER_URL);
        if (data && data.success) {
            dynamicCookie = data.cookie;
            console.log('Cookie获取成功！');
            return dynamicCookie;
        } else {
            throw new Error('从后端获取Cookie失败: ' + (data.message || '未知错误'));
        }
    } catch (error) {
        console.error('无法连接到Cookie服务:', error.message);
        // 返回空字符串，让后续的请求在没有Cookie的情况下进行（可能会失败，但脚本不会崩溃）
        return '';
    }
}
// =================== 新增配置 END ===================


// appConfig 与原版完全一致
const appConfig = {
  ver: 28, // 版本号更新
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

async function getConfig(   ) {
  return jsonify(appConfig);
}

// getCards 函数 - 已修改为使用动态Cookie
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  
  // --- 修改部分：动态获取Cookie ---
  const cookie = await ensureCookie();

  const { data } = await $fetch.get(url, { 
    headers: { 
      'Referer': appConfig.site, 
      'User-Agent': UA,
      'Cookie': cookie // 使用从后端获取的动态Cookie
    } 
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

// 辅助函数 - 原封不动
function getProtocolAgnosticUrl(rawUrl) {
    if (!rawUrl) return null;
    const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
    return match ? match[0] : null;
}

// getTracks 函数 - 已修改为使用动态Cookie
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        // --- 修改部分：动态获取Cookie ---
        const cookie = await ensureCookie();

        const { data } = await $fetch.get(url, { 
          headers: { 
            'Referer': appConfig.site, 
            'User-Agent': UA,
            'Cookie': cookie // 使用从后端获取的动态Cookie
          } 
        });
        const $ = cheerio.load(data);
        
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();

        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+   ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://'   );
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

            href = href.replace('http://', 'https://'   );

            let trackName = $el.text().trim();
            if (trackName.startsWith('http'   ) || trackName === '') {
                trackName = pageTitle;
            }

            tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });

        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText   )) !== null) {
            let panUrl = match[0].replace('http://', 'https://'   );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
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

// search 函数 - 已修改为使用动态Cookie
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  
  // --- 修改部分：动态获取Cookie ---
  const cookie = await ensureCookie();

  const { data } = await $fetch.get(url, { 
    headers: { 
      'User-Agent': UA,
      'Cookie': cookie // 使用从后端获取的动态Cookie
    } 
  });
  const $ = cheerio.load(data);
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
