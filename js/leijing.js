/**
 * =================================================================
 * 最终修正版 - 严格遵循参考，仅清理结果
 * 版本: 31.0 (The Faithful Fix)
 *
 * 更新日志:
 * - 彻底放弃所有我自己的复杂逻辑，回归本源。
 * - [getTracks] 函数的逻辑，完全、逐字地基于用户提供的、被证实“能识别”的参考脚本。
 * - [关键修正] 完全保留参考脚本中能成功识别的正则表达式，不做任何改动。
 * - 在提取出带括号的访问码后，通过一次简单的字符串清理 (.replace)，确保最终结果的正确性，以解决“无法跳转”的问题。
 * - 这是对您提供的有效线索的最忠实实现，旨在直接解决问题。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 31.0,
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

// 严格使用您原始脚本的版本
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

// [最终修正] 严格遵循参考脚本逻辑，仅清理输出结果
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

        // --- 策略1：精准组合提取 (来自参考脚本) ---
        const precise = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        while ((m = precise.exec(data)) !== null) {
            const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
            if (!unique.has(panUrl )) {
                tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
                unique.add(panUrl);
            }
        }

        // --- 策略2：<a>标签提取 (来自参考脚本) ---
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

        // --- 策略3：裸文本 + 中文括号特例 (来自参考脚本，仅修正输出) ---
        // [关键] 严格保留能成功识别的正则表达式，一个字符都不改
        const naked = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))[^（]*（访问码[:：\s]*([a-zA-Z0-9]{4,6}）)/gi;
        while ((m = naked.exec($('.topicContent').text())) !== null) {
            const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
            if (!unique.has(panUrl )) {
                // [关键] 在这里对提取出的、带括号的访问码 m[3] 进行无害化清理
                const correctedCode = m[3].replace(/）/g, '');
                tracks.push({ name: title, pan: panUrl, ext: { accessCode: correctedCode } });
                unique.add(panUrl);
            }
        }

        return tracks.length
            ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
            : jsonify({ list: [] });

    } catch (e) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '加载失败', pan: 'about:blank', ext: { accessCode: '' } }] }] });
    }
}

// 严格使用您原始脚本的版本
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
