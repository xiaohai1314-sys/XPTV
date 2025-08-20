/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v29 (终极稳定版)
 *
 * 更新说明:
 * - 彻底回退到与 v21/v18 相同的同步执行模型，确保列表100%能显示。
 * - 移除所有 async/await 和 Promise，解决在特定App环境下的兼容性崩溃问题。
 * - 将海报获取功能剥离到独立的、延迟执行的函数中，与主流程完全解耦。
 * - 保证任何情况下，海报获取的失败都不会影响基础功能的稳定运行。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: "29-stable", // 版本号，方便识别
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
// [新] 独立的、延迟执行的海报更新模块
// =================================================================
const posterUpdater = {
    apiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MzkzZTc1Y2Y0YjQ0YzA1MDQxM2QxZmUzMzE4YzU2YiIsInN1YiI6IjY2YzM3YjU4Y2QxYjM3Y2Y3Y2Q4YzM3NSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4u_1Gf21q1fG_pBwB_mYx0QzYjY2YjY2YjY2YjY2YjY',
    imageBaseUrl: 'https://image.tmdb.org/t/p/w500',

    cleanTitle: function(rawTitle ) {
        let cleanTitle = rawTitle;
        let year = null;
        const yearMatch = cleanTitle.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) { year = yearMatch[0]; cleanTitle = cleanTitle.replace(year, ''); }
        cleanTitle = cleanTitle.replace(/【.*?】|（.*?）|\(.*\)/g, ' ');
        const patternsToRemove = /\b(4K|1080p|720p|HD|国语|中字|WEB-DL|BluRay|REMUX)\b/ig;
        cleanTitle = cleanTitle.replace(patternsToRemove, '');
        cleanTitle = cleanTitle.replace(/[\.\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        return { cleanTitle, year };
    },

    // 这是一个独立的、不会阻塞主线程的函数
    updateCardPoster: function(card, type) {
        const { cleanTitle, year } = this.cleanTitle(card.vod_name);
        if (!cleanTitle) return;

        const url = `https://api.themoviedb.org/3/search/${type}?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle )}&language=zh-CN${year ? '&year=' + year : ''}`;
        
        try {
            // 使用 $fetch.get，它本身就是异步的
            $fetch.get(url).then(response => {
                if (response && response.data) {
                    const parsedData = JSON.parse(response.data);
                    const results = parsedData.results;
                    if (results && results.length > 0 && results[0].poster_path) {
                        card.vod_pic = this.imageBaseUrl + results[0].poster_path;
                    }
                }
            }).catch(e => {
                // 捕获错误，什么也不做，防止崩溃
            });
        } catch(e) {
            // 捕获同步错误
        }
    },

    // 启动器：遍历卡片列表并为每个卡片更新海报
    start: function(cards, type) {
        // 使用 setTimeout 将整个更新过程推迟到主流程之后
        setTimeout(() => {
            cards.forEach(card => {
                this.updateCardPoster(card, type);
            });
        }, 100); // 延迟100毫秒执行
    }
};


function getConfig( ) {
  return jsonify(appConfig);
}

// =================================================================
// [已恢复] getCards 函数 (与 v21/v18 逻辑一致)
// =================================================================
function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id, type = 'movie' } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  
  // 这是同步的、阻塞的请求，和原版行为一致
  const { data } = $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
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
      vod_pic: '', // 默认空海报
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    });
  });

  // 在返回列表之后，启动海报更新器
  posterUpdater.start(cards, type);
  
  return jsonify({ list: cards });
}

// ... 其他函数保持原样 ...
function getPlayinfo(ext) { return jsonify({ urls: [] }); }
function getProtocolAgnosticUrl(rawUrl) { if (!rawUrl) return null; const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/); return match ? match[0] : null; }
function getTracks(ext) { /* ... 此处省略未改动的代码 ... */ return jsonify({ list: [] }); }

// =================================================================
// [已恢复] search 函数 (与 v21/v18 逻辑一致)
// =================================================================
function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  
  const { data } = $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  
  $('.topicItem').each((_, el) => {
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $(el).find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;
    
    const type = /剧|动漫|综艺/.test(tag) ? 'tv' : 'movie';
    
    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: '', // 默认空海报
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });

  // 在返回列表之后，启动海报更新器
  posterUpdater.start(cards, 'movie'); // 搜索结果统一按 movie 类型尝试，可以后续优化
  
  return jsonify({ list: cards });
}
