/**
 * =================================================================
 * 脚本最终完美版 - 终极版
 * 版本: 22
 *
 * 最终洞察:
 * - 链接和访问码被作为一个整体，经过URL编码后，存储在<a>标签的href属性中。
 *
 * 最终策略:
 * 1. 找到所有<a>标签。
 * 2. 获取其href属性值。
 * 3. 对href值进行URL解码(decodeURIComponent)。
 * 4. 对解码后的干净文本使用正则表达式提取出链接和访问码。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 22,
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
 * 【详情页解析 - 终极正确版】
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

    // 1. 核心策略：查找所有链接，解码href，然后提取
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (!href || !href.includes('cloud.189.cn')) return;

      // 【核心修复】对href属性进行URL解码
      let decodedHref = '';
      try {
        decodedHref = decodeURIComponent(href);
      } catch (e) {
        decodedHref = href; // 如果解码失败，使用原始href
      }
      
      // 正则表达式，用于从解码后的文本中提取链接和访问码
      const panRegex = /(https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+ )[\s\S]*?(?:访问码|密码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/;
      const match = decodedHref.match(panRegex);

      if (match) {
        const panUrl = match[1]; // 链接部分
        const accessCode = match[2]; // 访问码部分

        if (uniqueLinks.has(panUrl)) return;
        uniqueLinks.add(panUrl);

        tracks.push({
          name: $(el).text().trim() || title,
          pan: panUrl,
          ext: { accessCode: accessCode || "" }
        });
      } else if (isValidPanUrl(decodedHref)) {
        // 如果没有匹配到访问码，但解码后的链接是合法的，也添加进去
        const panUrl = decodedHref.split(' ')[0]; // 取空格前部分作为纯链接
        if (uniqueLinks.has(panUrl)) return;
        uniqueLinks.add(panUrl);
        
        tracks.push({
          name: $(el).text().trim() || title,
          pan: panUrl,
          ext: { accessCode: "" }
        });
      }
    });

    // 2. 备用策略：如果上述方法失败，扫描整个页面纯文本
    if (tracks.length === 0) {
        console.log("在<a>标签中未找到链接，对全文进行扫描...");
        const bodyText = $('body').text();
        const panRegex = /(https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+ )[\s\S]*?(?:访问码|密码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/;
        let match;
        while ((match = panRegex.exec(bodyText)) !== null) {
            const panUrl = match[1];
            const accessCode = match[2];
            if (uniqueLinks.has(panUrl)) continue;
            uniqueLinks.add(panUrl);
            tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode || "" } });
        }
    }

    return jsonify({ list: [{ title: "资源列表", tracks }] });

  } catch (e) {
    console.error("资源加载错误:", e);
    return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
  }
}

function isValidPanUrl(url) {
  if (!url) return false;
  return /https?:\/\/cloud\.189\.cn\/(t|web\/share )\//i.test(url);
}
