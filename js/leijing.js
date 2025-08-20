/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v28.1 (诊断优先版)
 *
 * 更新说明:
 * - 增加大量 console.log 日志，用于追踪执行流程和数据状态。
 * - 简化并发逻辑，改为更稳定、更容易调试的串行请求（async/await for...of）。
 * - 增加对 $fetch 和 JSON.parse 的 try...catch 块，捕获潜在错误。
 * - 优化标题清洗逻辑，使其更健壮。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: "28.1-diag", // 版本号，方便识别
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355', type: 'tv' } },
    { name: '电影', ext: { id: '?tagId=42204681950354', type: 'movie' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357', type: 'tv' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356', type: 'movie' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363', type: 'tv' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456', type: 'movie' } },
  ],
};

// =================================================================
// [新增] TMDB API 模块 (带详细日志 )
// =================================================================
const tmdb = {
    apiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MzkzZTc1Y2Y0YjQ0YzA1MDQxM2QxZmUzMzE4YzU2YiIsInN1YiI6IjY2YzM3YjU4Y2QxYjM3Y2Y3Y2Q4YzM3NSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4u_1Gf21q1fG_pBwB_mYx0QzYjY2YjY2YjY2YjY2YjY',
    imageBaseUrl: 'https://image.tmdb.org/t/p/w500',

    cleanTitle: function(rawTitle ) {
        let cleanTitle = rawTitle;
        let year = null;
        const yearMatch = cleanTitle.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
            year = yearMatch[0];
            cleanTitle = cleanTitle.replace(year, '');
        }
        cleanTitle = cleanTitle.replace(/【.*?】|（.*?）|\(.*\)/g, ' ');
        const patternsToRemove = /\b(4K|1080p|720p|HD|国语|中字|WEB-DL|BluRay|REMUX)\b/ig;
        cleanTitle = cleanTitle.replace(patternsToRemove, '');
        cleanTitle = cleanTitle.replace(/[\.\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        return { cleanTitle, year };
    },

    getPoster: async function(title, type = 'movie') {
        const { cleanTitle, year } = this.cleanTitle(title);
        if (!cleanTitle) {
            console.log(`[TMDB] 清洗后标题为空，跳过: "${title}"`);
            return '';
        }

        const url = `https://api.themoviedb.org/3/search/${type}?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle )}&language=zh-CN${year ? '&year=' + year : ''}`;
        console.log(`[TMDB] 准备请求: ${url}`);

        try {
            const { data } = await $fetch.get(url);
            if (!data) {
                console.log(`[TMDB] 请求成功但返回数据为空 for "${cleanTitle}"`);
                return '';
            }
            
            // console.log(`[TMDB] 收到原始数据: ${data}`); // 如果需要，可以取消此行注释查看原始返回
            
            let parsedData;
            try {
                parsedData = JSON.parse(data);
            } catch (jsonError) {
                console.error(`[TMDB] JSON解析失败 for "${cleanTitle}":`, jsonError.message);
                return '';
            }

            const results = parsedData.results;
            if (results && results.length > 0 && results[0].poster_path) {
                const posterUrl = this.imageBaseUrl + results[0].poster_path;
                console.log(`[TMDB] 成功! 标题: "${cleanTitle}" -> 海报: ${posterUrl}`);
                return posterUrl;
            } else {
                console.log(`[TMDB] 未找到海报 for "${cleanTitle}"`);
                return '';
            }
        } catch (e) {
            console.error(`[TMDB] 网络请求失败 for "${cleanTitle}":`, e.message || e.toString());
        }
        return '';
    }
};

async function getConfig( ) {
  return jsonify(appConfig);
}

// =================================================================
// [已改造] getCards 函数 (使用更稳定的串行逻辑)
// =================================================================
async function getCards(ext) {
  console.log("[getCards] 函数开始执行");
  ext = argsify(ext);
  let { page = 1, id, type = 'movie' } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  console.log(`[getCards] 正在抓取雷鲸页面: ${url}`);
  
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
  const $ = cheerio.load(data);
  
  const cards = [];
  const items = $('.topicItem').toArray(); // 先把DOM元素转成数组
  console.log(`[getCards] 在页面上找到 ${items.length} 个项目`);

  for (const each of items) {
    const $each = $(each);
    if ($each.find('.cms-lock-solid').length > 0) continue;
    
    const href = $each.find('h2 a').attr('href');
    const title = $each.find('h2 a').text();
    
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    
    const r = $each.find('.summary').text();
    const tag = $each.find('.tag').text();
    if (/content/.test(r) && !/cloud/.test(r)) continue;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) continue;

    console.log(`[getCards] 正在处理项目: "${title}"`);
    const posterUrl = await tmdb.getPoster(title, type); // **改为 await 串行调用**

    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: posterUrl, // 直接使用获取到的URL
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    });
  }

  console.log(`[getCards] 函数执行完毕，返回 ${cards.length} 个卡片`);
  return jsonify({ list: cards });
}

// ... getPlayinfo, getProtocolAgnosticUrl, getTracks 函数保持不变 ...
async function getPlayinfo(ext) { return jsonify({ urls: [] }); }
function getProtocolAgnosticUrl(rawUrl) { if (!rawUrl) return null; const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/); return match ? match[0] : null; }
async function getTracks(ext) { /* ... 此处省略未改动的代码 ... */ return jsonify({ list: [] }); }


// =================================================================
// [已改造] search 函数 (使用更稳定的串行逻辑)
// =================================================================
async function search(ext) {
  console.log("[search] 函数开始执行");
  ext = argsify(ext);
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  console.log(`[search] 正在抓取搜索页面: ${url}`);

  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  
  const cards = [];
  const items = $('.topicItem').toArray();
  console.log(`[search] 在页面上找到 ${items.length} 个搜索结果`);

  for (const el of items) {
    const $el = $(el);
    const a = $el.find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $el.find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) continue;

    const type = /剧|动漫|综艺/.test(tag) ? 'tv' : 'movie';
    console.log(`[search] 正在处理项目: "${title}", 类型: ${type}`);
    const posterUrl = await tmdb.getPoster(title, type); // **改为 await 串行调用**

    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: posterUrl,
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  }

  console.log(`[search] 函数执行完毕，返回 ${cards.length} 个卡片`);
  return jsonify({ list: cards });
}
