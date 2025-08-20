/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v27+TMDB 完整整合版
 *
 * 功能增强:
 * - 列表页/搜索页：调用 TMDB API 获取海报。
 * - 详情页(getTracks)：同样调用 TMDB API，避免页面空白。
 * - 保持 v27 原版分类结构与资源提取策略不变。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// 🔑 这里替换为你的 TMDB API Key
const TMDB_API_KEY = "替换为你的TMDB_API_KEY"; 

// TMDB 查询函数
async function fetchPosterFromTMDB(title) {
    try {
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=zh-CN`;
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        if (data && data.results && data.results.length > 0) {
            const posterPath = data.results[0].poster_path;
            if (posterPath) {
                return "https://image.tmdb.org/t/p/w500" + posterPath;
            }
        }
    } catch (e) {
        console.error("TMDB 查询失败:", e);
    }
    return "";
}

// appConfig 与 v21 原版完全一致
const appConfig = {
  ver: 27,
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

// getCards 保持 v21 逻辑，只加了 TMDB poster
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
  const $ = cheerio.load(data);
  for (const each of $('.topicItem').toArray()) {
    if ($(each).find('.cms-lock-solid').length > 0) continue;
    const href = $(each).find('h2 a').attr('href');
    const title = $(each).find('h2 a').text();
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
    if (/content/.test(r) && !/cloud/.test(r)) continue;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) continue;

    // 🔑 获取 TMDB 海报
    const poster = await fetchPosterFromTMDB(dramaName);

    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: poster,
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    });
  }
  return jsonify({ list: cards });
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

// 协议无关的去重函数
function getProtocolAgnosticUrl(rawUrl) {
    if (!rawUrl) return null;
    const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
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

        // 🔑 获取详情页 TMDB 海报
        const poster = await fetchPosterFromTMDB(pageTitle);

        const bodyText = $('body').text();

        // --- 策略一：精准匹配 ---
        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, pic: poster, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }

        // --- 策略二：<a>标签扫描 ---
        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const $el = $(el);
            let href = $el.attr('href');
            if (!href) return;
            
            let agnosticUrl = getProtocolAgnosticUrl(href);
            if (!agnosticUrl || uniqueLinks.has(agnosticUrl)) return;

            href = href.replace('http://', 'https://' );

            let trackName = $el.text().trim();
            if (trackName.startsWith('http' ) || trackName === '') {
                trackName = pageTitle;
            }

            tracks.push({ name: trackName, pan: href, pic: poster, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });

        // --- 策略三：纯文本URL扫描 ---
        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText )) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, pic: poster, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }

        return tracks.length
            ? jsonify({ list: [{ title: '天翼云盘', pic: poster, tracks }] })
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

// search 保持 v21 逻辑，只加了 TMDB poster
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  for (const el of $('.topicItem').toArray()) {
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $(el).find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) continue;

    // 🔑 TMDB 查询封面
    const poster = await fetchPosterFromTMDB(title);

    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: poster,
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  }
  return jsonify({ list: cards });
}
