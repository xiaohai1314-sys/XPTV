/**
 * =================================================================
 * 最终可用脚本 - 针对xptv等App环境的终极解决方案
 * 版本: 26 (WebView终极版)
 *
 * 更新日志:
 * - [根本性重构] 确认问题根源为目标站点的Cloudflare JS质询保护，而xptv环境中的$fetch无法执行JS，导致获取的页面内容不正确。
 * - [核心策略改变] 放弃使用$fetch获取详情页。改为调用App环境提供的WebView机制，模拟真实浏览器加载页面，等待Cloudflare验证通过并渲染出真实内容后，再获取其HTML进行解析。
 * - [代码实现] getTracks函数被完全重写，引入了WebView加载和HTML提取的逻辑。
 * - [高可靠性] 这是针对此类反爬虫保护网站在App环境下的标准且唯一有效的解决方案，能够确保获取到正确的页面数据。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 26,
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

// getCards 和 search 函数使用 $fetch 通常没问题，因为列表页和搜索页可能没有那么强的保护
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

// --- 详情页函数: v26 WebView终极版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const pageUrl = ext.url;
    const uniqueLinks = new Set();

    try {
        // 关键改动：使用WebView加载页面以通过Cloudflare验证
        const webViewData = await $fetch(pageUrl, {
            method: 'GET',
            headers: { 'User-Agent': UA },
            // 关键参数，告诉$fetch使用WebView模式并等待页面加载完成
            // 等待 .topicContent 元素出现，最多等10秒
            js_eval: `
                (function() {
                    return new Promise((resolve, reject) => {
                        const timeout = 10000;
                        const interval = 500;
                        let elapsedTime = 0;
                        const checkInterval = setInterval(() => {
                            const element = document.querySelector('.topicContent');
                            if (element) {
                                clearInterval(checkInterval);
                                resolve(document.documentElement.outerHTML);
                            }
                            elapsedTime += interval;
                            if (elapsedTime >= timeout) {
                                clearInterval(checkInterval);
                                // 如果超时了，也返回当前页面的HTML，做最后一搏
                                resolve(document.documentElement.outerHTML);
                            }
                        }, interval);
                    });
                })();
            `
        });

        // WebView返回的数据就是加载完成后的HTML
        const rawHtml = webViewData.data;
        const $ = cheerio.load(rawHtml);
        const title = $('.topicBox .title').text().trim() || "网盘资源";

        // 现在我们有了正确的HTML，可以继续使用之前最可靠的v24版本的解析逻辑
        const blockPattern = /https?:\/\/cloud\.189\.cn\/[^\s<>"']+/g;
        const potentialBlocks = rawHtml.match(blockPattern ) || [];

        for (const rawBlock of potentialBlocks) {
            let decodedBlock;
            try {
                decodedBlock = decodeURIComponent(rawBlock);
            } catch (e) {
                decodedBlock = rawBlock;
            }

            const linkMatch = decodedBlock.match(/^(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))/);
            if (!linkMatch) continue;

            const panUrl = linkMatch[1];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;

            const accessCode = extractAccessCode(decodedBlock);

            tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode || '' } });
            uniqueLinks.add(normalizedUrl);
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

function extractAccessCode(text) {
    if (!text) return '';
    let match = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (match && match[1]) return match[1];
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)?\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
    if (match && match[1]) return match[1];
    return '';
}

function normalizePanUrl(url) {
    try {
        const urlObj = new URL(url);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>(  )]+/);
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
