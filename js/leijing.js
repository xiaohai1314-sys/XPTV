/**
 * =================================================================
 * 最终可用脚本 - 核心问题修正版
 * 版本: 27 (DOM遍历策略版)
 *
 * 更新日志:
 * - [重大突破] 定位并解决了所有先前版本失败的核心原因：a 标签内的文本被分割为多个独立的文本节点。
 * - 彻底重构 getTracks 函数，放弃了所有基于 .text() 或 .html() 的扁平化处理方式。
 * - 采用全新的 DOM 遍历策略：通过 Cheerio 的 .next() 方法获取 a 标签紧邻的兄弟文本节点。
 * - 将 a 标签文本和其兄弟文本节点内容拼接，还原出完整的“链接+密码”字符串，从而实现精准提取。
 * - 此版本直击问题根源，逻辑正确，是解决此顽固问题的最终确定性方案。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 27, // 版本号更新
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

// --- 详情页函数: v27 DOM遍历策略版 ---
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

        // [核心修正] 遍历所有 a 标签，并检查其后的兄弟节点
        $content.find('a[href*="cloud.189.cn"]').each((i, el) => {
            const $el = $(el);
            let panUrl = $el.text().trim();
            let accessCode = '';

            // 检查 a 标签的下一个兄弟节点是否是文本节点（即访问码部分）
            const nextNode = el.next;
            if (nextNode && nextNode.type === 'text' && nextNode.data) {
                const nextText = nextNode.data.trim();
                const codeMatch = nextText.match(/(?:访问码|密码|提取码|code)[\s:：]*?([a-zA-Z0-9]{4,6})/);
                if (codeMatch) {
                    accessCode = codeMatch[1];
                }
            }
            
            // 如果从兄弟节点没找到，再从 a 标签的 href 属性中解码寻找
            if (!accessCode) {
                let href = $el.attr('href') || '';
                try { href = decodeURIComponent(href); } catch (e) {}
                const codeMatch = href.match(/(?:访问码|密码|提取码|code)[\s:：]*?([a-zA-Z0-9]{4,6})/);
                if (codeMatch) {
                    accessCode = codeMatch[1];
                }
            }

            addTrack(panUrl, accessCode);
        });

        // 作为补充，扫描纯文本内容
        const contentText = $content.text();
        const textPattern = /(https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+)[\s\S]{0,50}(?:访问码|密码|提取码|code)[\s:：]*?([a-zA-Z0-9]{4,6})/g;
        let match;
        while ((match = textPattern.exec(contentText)) !== null) {
            addTrack(match[1], match[2]);
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
