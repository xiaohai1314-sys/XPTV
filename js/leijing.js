/*
 * ====================================================================
 *  雷鲸资源站脚本 - Puppeteer 混合模式最终版
 * ====================================================================
 *  功能：保留原始的1、2部分提取，第3部分通过调用Puppeteer后端实现。
 *  作者：Manus (根据用户方案实现)
 *  日期：2025-07-29
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
  const pageUrl = ext.url; // 详情页的URL
  const unique = new Set();

  try {
    const { data } = await $fetch.get(pageUrl, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || '网盘资源';

    // --- 1️⃣ 精准匹配：与您原脚本完全一致，保持不变 ---
    const precise = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let m;
    while ((m = precise.exec(data)) !== null) {
      const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      if (!unique.has(panUrl )) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
        unique.add(panUrl);
      }
    }

    // --- 2️⃣ <a> 标签提取：与您原脚本完全一致，但跳过混合链接让Puppeteer处理 ---
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const href = $(el).attr('href');
      // 如果是混合链接，则跳过，交给第3部分处理
      if (!href || unique.has(href) || /[（(]访问码/.test(href)) {
        return;
      }
      const ctx = $(el).parent().text();
      const code = /(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i.exec(ctx);
      tracks.push({
        name: $(el).text().trim() || title,
        pan: href,
        ext: { accessCode: code ? code[1] : '' },
      });
      unique.add(href);
    });


    // --- 3️⃣ Puppeteer 提取：调用后端来处理特例 ---
    try {
      // 只有当页面上存在混合链接时，才调用后端，以提高效率
      if (data.includes("访问码") && data.includes("cloud.189.cn")) {
        console.log('Possible special link detected. Calling Puppeteer backend...');
        const response = await $fetch.post(PUPPETEER_API_URL, {
          url: pageUrl, // 把当前详情页的URL发给后端
        }, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        const result = JSON.parse(response.data);

        if (result.success && result.url && !unique.has(result.url)) {
          console.log('Puppeteer backend returned a valid link:', result.url);
          tracks.push({
            name: `${title} [P]`, // 加个标记，表示是Puppeteer获取的
            pan: result.url,
            ext: { accessCode: result.accessCode },
          });
          unique.add(result.url);
        } else if (!result.success) {
          console.log('Puppeteer backend returned an error:', result.error);
        }
      }
    } catch (puppeteerError) {
      console.log('Puppeteer backend call failed. This is not a fatal error.', puppeteerError.message);
      // 这里即使失败了，也不影响前面1、2部分的结果，程序不会崩溃
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
