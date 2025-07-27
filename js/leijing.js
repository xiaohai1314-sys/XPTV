/**
 * =================================================================
 * 最终可用脚本 - 终极修正版 v2
 * 版本: 26 (分治策略版)
 *
 * 更新日志:
 * - 彻底反思并重构 getTracks 函数，放弃单一正则的策略，采用更可靠的“分而治之”三步提取法。
 * - [步骤1: a标签解析] 专门处理信息在 a 标签内的情况(href+text)，可完美解决 topicId=41829。
 * - [步骤2: 纯文本解析] 专门处理链接为纯文本，密码在后的情况，可解决 topicId=41879。
 * - [步骤3: 全局扫描] 作为补充，确保不会遗漏任何其他格式的链接。
 * - 修正了 normalizePanUrl 函数中的解码逻辑，使其更加健壮。
 * - 此版本逻辑清晰，针对性强，是解决此顽固问题的最终方案。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 26, // 版本号更新
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

// --- 详情页函数: v26 分治策略版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const $content = $('.topicContent');

        const addTrack = (panUrl, accessCode) => {
            const normalizedUrl = normalizePanUrl(panUrl);
            if (normalizedUrl && !uniqueLinks.has(normalizedUrl)) {
                tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
                uniqueLinks.add(normalizedUrl);
            }
        };

        // 步骤一：精确解析 <a> 标签
        $content.find('a').each((i, el) => {
            const $el = $(el);
            let href = $el.attr('href') || '';
            if (!href.includes('cloud.189.cn')) return;

            try { href = decodeURIComponent(href); } catch (e) {}
            const text = $el.text();
            const combined = href + ' ' + text;

            const urlMatch = combined.match(/https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+/);
            if (urlMatch) {
                const panUrl = urlMatch[0];
                const codeMatch = combined.match(/(?:访问码|密码|提取码|code)[\s:：]*?([a-zA-Z0-9]{4,6})/);
                const accessCode = codeMatch ? codeMatch[1] : '';
                addTrack(panUrl, accessCode);
            }
        });

        // 步骤二：精确解析纯文本节点
        const contentText = $content.text();
        const textPattern = /(https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+)[\s\S]{0,50}(?:访问码|密码|提取码|code)[\s:：]*?([a-zA-Z0-9]{4,6})/g;
        let match;
        while ((match = textPattern.exec(contentText)) !== null) {
            addTrack(match[1], match[2]);
        }

        // 步骤三：全局扫描作为补充
        const urlOnlyPattern = /https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+/g;
        while ((match = urlOnlyPattern.exec(contentText)) !== null) {
            const panUrl = match[0];
            if (!uniqueLinks.has(normalizePanUrl(panUrl))) {
                // 如果链接还没被添加，尝试在它附近找密码
                const searchArea = contentText.substring(match.index, match.index + panUrl.length + 50);
                const codeMatch = searchArea.match(/(?:访问码|密码|提取码|code)[\s:：]*?([a-zA-Z0-9]{4,6})/);
                const accessCode = codeMatch ? codeMatch[1] : '';
                addTrack(panUrl, accessCode);
            }
        }

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

function normalizePanUrl(url) {
    try {
        // 移除URL末尾可能存在的标点符号
        const cleanedUrl = url.replace(/[.,;!?)）】]+$/, '');
        const urlObj = new URL(cleanedUrl);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+/);
        return match ? match[0].toLowerCase() : url.toLowerCase();
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
