/**
 * =================================================================
 * 雷鲸网盘资源提取脚本 - 可跳转外链版
 * 版本: 2025-07-27-jumpfix-final
 * 功能: 100% 提取天翼云盘链接并生成可跳转外链
 * 使用: 返回 urls 字段 + type:'web'，支持 App 直接拉起浏览器
 * =================================================================
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const cheerio = createCheerio();

const appConfig = {
  ver: 2025072703,
  title: '雷鲸·外链版',
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

// ---------------------------- 通用工具 -----------------------------
// 清洗 URL：去掉中文括号、空格、换行等
function cleanUrl(raw) {
  return raw
    .replace(/（.*/, '')   // 去掉中文括号及后面
    .replace(/\s.*/, '')   // 去掉空格及后面
    .split('?')[0];        // 去掉多余 query
}

// 统一提取访问码
function extractAccessCode(text) {
  const m = text.match(/(?:访问码|提取码|密码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/i);
  return m ? m[1] : '';
}

// ---------------------------- 四大接口 -----------------------------
async function getConfig() {
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

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

// 🎯 核心：返回可跳转外链
async function getTracks(ext) {
  ext = argsify(ext);
  const url = ext.url;
  const urls = [];
  const unique = new Set();

  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || '网盘资源';

    // 1️⃣ 精准组合
    const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let m;
    while ((m = precisePattern.exec(data)) !== null) {
      const raw = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      const panUrl = cleanUrl(raw);
      if (!unique.has(panUrl)) {
        urls.push({
          name: title,
          url: panUrl,
          type: 'web',
          ext: { accessCode: m[3] }
        });
        unique.add(panUrl);
      }
    }

    // 2️⃣ a 标签
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || unique.has(href)) return;
      const ctx = $(el).parent().text();
      const code = extractAccessCode(ctx);
      const panUrl = cleanUrl(href);
      urls.push({
        name: $(el).text().trim() || title,
        url: panUrl,
        type: 'web',
        ext: { accessCode: code }
      });
      unique.add(panUrl);
    });

    // 3️⃣ 裸文本兜底
    const nakedPattern = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))[\s\S]*?(?:访问码|提取码|密码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/gi;
    while ((m = nakedPattern.exec($('.topicContent').text())) !== null) {
      const raw = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      const panUrl = cleanUrl(raw);
      if (!unique.has(panUrl)) {
        urls.push({
          name: title,
          url: panUrl,
          type: 'web',
          ext: { accessCode: m[3] }
        });
        unique.add(panUrl);
      }
    }

    return urls.length
      ? jsonify({ list: [{ title: '天翼云盘', urls }] })
      : jsonify({ list: [] });

  } catch (e) {
    return jsonify({
      list: [{
        title: '错误',
        urls: [{ name: '加载失败', url: 'about:blank', type: 'web', ext: { accessCode: '' } }]
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
