/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v31 (原汁原味修正版)
 *
 * 最终修正说明:
 * - 严格保持原始脚本的完整结构和所有解析逻辑。
 * - 仅将需要登录的网络请求 ($fetch) 指向全功能后端。
 * - 后端负责登录、抓取HTML，并直接返回原始HTML文本。
 * - 前端负责用Cheerio解析HTML，与原版逻辑完全一致。
 * - 这是一个既能绕过登录，又保留了原脚本所有精髓的最终方案。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// 新增：后端服务器地址
const BACKEND_URL = 'http://192.168.10.111:3001';

// appConfig 与原版完全一致
const appConfig = {
  ver: 31, // 版本号更新
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

async function getConfig( ) {
  return jsonify(appConfig);
}

// getCards 函数 - 仅修改请求目标
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  
  // --- 修改点：请求目标从雷鲸网站变为我们的后端 ---
  // 后端会代替我们访问 'https://www.leijing.xyz/${id}&page=${page}'
  const requestUrl = `${BACKEND_URL}/getCards?id=${encodeURIComponent(id )}&page=${page}`;
  const { data } = await $fetch.get(requestUrl);
  // --- 修改结束 ---

  // ▼▼▼ 以下所有解析逻辑，与你的原脚本一模一样，原封不动 ▼▼▼
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

// 辅助函数：getProtocolAgnosticUrl - 原封不动
function getProtocolAgnosticUrl(rawUrl) {
    if (!rawUrl) return null;
    const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
    return match ? match[0] : null;
}

// getTracks 函数 - 仅修改请求目标
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const uniqueLinks = new Set();

    try {
        // --- 修改点：请求目标从雷鲸网站变为我们的后端 ---
        const requestUrl = `${BACKEND_URL}/getTracks?url=${encodeURIComponent(ext.url)}`;
        const { data } = await $fetch.get(requestUrl);
        // --- 修改结束 ---

        // ▼▼▼ 以下所有解析逻辑，与你的原脚本一模一样，原封不动 ▼▼▼
        const $ = cheerio.load(data);
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();

        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
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
            let trackName = $el.text().trim() || pageTitle;
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

// search 函数 - 仅修改请求目标
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;

  // --- 修改点：请求目标从雷鲸网站变为我们的后端 ---
  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`;
  const { data } = await $fetch.get(requestUrl);
  // --- 修改结束 ---

  // ▼▼▼ 以下所有解析逻辑，与你的原脚本一模一样，原封不动 ▼▼▼
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
