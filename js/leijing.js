/**
 * =================================================================
 * 最终集大成版脚本 (The Grand Finale)
 * 版本: 29.0
 *
 * 更新日志:
 * - [最终整合] getTracks 函数现已包含所有已知的提取策略，确保最大兼容性：
 *   1. **新增并修正了“裸文本”提取法**：采纳参考脚本的思路并修正了其正则瑕疵，作为最高优先级策略，专门解决特例问题。
 *   2. **完整保留了原始脚本的提取法**：包括对<a>标签href和其上下文文本的解析，作为补充和兼容性保障。
 * - 使用 Set 对所有提取结果进行统一去重，确保结果列表干净。
 * - getCards 和 search 函数严格保持您原始脚本的风貌，确保基础功能稳定。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 29.0,
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

// [保持原样] 严格使用您原始脚本的版本
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
  return jsonify({ 'urls': [] });
}

// [最终整合] 融合了所有提取策略
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        
        // --- 策略1：裸文本提取 (来自参考脚本，已修正) ---
        const contentText = $('.topicContent').text();
        const nakedPattern = /https?:\/\/cloud\.189\.cn\/t\/([a-zA-Z0-9]+ )[^（]*（访问码[:：\s]*([a-zA-Z0-9]{4,6})）/g;
        let match;
        while ((match = nakedPattern.exec(contentText)) !== null) {
            const panUrl = `https://cloud.189.cn/t/${match[1]}`;
            const accessCode = match[2]; // 修正后 ，不带括号
            if (!uniqueLinks.has(panUrl)) {
                tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode } });
                uniqueLinks.add(panUrl);
            }
        }

        // --- 策略2：精准组合提取 (来自您的原始脚本) ---
        const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        while ((match = precisePattern.exec(data)) !== null) {
            const panUrl = `https://cloud.189.cn/${match[1] ? 't/' + match[1] : 'web/share?code=' + match[2]}`;
            if (!uniqueLinks.has(panUrl )) {
                tracks.push({ name: title, pan: panUrl, ext: { accessCode: match[3] } });
                uniqueLinks.add(panUrl);
            }
        }

        // --- 策略3：<a>标签提取 (来自您的原始脚本) ---
        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href || uniqueLinks.has(href)) return;
            
            const contextText = $(el).parent().text();
            const codeMatch = contextText.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
            const accessCode = codeMatch ? codeMatch[1] : '';

            if (!uniqueLinks.has(href)) {
                tracks.push({ name: $(el).text().trim() || title, pan: href, ext: { accessCode: accessCode } });
                uniqueLinks.add(href);
            }
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

// [保持原样] 严格使用您原始脚本的版本
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
