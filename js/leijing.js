/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v34 (仅搜索代理版)
 *
 * 修正说明:
 * - 只有 search() 函数通过后端代理执行，以绕过登录限制。
 * - getCards() 和 getTracks() 函数恢复为直接请求原始网站。
 * - 后端服务器功能简化，只为搜索提供服务。
 * - 修正 getTracks() 函数，增加对 a 标签 href 属性中链接和访问码的提取逻辑。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// 后端服务器地址 (仅供search使用)
const BACKEND_URL = 'http://192.168.1.3:3001';

const appConfig = {
  ver: 34, // 版本号更新
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=4.2204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
};

async function getConfig( ) {
  return jsonify(appConfig);
}

// 辅助函数，用于处理$fetch返回的数据
function getHtmlFromResponse(response) {
    if (typeof response === 'string') {
        return response;
    }
    if (response && typeof response.data === 'string') {
        return response.data;
    }
    console.error("收到了非预期的响应格式:", response);
    return ''; 
}

// getCards 函数 - 直接请求原始网站
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`;
  const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
  const htmlData = getHtmlFromResponse(response);

  const $ = cheerio.load(htmlData);
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

function getProtocolAgnosticUrl(rawUrl) {
    if (!rawUrl) return null;
    const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
    return match ? match[0] : null;
}

// getTracks 函数 - 直接请求原始网站 (已修正)
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
        
        // ==================== 新增逻辑开始 ====================
        // 专门匹配 href 中包含完整链接和访问码的 a 标签
        const hrefPattern = /(https?:\/\/cloud\.189\.cn\/web\/share\?code=\w+.*?访问码[：:]([a-zA-Z0-9]{4,6}))/;
        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            
            const match = href.match(hrefPattern);
            if (match) {
                let panUrl = match[1].replace('http://', 'https://');
                let agnosticUrl = getProtocolAgnosticUrl(panUrl);
                if (agnosticUrl && !uniqueLinks.has(agnosticUrl)) {
                    tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
                    uniqueLinks.add(agnosticUrl);
                }
            }
        });
        // ==================== 新增逻辑结束 ====================

        // 保留原有逻辑作为备用
        const bodyText = $('body').text();
        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://');
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
            // 如果链接中已经包含访问码，则跳过，避免重复添加
            if (/[（(]访问码/.test(href)) return;

            href = href.replace('http://', 'https://');
            let trackName = $el.text().trim() || pageTitle;
            tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });

        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://');
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

// search 函数 - 通过后端代理
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`;
  const response = await $fetch.get(requestUrl);
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
