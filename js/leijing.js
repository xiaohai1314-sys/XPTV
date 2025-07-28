/**
 * 雷鲸网盘资源提取脚本 - 原脚本补丁版
 * 版本: 2025-07-28-patch
 * 说明: 在原脚本基础上追加裸文本 + 中文括号特例
 * 使用: 直接替换原脚本即可
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0 Safari/537.36';
const cheerio = createCheerio();

const appConfig = {
  ver: 1,
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

/* 工具函数（与原一致） */
function normalizePanUrl(url) {
  try {
    const urlObj = new URL(url);
    return (urlObj.origin + urlObj.pathname).toLowerCase();
  } catch (e) {
    const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>( )]+/);
    return match ? match[0].toLowerCase() : url.toLowerCase();
}
function extractAccessCode(text) {
  if (!text) return '';
  let match = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
  if (match && match[1]) return match[1];
  match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
  return match ? match[1] : '';
}

/* 全部接口（与原一致） */
async function getConfig()        { return jsonify(appConfig); }
async function getPlayinfo(ext)   { return jsonify({ urls: [] }); }

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
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

/* 仅改动的 getTracks */
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const uniqueLinks = new Set();

  try {
    const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || "网盘资源";
    const bodyText = $('body').text(); // 获取整个页面文本，备用

    /* 1️⃣ 原脚本精准组合（保留） */
    const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let match;
    while ((match = precisePattern.exec(bodyText)) !== null) {
      const panUrl = match[0].split(/[\(（\uff08]/)[0].trim();
      const accessCode = match[3];
      const normalizedUrl = normalizePanUrl(panUrl);
      if (uniqueLinks.has(normalizedUrl)) continue;
      tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
      uniqueLinks.add(normalizedUrl);
    }

    /* 2️⃣ 原脚本 <a> 标签提取（保留） */
    $('a[href*="cloud.189.cn"]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href || uniqueLinks.has(href)) return;
      const contextText = $(el).parent().text(); // 获取链接所在元素的文本
      const localCode = extractAccessCode(contextText);
      const normalizedUrl = normalizePanUrl(href);
      if (!uniqueLinks.has(normalizedUrl)) {
        tracks.push({ name: $(el).text().trim() || title, pan: href, ext: { accessCode: localCode || '' } });
        uniqueLinks.add(normalizedUrl);
      }
    });

    /* 3️⃣ 新增：裸文本 + 中文括号特例（追加） */
    const nakedPattern = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+)|web\/share\?code=([a-zA-Z0-9]+))[^（]*（访问码[:：\s]*([a-zA-Z0-9]{4,6}）)/gi;
    while ((match = nakedPattern.exec($('.topicContent').text())) !== null) {
      const panUrl = `https://cloud.189.cn/${match[1] ? 't/' + match[1] : 'web/share?code=' + match[2]}`;
      if (!uniqueLinks.has(normalizedUrl)) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: match[3] } });
        uniqueLinks.add(panUrl);
      }
    }

    return tracks.length > 0
      ? jsonify({ list: [{ title: "天翼云盘", tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    console.error('获取详情页失败:', e);
    return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
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
  const searchItems = $('.search-result ul > li, .topic-list > .topic-item, .result-list > .item, ul.search-results > li.result-item, .topicItem, .searchModule .item');
  searchItems.each((index, each) => {
    const $item = $(each);
    const a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a');
    const href = a.attr('href');
    const title = a.text();
    if (!href || !title) return;
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const r = $item.find('.summary').text();
    const tag = $item.find('.tag').text();
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
