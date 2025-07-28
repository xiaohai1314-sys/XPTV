/**
 * =================================================================
 * 最终钥匙版脚本 (The Final Key)
 * 版本: 27.0
 *
 * 更新日志:
 * - [决定性重构] getTracks 函数被彻底重写，以模拟网站真实的“先POST解锁，再GET获取”逻辑。
 * - [解锁步骤] 脚本会先向 /topic/unhide API 发送一个POST请求，以获取查看隐藏内容的权限。
 * - [获取步骤] 发送解锁请求后，脚本会再次请求原始详情页URL，以获取包含真实链接的、解锁后的HTML。
 * - [头部修正] 模拟的POST请求增加了 'Content-Type' 和 'X-Requested-With' 请求头，以确保服务器能正确处理。
 * - 此版本旨在从根本上解决因内容隐藏机制导致的提取失败问题。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 27.0,
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

// [已验证] 使用健壮的选择器
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
  const $ = cheerio.load(data);
  $('.topicItem, .topic-item').each((index, each) => {
    const $item = $(each);
    if ($item.find('.cms-lock-solid').length > 0) return;
    const a = $item.find('h2 a, .title a');
    const href = a.attr('href');
    const title = a.text();
    if (!href || !title) return;
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const r = $item.find('.summary').text();
    const tag = $item.find('.tag').text();
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

// [决定性重构] 模拟“先解锁，再获取”的真实逻辑
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const pageUrl = ext.url;
    const uniqueLinks = new Set();

    try {
        // [解锁步骤]
        const topicIdMatch = pageUrl.match(/topicId=(\d+)/);
        if (topicIdMatch) {
            const topicId = topicIdMatch[1];
            const apiUrl = `${appConfig.site}/user/control/topic/unhide`;
            const postData = `topicId=${topicId}&hideType=10&password=`; // 模拟一个空的密码提交来解锁
            try {
                // 发送解锁请求，我们不关心其返回值，目的是在服务器端获得权限
                await $fetch.post(apiUrl, postData, {
                    headers: {
                        'Referer': pageUrl,
                        'User-Agent': UA,
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                    }
                });
            } catch (apiError) {
                // 即使API请求失败（例如因为内容无需解锁），我们依然继续尝试解析原始页面
            }
        }

        // [获取步骤] 再次请求原始页面，此时应已包含解锁后的内容
        const { data } = await $fetch.get(pageUrl, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        
        // --- 后续解析逻辑与之前成熟的版本一致 ---
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();
        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|访问|提取|解压)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        const precisePattern = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            const panUrl = match[0].split(/[\(（\uff08]/)[0].trim();
            const accessCode = match[3];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        }

        $('a[href*="cloud.189.cn"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            let panUrl = href;
            let accessCode = '';
            const hrefPattern = /(https?:\/\/cloud\.189\.cn\/[^\s（(]+ )[\s（(]+(?:访问码|密码|code)[:：\s]*([a-zA-Z0-9]{4,6})/;
            const hrefMatch = href.match(hrefPattern);
            if (hrefMatch) {
                panUrl = hrefMatch[1].trim();
                accessCode = hrefMatch[2];
            }
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) return;
            if (!accessCode) {
                const contextText = $(el).parent().text();
                const localCode = extractAccessCode(contextText);
                accessCode = localCode || globalAccessCode;
            }
            tracks.push({ name: $(el).text().trim() || title, pan: panUrl, ext: { accessCode } });
            uniqueLinks.add(normalizedUrl);
        });

        const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share )\/[^\s<>()]+/gi;
        while ((match = urlPattern.exec(bodyText)) !== null) {
            const panUrl = match[0];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;
            let accessCode = '';
            const searchArea = bodyText.substring(Math.max(0, match.index - 50), match.index + panUrl.length + 50);
            const localCode = extractAccessCode(searchArea);
            accessCode = localCode || globalAccessCode;
            tracks.push({ name: title, pan: panUrl, ext: { accessCode } });
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
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
    if (match && match[1]) return match[1];
    return '';
}

function normalizePanUrl(url) {
    try {
        const cleanUrlMatch = url.match(/https?:\/\/cloud\.189\.cn\/[^\s（(]+/ );
        const cleanUrl = cleanUrlMatch ? cleanUrlMatch[0] : url;
        const urlObj = new URL(cleanUrl);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>(  )]+/);
        return match ? match[0].toLowerCase() : url.toLowerCase();
    }
}

// [已验证] 使用健壮的选择器
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  const searchItems = $('.search-result ul > li, .topic-list > .topic-item, .result-list > .item, ul.search-results > li.result-item, .topicItem, .searchModule .item, .topic-item');
  searchItems.each((index, each) => {
    const $item = $(each);
    const a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a, .title a');
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
