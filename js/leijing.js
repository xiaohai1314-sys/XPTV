/*
 * 雷鲸资源站脚本 - 纯前端终极精准修正版3
 * 仅在原始脚本的第2部分(a标签提取)中增加URL编码逻辑
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

// 其他函数 getConfig, getCards, getPlayinfo, search 保持不变
async function getConfig( ) { return jsonify(appConfig); }
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
async function getPlayinfo(ext) { return jsonify({ urls: [] }); }


async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const unique = new Set();

  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || '网盘资源';

    // --- 1️⃣ 精准匹配：与您原脚本完全一致 ---
    const precise = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let m;
    while ((m = precise.exec(data)) !== null) {
      const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      if (!unique.has(panUrl )) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
        unique.add(panUrl);
      }
    }

    // --- 2️⃣ <a> 标签提取：【唯一修正点】在这里处理混合链接 ---
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      let finalUrl = $(el).attr('href');
      if (!finalUrl || unique.has(finalUrl)) return;

      // 检查 href 属性本身是否就是混合链接
      const separatorIndex = finalUrl.search(/[（(]访问码/);
      if (separatorIndex !== -1) {
        // 如果是混合链接，则进行URL编码
        const pureUrl = finalUrl.substring(0, separatorIndex);
        const suffix = finalUrl.substring(separatorIndex);
        finalUrl = pureUrl + encodeURIComponent(suffix); // 更新 finalUrl 为编码后的链接
        
        tracks.push({
          name: $(el).text().trim() || title,
          pan: finalUrl, // 提交编码后的单一链接
          type: 'jump',
          ext: { accessCode: '' }, // accessCode 必须为空
        });

      } else {
        // 如果不是混合链接，则按原逻辑处理
        const ctx = $(el).parent().text();
        const code = /(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i.exec(ctx);
        tracks.push({
          name: $(el).text().trim() || title,
          pan: finalUrl,
          ext: { accessCode: code ? code[1] : '' },
        });
      }
      unique.add(finalUrl);
    });

    // --- 不再需要第3部分 ---

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
