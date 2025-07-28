/**
 * =================================================================
 * 雷鲸网盘资源提取脚本 - 最终完整可运行版
 * 版本: 2025-07-28-final
 * 功能: 提取天翼云盘链接 + 访问码（含裸文本中文括号特例）
 * 使用: 直接替换原脚本即可运行
 * =================================================================
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0 Safari/537.36';
const cheerio = createCheerio();

const appConfig = {
  ver: 20250728,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集',       ext: { id: '?tagId=42204684250355' } },
    { name: '电影',       ext: { id: '?tagId=42204681950354' } },
    { name: '动漫',       ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片',     ext: { id: '?tagId=42204697150356' } },
    { name: '综艺',       ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘',   ext: { id: '?tagId=42212287587456' } },
  ],
};

/* ---------- 工具 ---------- */
function normalizePanUrl(raw) {
  try {
    const u = new URL(raw);
    return (u.origin + u.pathname).toLowerCase();
  } catch (_) {
    const m = raw.match(/https?:\/\/cloud\.189\.cn\/[^\s<>()]+/);
    return m ? m[0].toLowerCase() : raw.toLowerCase();
}
function extractAccessCode(str) {
  const m = str.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
  return m ? m[1] : '';
}

/* ---------- 接口 ---------- */
async function getConfig()        { return jsonify(appConfig); }
async function getPlayinfo(ext)   { return jsonify({ urls: [] }); }

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
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({ vod_id: href, vod_name: title, vod_pic: '', vod_remarks: tag, ext: { url: `${appConfig.site}/${href}` } });
  });
  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const unique = new Set();

  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || '网盘资源';

    /* 1️⃣ 原脚本精准组合 */
    const precise = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let m;
    while ((m = precise.exec(data)) !== null) {
      const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      if (!unique.has(panUrl)) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
        unique.add(panUrl);
      }
    }

    /* 2️⃣ 原脚本 <a> 标签提取 */
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || unique.has(href)) return;
      const ctx = $(el).parent().text();
      const code = extractAccessCode(ctx);
      if (!unique.has(href)) {
        tracks.push({ name: $(el).text().trim() || title, pan: href, ext: { accessCode: code || '' } });
        unique.add(href);
      }
    });

    /* 3️⃣ 新增：裸文本 + 中文括号特例 */
    const naked = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))[^（]*（访问码[:：\s]*([a-zA-Z0-9]{4,6}）)/gi;
    while ((m = naked.exec($('.topicContent').text())) !== null) {
      const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      if (!unique.has(panUrl)) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
        unique.add(panUrl);
      }
    }

    return tracks.length
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    return jsonify({ list: [{ title: '错误', tracks: [{ name: '加载失败', pan: 'about:blank', ext: { accessCode: '' } }] }] });
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
    cards.push({ vod_id: href, vod_name: title, vod_pic: '', vod_remarks: tag, ext: { url: `${appConfig.site}/${href}` } });
  });
  return jsonify({ list: cards });
}
