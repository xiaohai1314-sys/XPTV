/*
 * ====================================================================
 *  雷鲸资源站脚本 - 最终完整版
 * ====================================================================
 *  遵照用户最终要求：
 *  1. 提取方式1和2，与用户原始脚本一字不差，完全相同。
 *  2. Puppeteer后端调用作为独立的第3部分，只用于补充特例。
 *  3. 使用最安全、最健壮的方式处理后端返回的数据。
 *  4. 提供未经任何省略的完整代码。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0 Safari/537.36';
const cheerio = createCheerio();

const appConfig = {
  ver: 2025072915,
  title: '雷鲸·jump跳转修正版',
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

// 【重要】在这里配置您后端服务的地址
// 请将 "您的电脑IP地址" 替换为运行 server.js 的电脑的真实局域网IP
const PUPPETEER_API_URL = 'http://192.168.10.111:3002/api/clickAndGetFinalUrl';


async function getConfig( ) {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  const cards = [];
  $('.topicItem').each((_, el) => {
    if ($(el).find('.cms-lock-solid').length) return;
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text().replace(/【.*?】|（.*?）/g, '').trim();
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

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const pageUrl = ext.url;
  const unique = new Set();

  try {
    const { data } = await $fetch.get(pageUrl, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || '网盘资源';

    // --- 1️⃣ 精准匹配：与您原脚本完全一致，一字不差 ---
    const precise = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let m;
    while ((m = precise.exec(data)) !== null) {
      const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      if (!unique.has(panUrl )) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
        unique.add(panUrl);
      }
    }

    // --- 2️⃣ <a> 标签提取：与您原脚本完全一致，一字不差 ---
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || unique.has(href)) return;
      const ctx = $(el).parent().text();
      const code = /(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i.exec(ctx);
      tracks.push({
        name: $(el).text().trim() || title,
        pan: href,
        ext: { accessCode: code ? code[1] : '' },
      });
      unique.add(href);
    });

    // --- 3️⃣ Puppeteer 提取：作为补充，处理特例 ---
    try {
      // 只有当页面上可能存在特例，并且前两种方式没找到任何链接时，才调用后端
      if (data.includes("访问码") && data.includes("cloud.189.cn") && tracks.length === 0) {
        console.log('Calling Puppeteer backend for special case...');
        const response = await $fetch.post(PUPPETEER_API_URL, { url: pageUrl }, { headers: { 'Content-Type': 'application/json' } });
        
        console.log('Received response from backend. Raw response: ' + JSON.stringify(response));

        let result = null;
        // 使用最安全的方式解析返回的数据
        if (response && response.data) {
            try {
                result = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;
            } catch (e) {
                console.log('Failed to parse response.data: ' + e.message);
            }
        }
        if (!result) {
            try {
                result = (typeof response === 'string') ? JSON.parse(response) : response;
            } catch (e) {
                console.log('Failed to parse response directly: ' + e.message);
            }
        }

        if (result && result.success && result.url) {
          console.log('Successfully parsed result. URL: ' + result.url);
          if (!unique.has(result.url)) {
            tracks.push({
              name: `${title} [P]`,
              pan: result.url,
              ext: { accessCode: result.accessCode },
            });
            unique.add(result.url);
          }
        } else {
          console.log('Could not find a valid success result in the response.');
        }
      }
    } catch (puppeteerError) {
      console.log('Puppeteer backend call failed catastrophically.', puppeteerError.message);
    }

    return tracks.length
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    return jsonify({
      list: [{ title: '脚本执行错误', tracks: [{ name: e.message, pan: 'about:blank', ext: { accessCode: '' } }] }],
    });
  }
}

async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  $('.topicItem').each((_, el) => {
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text().replace(/【.*?】|（.*?）/g, '').trim();
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
