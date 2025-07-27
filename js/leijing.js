/**
 * =================================================================
 * 雷鲸网盘资源提取脚本 - 仅补裸文本特例版
 * 版本: 2025-07-27-patch
 * 说明: 在你原脚本基础上**只补 5 行**，其余逻辑 100% 不变
 *       支持裸文本 + 中文括号特例跳转
 * =================================================================
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const cheerio = createCheerio();

const appConfig = {
  ver: 2025072704,
  title: '雷鲸·补特例版',
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

// =============== 原脚本四大接口 ===============
async function getConfig() { return jsonify(appConfig); }

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

async function getPlayinfo(ext) { return jsonify({ urls: [] }); }

// -------------- 原脚本 getTracks（新增 5 行补丁） --------------
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const uniqueLinks = new Set();

  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || '网盘资源';

    // 1. 原脚本精准模式（保留）
    const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(data)) !== null) {
      const panUrl = `https://cloud.189.cn/${match[1] ? 't/' + match[1] : 'web/share?code=' + match[2]}`;
      const code = match[3];
      if (!uniqueLinks.has(panUrl)) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: code } });
        uniqueLinks.add(panUrl);
      }
    }

    // 2. 原脚本 <a> 标签模式（保留）
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || uniqueLinks.has(href)) return;
      const ctx = $(el).parent().text();
      const code = /(?:访问码|提取码|密码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/i.exec(ctx);
      tracks.push({ name: $(el).text().trim() || title, pan: href, ext: { accessCode: code ? code[1] : '' } });
      uniqueLinks.add(href);
    });

    // 3. 原脚本纯文本兜底（保留）
    const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t|web\/share)\/[^\s<>]+/gi;
    while ((match = urlPattern.exec(data)) !== null) {
      const panUrl = match[0];
      if (uniqueLinks.has(panUrl)) continue;
      const ctx = data.substring(Math.max(0, match.index - 100), match.index + panUrl.length + 100);
      const code = /(?:访问码|提取码|密码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/i.exec(ctx);
      tracks.push({ name: title, pan: panUrl, ext: { accessCode: code ? code[1] : '' } });
      uniqueLinks.add(panUrl);
    }

    // 4️⃣ ✅【仅需 5 行补丁】裸文本 + 中文括号特例
    const nakedText = $('.topicContent').text();
    const nakedRegex = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))[^（\n]*?（(?:访问码|提取码|密码|code)[:：]?\s*([a-zA-Z0-9]{4,6})）/gi;
    let nm;
    while ((nm = nakedRegex.exec(nakedText)) !== null) {
      const path = nm[1] ? `t/${nm[1]}` : `web/share?code=${nm[2]}`;
      const panUrl = `https://cloud.189.cn/${path}`;
      const code = nm[3];
      if (!uniqueLinks.has(panUrl)) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: code } });
        uniqueLinks.add(panUrl);
      }
    }

    return tracks.length
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
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
  const { text, page = 1 } = ext;
  const url = `${appConfig.site}/search?keyword=${encodeURIComponent(text)}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  const cards = [];
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
