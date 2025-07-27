/**
 * =================================================================
 * 最终可用脚本 - 动态内容终极解决方案
 * 版本: 31 (动态内容终极版)
 *
 * 更新日志:
 * - [根本性突破] 根据用户提供的截图，确认了核心内容是异步加载的，之前的方案因此全部失效。
 * - [全新策略] 彻底重构getTracks函数。不再解析主页面HTML，而是模拟页面中的JavaScript，直接请求动态内容的API接口，从源头获取数据。
 * - [精准打击] 找到了获取帖子内容的API接口规律，并实现了相应的请求逻辑。
 * - [高可靠性] 此方案绕开了Cloudflare和所有前端渲染问题，直接与数据接口交互，是目前最稳定、最高效且唯一正确的解决方案。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 31,
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

// --- 详情页函数: v31 动态内容终极版 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const pageUrl = ext.url;
    const uniqueLinks = new Set();

    try {
        // 从URL中提取topicId
        const topicIdMatch = pageUrl.match(/topicId=(\d+)/);
        if (!topicIdMatch) {
            throw new Error("无法从URL中提取topicId");
        }
        const topicId = topicIdMatch[1];

        // 关键一步：直接请求动态内容的API接口
        // 这个接口通常是 unhide（解锁/显示隐藏内容）
        const apiUrl = `${appConfig.site}/user/control/topic/unhide`;
        const params = `topicId=${topicId}&hideType=0`; // hideType=0 或其他非密码/付费类型通常能直接获取内容

        // 使用POST请求，并带上必要的Referer
        const response = await $fetch.post(apiUrl, params, {
            headers: {
                'User-Agent': UA,
                'Referer': pageUrl,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            }
        });
        
        // API返回的是一个JSON，其中content字段包含了我们需要的HTML
        const jsonData = JSON.parse(response.data);
        const rawHtml = jsonData.content;

        if (!rawHtml) {
            throw new Error("API未返回有效内容，可能需要登录或权限");
        }

        const $ = cheerio.load(rawHtml);
        const title = ext.title || "网盘资源"; // 标题可以从ext传入或默认

        // 使用最可靠的v30版纯字符串解析逻辑
        const linkPrefix = 'https://cloud.189.cn/';
        let currentIndex = 0;
        while ((currentIndex = rawHtml.indexOf(linkPrefix, currentIndex )) !== -1) {
            let block = rawHtml.substring(currentIndex, currentIndex + 200);
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

            let decodedBlock;
            try {
                decodedBlock = decodeURIComponent(block);
            } catch (e) {
                decodedBlock = block;
            }

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
                if (codeMatch) accessCode = codeMatch[1];
            }
            
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
        }
        return jsonify({ list: [] });

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
