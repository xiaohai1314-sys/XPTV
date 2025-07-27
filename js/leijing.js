/**
 * =================================================================
 * 最终可用脚本 - 融合 v16 和 v20 优点
 * 版本: 22 (分析优化版)
 *
 * 更新日志:
 * - 根据对 leijing.xyz 网站 HTML 结构的深入分析进行优化。
 * - [getTracks] 函数核心逻辑重构：
 *   1. **目标区域文本化**: 首先提取 `.topicContent` 区域的全部纯文本，消除 HTML 标签和 URL 编码的干扰。
 *   2. **单一强力正则**: 使用一个经过优化的正则表达式，直接在纯文本中匹配 "链接+访问码" 的组合模式。
 *      - 该正则兼容 /t/ 和 /web/share?code= 两种天翼云盘链接。
 *      - 兼容全角和半角括号及冒号。
 *      - 能从匹配项中精确捕获纯链接和访问码。
 *   3. **去重与健壮性**: 确保结果不重复，并处理了找不到内容或请求失败的边界情况。
 * - 此版本逻辑更清晰，针对性更强，是目前最精准高效的实现。
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

// --- 详情页函数: v22 分析优化版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        
        // 1. 定位核心内容区域，并提取其纯文本
        const contentText = $('.topicContent').text();
        if (!contentText) {
            console.log("未能找到 .topicContent 区域或其内容为空。");
            return jsonify({ list: [] });
        }

        // 2. 使用强化的正则表达式在纯文本中进行匹配
        // 正则解释:
        // - (https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ )) : 捕获组1, 匹配两种天翼云盘链接
        // - \s* : 匹配0或多个空白符
        // - [（(] : 匹配全角或半角左括号
        // - [^）)]*? : 非贪婪匹配任何非右括号的字符
        // - (?:访问码|密码|提取码|code)\s*[:：]?\s* : 匹配 "访问码" 等关键字和可选的冒号
        // - ([a-zA-Z0-9]{4,6}) : 捕获组2, 匹配4到6位的字母数字访问码
        // - [^）)]*? : 匹配到右括号前的任何字符
        // - [）)] : 匹配全角或半角右括号
        const pattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))[^）)]*?(?:访问码|密码|提取码|code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})/gi;
        
        let match;
        while ((match = pattern.exec(contentText)) !== null) {
            const panUrl = match[1].trim();
            const accessCode = match[2].trim();
            
            // 使用链接作为唯一标识符进行去重
            if (uniqueLinks.has(panUrl)) continue;

            tracks.push({
                name: pageTitle, // 使用页面标题作为资源名
                pan: panUrl,
                ext: { accessCode }
            });
            uniqueLinks.add(panUrl);
        }

        if (tracks.length > 0) {
            return jsonify({ list: [{ title: "天翼云盘", tracks }] });
        } else {
            console.log("在页面文本中未匹配到任何有效的网盘链接和访问码组合。");
            return jsonify({ list: [] });
        }

    } catch (e) {
        console.error('获取详情页失败:', e.message);
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
