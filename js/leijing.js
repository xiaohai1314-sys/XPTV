/**
 * =================================================================
 * 最终可用脚本 - 纯字符串操作终极版
 * 版本: 30 (纯字符串终极版)
 *
 * 更新日志:
 * - [根本性重构] 接受了之前所有正则方案在用户真实环境中失败的现实。
 * - [全新策略] 彻底放弃复杂的正则表达式，改用最原始、最可靠、兼容性最高的纯字符串查找和分割方法来提取链接和密码。
 * - [高可靠性] 该方法不依赖任何模式匹配引擎的细微差异，只进行基础的文本操作，能最大限度地避免环境差异导致的问题。
 * - [安全稳定] 完全移除了所有可能导致崩溃的WebView代码，确保脚本基本功能稳定运行。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 30,
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

// --- 详情页函数: v30 纯字符串终极版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const pageUrl = ext.url;
    const uniqueLinks = new Set();

    try {
        const response = await $fetch.get(pageUrl, { headers: { 'User-Agent': UA } });
        const rawHtml = response.data;

        const $ = cheerio.load(rawHtml);
        const title = $('.topicBox .title').text().trim() || "网盘资源";

        const linkPrefix = 'https://cloud.189.cn/';
        let currentIndex = 0;

        // 循环查找所有链接起点
        while ((currentIndex = rawHtml.indexOf(linkPrefix, currentIndex )) !== -1) {
            // 截取链接后的200个字符，足够长
            let block = rawHtml.substring(currentIndex, currentIndex + 200);
            
            // 清理掉块末尾的无关字符
            const endChars = ['"', "'", '<', ' '];
            let firstEndIndex = -1;
            for(const char of endChars) {
                const endIndex = block.indexOf(char);
                if (endIndex !== -1 && (firstEndIndex === -1 || endIndex < firstEndIndex)) {
                    firstEndIndex = endIndex;
                }
            }
            if (firstEndIndex !== -1) {
                block = block.substring(0, firstEndIndex);
            }

            // 解码
            let decodedBlock;
            try {
                decodedBlock = decodeURIComponent(block);
            } catch (e) {
                decodedBlock = block;
            }

            // 提取URL和访问码
            let panUrl = decodedBlock;
            let accessCode = '';

            const codeKeywords = ['访问码', '密码', '提取码'];
            let codeIndex = -1;
            for(const keyword of codeKeywords) {
                const index = decodedBlock.indexOf(keyword);
                if (index !== -1) {
                    codeIndex = index;
                    break;
                }
            }

            if (codeIndex !== -1) {
                panUrl = decodedBlock.substring(0, codeIndex).replace(/[（(]$/, '').trim();
                const codePart = decodedBlock.substring(codeIndex);
                const codeMatch = codePart.match(/([a-zA-Z0-9]{4,6})/);
                if (codeMatch) {
                    accessCode = codeMatch[1];
                }
            }
            
            // 验证URL是否合法
            if (!panUrl.startsWith(linkPrefix)) continue;

            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) {
                currentIndex++;
                continue;
            }

            tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode || '' } });
            uniqueLinks.add(normalizedUrl);
            
            currentIndex += linkPrefix.length;
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
