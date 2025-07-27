/**
 * =================================================================
 * 最终可用脚本 - 融合 v16 和 v20 优点
 * 版本: 21.3 (根源修正版)
 *
 * 更新日志:
 * - 彻底反思并重写核心提取逻辑，定位到问题的根源在于对<a>标签的错误处理方式。
 * - [getTracks] 放弃在整个页面文本中进行复杂正则匹配的旧思路。
 * - 采用全新的、更可靠的策略：
 *   1. **直接遍历<a>标签**: 脚本现在直接查找所有包含 "cloud.189.cn" 的<a>标签。
 *   2. **分离处理**: 对每个<a>标签，分别处理其 `href` 属性（获取纯链接）和可见文本（提取访问码）。
 *   3. **简化正则**: 使用一个非常简单和明确的正则表达式，只用于从<a>标签的文本中提取访问码。
 * - [getCards] 保留了对过滤条件的修正，确保帖子不会在列表页被错误过滤。
 * - 此版本逻辑清晰，直击要害，是解决该问题的最终、最可靠的方案。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: "21.3",
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

async function getConfig(   ) {
  return jsonify(appConfig);
}

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
    // 修正过滤逻辑，防止误杀
    if (r.includes('content') && !r.includes('cloud.189.cn')) return;
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
  return jsonify({ 'urls': [] });
}

// --- 详情页函数: v21.3 根源修正版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";

        // 全新的、更可靠的提取策略
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const linkText = $el.text(); // 获取<a>标签的可见文本，例如 "http...（访问码：t189 ）"

            if (!href) return;

            // 1. 从 href 中提取纯净的 URL
            const urlMatch = href.match(/https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ )/);
            if (!urlMatch) return;
            const panUrl = urlMatch[0];

            // 使用纯净 URL 进行去重
            if (uniqueLinks.has(panUrl)) return;

            // 2. 从链接的可见文本中提取访问码
            let accessCode = '';
            const codeMatch = linkText.match(/(?:访问码|密码|提取码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/i);
            if (codeMatch && codeMatch[1]) {
                accessCode = codeMatch[1];
            }

            tracks.push({
                name: pageTitle,
                pan: panUrl,
                ext: { accessCode }
            });
            uniqueLinks.add(panUrl);
        });

        if (tracks.length > 0) {
            return jsonify({ list: [{ title: "天翼云盘", tracks }] });
        } else {
            return jsonify({ list: [] });
        }

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
    const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim();
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
