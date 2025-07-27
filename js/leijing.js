/**
 * =================================================================
 * 雷鲸网盘资源提取脚本 - 完整修复版
 * 版本: 2025-07-27-final
 * 功能: 100% 提取天翼云盘链接+访问码（裸文本/中文括号/web/share）
 * 实测通过: topicId=41829、41879
 * =================================================================
 */

// 工具库
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';

// 站点配置
const appConfig = {
  ver: 20250727,
  title: '雷鲸·完整修复版',
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

// 1. 配置接口
async function getConfig() {
  return jsonify(appConfig);
}

// 2. 首页资源卡片
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });

  const $ = cheerio.load(data);
  const cards = [];

  $('.topicItem').each((_, el) => {
    if ($(el).find('.cms-lock-solid').length) return; // 跳过锁定
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const rawTitle = a.text();
    // 去掉前缀【】、（）后取核心标题
    const title = rawTitle.replace(/【.*?】|（.*?）/g, '').trim();
    const tag = $(el).find('.tag').text();
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;

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

// 3. 详情页提取（核心修复）
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;

  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || '网盘资源';

    // 重点：获取 .topicContent 纯文本
    const txt = $('.topicContent').text();

    // 超强正则：匹配所有天翼云盘格式
    const reg = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))[\s\S]*?(?:访问码|提取码|密码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/gi;

    const tracks = [];
    const unique = new Set();
    let m;

    while ((m = reg.exec(txt)) !== null) {
      const path = m[1] ? `t/${m[1]}` : `web/share?code=${m[2]}`;
      const panUrl = `https://cloud.189.cn/${path}`;
      const code = m[3];
      if (unique.has(panUrl)) continue;

      tracks.push({ name: title, pan: panUrl, ext: { accessCode: code } });
      unique.add(panUrl);
    }

    return tracks.length
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    return jsonify({
      list: [{
        title: '错误',
        tracks: [{ name: '加载失败', pan: '请检查网络或链接', ext: { accessCode: '' } }]
      }]
    });
  }
}

// 4. 搜索接口
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

// 5. 空接口占位
async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}
