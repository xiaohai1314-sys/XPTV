/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v21 最终修正版 (已严格自查)
 *
 * 最终修正说明:
 * - appConfig, getCards, search 函数已严格恢复至v21原版，确保脚本能被正确加载和执行。
 * - getTracks函数在v21原版三层策略结构上，仅增加去重和HTTPS转换。
 * - 严格保证只修正已知问题，不再有任何未经您同意的额外修改。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// appConfig 与 v21 原版完全一致
const appConfig = {
  ver: 21,
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

async function getConfig( ) {
  return jsonify(appConfig);
}

// getCards 函数与 v21 原版完全一致，确保列表显示
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
  return jsonify({ urls: [] });
}

// 辅助函数：从可能包含杂质的字符串中提取纯净URL
function extractCleanUrl(rawUrl) {
    if (!rawUrl) return null;
    const match = rawUrl.match(/https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/ );
    return match ? match[0] : null;
}

async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);
        
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        
        const bodyText = $('body').text();

        let globalAccessCode = '';
        const globalCodeMatch = bodyText.match(/(?:通用|访问|提取|解压)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        // --- 策略一：精准匹配 (在v21原版基础上修正) ---
        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let cleanPan = match[1].replace('http://', 'https://' );
            if (uniqueLinks.has(cleanPan)) continue;

            tracks.push({ name: pageTitle, pan: cleanPan, ext: { accessCode: match[3] } });
            uniqueLinks.add(cleanPan);
        }

        // --- 策略二：<a>标签扫描 (在v21原版基础上修正) ---
        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            
            const cleanPanRaw = extractCleanUrl(href);
            if (!cleanPanRaw) return;
            
            let cleanPan = cleanPanRaw.replace('http://', 'https://' );
            if (uniqueLinks.has(cleanPan)) return;

            const searchContext = href + " " + $el.parent().text();
            const codeMatch = searchContext.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
            const accessCode = codeMatch ? codeMatch[1] : globalAccessCode;
            
            let trackName = $el.text().trim();
            if (trackName.startsWith('http' ) || trackName === '') {
                trackName = pageTitle;
            }

            tracks.push({ name: trackName, pan: cleanPan, ext: { accessCode } });
            uniqueLinks.add(cleanPan);
        });

        // --- 策略三：纯文本URL扫描 (在v21原版基础上修正) ---
        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText )) !== null) {
            let cleanPan = match[0].replace('http://', 'https://' );
            if (uniqueLinks.has(cleanPan)) continue;

            const searchArea = bodyText.substring(Math.max(0, match.index - 50), match.index + cleanPan.length + 50);
            const codeMatch = searchArea.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
            const accessCode = codeMatch ? codeMatch[1] : globalAccessCode;

            tracks.push({ name: pageTitle, pan: cleanPan, ext: { accessCode } });
            uniqueLinks.add(cleanPan);
        }

        return tracks.length
            ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
            : jsonify({ list: [] });

    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: '加载失败', pan: 'about:blank', ext: { accessCode: '' } }]
            }]
        });
    }
}

// search 函数与 v21 原版完全一致
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  $('.topicItem').each((_, el) => {
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $(el).find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
