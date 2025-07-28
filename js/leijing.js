/**
 * =================================================================
 * 返璞归真版 (Back to Basics)
 * 版本: 33.0
 *
 * 更新日志:
 * - [拨乱反正] 彻底抛弃参考脚本中修改标题的逻辑，回归用户最初的、功能完好的 getCards 和 search 函数。
 * - [getTracks] 采用从参考脚本中学到的、最有效的“裸文本”提取策略，并修正其输出，专门用于解决特例。
 * - [兼容并包] 同时保留了用户原始脚本中的其他提取方式，以确保最大兼容性。
 * - 本脚本旨在成为一个列表功能100%正常，且能完美处理特例的最终版本。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 33.0,
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

// [回归本源] 使用您最初的、功能完好的 getCards 函数
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

// [最终方案] 融合所有有效策略
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const unique = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || '网盘资源';
        let m;

        // --- 策略1：裸文本提取 (来自参考脚本，已修正) ---
        const contentText = $('.topicContent').text();
        const naked = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))[^（]*（访问码[:：\s]*([a-zA-Z0-9]{4,6})）/gi;
        while ((m = naked.exec(contentText)) !== null) {
            const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
            if (!unique.has(panUrl )) {
                const correctedCode = m[3].replace('）', '');
                tracks.push({ name: title, pan: panUrl, ext: { accessCode: correctedCode } });
                unique.add(panUrl);
            }
        }

        // --- 策略2：精准组合提取 (来自原始脚本) ---
        const precise = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        while ((m = precise.exec(data)) !== null) {
            const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
            if (!unique.has(panUrl )) {
                tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
                unique.add(panUrl);
            }
        }

        // --- 策略3：<a>标签提取 (来自原始脚本) ---
        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href || unique.has(href)) return;
            const ctx = $(el).parent().text();
            const code = /(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i.exec(ctx);
            if (!unique.has(href)) {
                tracks.push({ name: $(el).text().trim() || title, pan: href, ext: { accessCode: code ? code[1] : '' } });
                unique.add(href);
            }
        });

        return tracks.length
            ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
            : jsonify({ list: [] });

    } catch (e) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '加载失败', pan: 'about:blank', ext: { accessCode: '' } }] }] });
    }
}

// [回归本源] 使用您最初的、功能完好的 search 函数
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
