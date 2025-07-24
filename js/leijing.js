/**
 * =================================================================
 * 脚本最终修复版 - 正确链接提取策略
 * 版本: 20
 *
 * 核心洞察:
 * - 链接本身已包含访问码，点击即可进入，无需手动输入。
 * - 之前脚本的问题在于正则表达式过早地被空格或括号截断，未能提取完整链接字符串。
 *
 * 新策略:
 * 1. 查找所有天翼云盘链接的<a>标签。
 * 2. 获取其父元素的完整文本内容。
 * 3. 使用新的正则表达式，完整匹配出 "链接 (访问码:xxxx)" 这样的完整字符串。
 * 4. 将这个完整字符串作为最终的网盘地址（pan）。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 20,
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
 * 【详情页解析 - 最终正确策略版】
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
    
    // 获取页面所有文本内容，用于正则匹配
    const bodyText = $('body').text();

    // 【核心修复】这个正则表达式现在会匹配完整的 "链接 (访问码:xxxx)" 字符串
    // 它会匹配 "http(s )://.../..." 后面可选地跟着一个带括号的访问码部分
    const panRegex = /(https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[a-zA-Z0-9]+(?:\s*[\(（]\s*访问码\s*[:：]\s*[a-zA-Z0-9]{4,6}\s*[\)）])?)/gi;
    
    let match;
    while ((match = panRegex.exec(bodyText)) !== null) {
      const fullLink = match[0].trim(); // 获取匹配到的完整字符串

      // 使用Set防止重复添加
      if (uniqueLinks.has(fullLink)) continue;
      uniqueLinks.add(fullLink);

      tracks.push({
        name: title, // 资源名统一使用页面标题
        pan: fullLink, // 将捕获到的完整链接+访问码字符串作为pan地址
        ext: { accessCode: "" } // 访问码字段留空，因为信息已在pan字段中
      });
    }

    return jsonify({ list: [{ title: "资源列表", tracks }] });

  } catch (e) {
    console.error("资源加载错误:", e);
    return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
  }
}
