/**
 * =================================================================
 * 脚本最终版 - 策略重定义
 * 版本: 25
 *
 * 最终洞察:
 * - 链接被隐藏在需要密码解锁的区域内，无法通过静态解析直接获取。
 * - 任何尝试自动提取链接的方法都将失败。
 *
 * 最终策略:
 * 1. 识别页面是否为加密页面 (通过检查是否存在 .hide-box)。
 * 2. 如果是加密页面，则不尝试提取链接。
 * 3. 提取页面的【标题】和【解锁提示文本】（如“输入密码可见”）。
 * 4. 将这些提示信息组合成一个特殊的、不可点击的“资源”，清晰地告诉用户需要手动操作。
 * 5. 如果不是加密页面，则继续使用我们之前已验证有效的融合策略来提取链接。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 25,
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

// --- 其他函数保持不变 ---
async function getConfig( ) { return jsonify(appConfig); }
async function getCards(ext) { ext = argsify(ext); let cards = []; let { page = 1, id } = ext; const url = appConfig.site + `/${id}&page=${page}`; const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } }); const $ = cheerio.load(data); $('.topicItem').each((index, each) => { if ($(each).find('.cms-lock-solid').length > 0) return; const href = $(each).find('h2 a').attr('href'); const title = $(each).find('h2 a').text(); const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/; const match = title.match(regex); const dramaName = match ? match[1] : title; const r = $(each).find('.summary').text(); const tag = $(each).find('.tag').text(); if (/content/.test(r) && !/cloud/.test(r)) return; if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; cards.push({ vod_id: href, vod_name: dramaName, vod_pic: '', vod_remarks: '', ext: { url: `${appConfig.site}/${href}` }, }); }); return jsonify({ list: cards }); }
async function getPlayinfo(ext) { return jsonify({ 'urls': [] }); }
async function search(ext) { ext = argsify(ext); let cards = []; let text = encodeURIComponent(ext.text); let page = ext.page || 1; let url = `${appConfig.site}/search?keyword=${text}&page=${page}`; const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } }); const $ = cheerio.load(data); const searchItems = $('.search-result ul > li, .topic-list > .topic-item, .result-list > .item, ul.search-results > li.result-item, .topicItem, .searchModule .item'); searchItems.each((index, each) => { const $item = $(each); const a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a'); const href = a.attr('href'); const title = a.text(); if (!href || !title) return; const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/; const match = title.match(regex); const dramaName = match ? match[1] : title; const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim(); if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; cards.push({ vod_id: href, vod_name: dramaName, vod_pic: $item.find('img').attr('src') || '', vod_remarks: tag, ext: { url: `${appConfig.site}/${href}` }, }); }); return jsonify({ list: cards }); }
// --- 其他函数保持不变 ---


/**
 * 【详情页解析 - 最终策略版】
 */
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const uniqueLinks = new Set();

  try {
    const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || "网盘资源";

    // **【核心逻辑】** 检查页面是否存在加密盒子
    const hideBox = $('.hide-box');
    if (hideBox.length > 0) {
      // 这是一个加密页面
      const promptText = hideBox.find('.background-prompt').text().trim();
      tracks.push({
        name: `【加密内容】${title}`,
        pan: `提示：${promptText || '此内容被隐藏，请在网页中手动解锁'}`,
        ext: { accessCode: "手动操作" }
      });
      return jsonify({ list: [{ title: "需要手动解锁", tracks }] });
    }

    // --- 如果不是加密页面，执行我们之前的融合策略 ---

    // 策略A: 查找所有直接的 <a> 标签链接
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && /https?:\/\/cloud\.189\.cn\/(t|web\/share )\//i.test(href)) {
        let panUrl = href;
        try { panUrl = decodeURIComponent(href); } catch(e) {}
        if (uniqueLinks.has(panUrl)) return;
        uniqueLinks.add(panUrl);
        tracks.push({ name: $(el).text().trim() || title, pan: panUrl, ext: { accessCode: "" } });
      }
    });

    // 策略B: 扫描整个页面纯文本
    const bodyText = $('body').text();
    const panRegex = /(https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[a-zA-Z0-9]+(?:\s*[\(（][\s\S]*?[\)）])?)/gi;
    let match;
    while ((match = panRegex.exec(bodyText)) !== null) {
      const fullLink = match[0].trim();
      if (uniqueLinks.has(fullLink)) continue;
      uniqueLinks.add(fullLink);
      tracks.push({ name: title, pan: fullLink, ext: { accessCode: "" } });
    }

    return jsonify({ list: [{ title: "资源列表", tracks }] });

  } catch (e) {
    console.error("资源加载错误:", e);
    return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
  }
}
