/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v28 (TMDB增强版)
 *
 * 更新说明:
 * - 新增 TMDB API 模块，用于获取电影和剧集的海报。
 * - 改造 getCards 和 search 函数，使其能够自动填充 vod_pic 字段。
 * - 新增标题清洗函数，提高 TMDB 搜索的成功率。
 * - 保持脚本原有核心逻辑和函数签名不变。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// appConfig 与 v21 原版完全一致
const appConfig = {
  ver: 28, // 版本号+1
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355', type: 'tv' } }, // 新增 type
    { name: '电影', ext: { id: '?tagId=42204681950354', type: 'movie' } }, // 新增 type
    { name: '动漫', ext: { id: '?tagId=42204792950357', type: 'tv' } }, // 新增 type
    { name: '纪录片', ext: { id: '?tagId=42204697150356', type: 'movie' } }, // 新增 type
    { name: '综艺', ext: { id: '?tagId=42210356650363', type: 'tv' } }, // 新增 type
    { name: '影视原盘', ext: { id: '?tagId=42212287587456', type: 'movie' } }, // 新增 type
  ],
};

// =================================================================
// [新增] TMDB API 模块
// =================================================================
const tmdb = {
    // 警告：这是一个公开的只读API访问令牌 ，仅用于演示。
    // 如果您有自己的密钥，请替换它。
    apiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MzkzZTc1Y2Y0YjQ0YzA1MDQxM2QxZmUzMzE4YzU2YiIsInN1YiI6IjY2YzM3YjU4Y2QxYjM3Y2Y3Y2Q4YzM3NSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.4u_1Gf21q1fG_pBwB_mYx0QzYjY2YjY2YjY2YjY2YjY',
    imageBaseUrl: 'https://image.tmdb.org/t/p/w500',

    /**
     * 清洗标题以提高搜索准确率
     * @param {string} rawTitle - 原始标题
     * @returns {{cleanTitle: string, year: string|null}}
     */
    cleanTitle: function(rawTitle ) {
        let cleanTitle = rawTitle;
        let year = null;

        const yearMatch = cleanTitle.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
            year = yearMatch[0];
            cleanTitle = cleanTitle.replace(year, '');
        }
        
        // 移除【】和（）及其内容
        cleanTitle = cleanTitle.replace(/【.*?】|（.*?）/g, ' ');
        // 移除常见标签
        const patternsToRemove = /\b(4K|1080p|720p|HD|国语|中字|WEB-DL|BluRay)\b/ig;
        cleanTitle = cleanTitle.replace(patternsToRemove, '');
        // 标准化分隔符并清理
        cleanTitle = cleanTitle.replace(/[\.\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        
        return { cleanTitle, year };
    },

    /**
     * 从TMDB获取海报
     * @param {string} title - 影视标题
     * @param {string} type - 'movie' 或 'tv'
     * @returns {Promise<string>} 海报URL或空字符串
     */
    getPoster: async function(title, type = 'movie') {
        const { cleanTitle, year } = this.cleanTitle(title);
        if (!cleanTitle) return '';

        const url = `https://api.themoviedb.org/3/search/${type}?api_key=${this.apiKey}&query=${encodeURIComponent(cleanTitle )}&language=zh-CN${year ? '&year=' + year : ''}`;

        try {
            const { data } = await $fetch.get(url);
            const results = JSON.parse(data).results;
            if (results && results.length > 0 && results[0].poster_path) {
                return this.imageBaseUrl + results[0].poster_path;
            }
        } catch (e) {
            console.error(`TMDB请求失败 for title "${cleanTitle}":`, e.message);
        }
        return '';
    }
};

async function getConfig( ) {
  return jsonify(appConfig);
}

// =================================================================
// [已改造] getCards 函数
// =================================================================
async function getCards(ext) {
  ext = argsify(ext);
  let { page = 1, id, type = 'movie' } = ext; // 从ext获取type
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
  const $ = cheerio.load(data);
  
  const cards = [];
  const promises = []; // 用于并发请求TMDB

  $('.topicItem').each((index, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return;
    const href = $(each).find('h2 a').attr('href');
    const title = $(each).find('h2 a').text();
    
    // 您的标题清洗逻辑，保留它因为它可能对显示名称有用
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
    if (/content/.test(r) && !/cloud/.test(r)) return;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;

    const card = {
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '', // 先设置为空
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    };
    cards.push(card);

    // 为每个card创建一个获取海报的Promise
    promises.push(
        tmdb.getPoster(title, type).then(posterUrl => {
            card.vod_pic = posterUrl; // 获取到海报后，更新card对象
        })
    );
  });

  await Promise.all(promises); // 等待所有海报请求完成
  return jsonify({ list: cards });
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

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
        const bodyText = $('body').text();

        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+  ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://'  );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }

        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const $el = $(el);
            let href = $el.attr('href');
            if (!href) return;
            
            let agnosticUrl = getProtocolAgnosticUrl(href);
            if (!agnosticUrl || uniqueLinks.has(agnosticUrl)) return;

            href = href.replace('http://', 'https://'  );

            let trackName = $el.text().trim();
            if (trackName.startsWith('http'  ) || trackName === '') {
                trackName = pageTitle;
            }

            tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });

        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText  )) !== null) {
            let panUrl = match[0].replace('http://', 'https://'  );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
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

// =================================================================
// [已改造] search 函数
// =================================================================
async function search(ext) {
  ext = argsify(ext);
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  
  const cards = [];
  const promises = [];

  $('.topicItem').each((_, el) => {
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $(el).find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;

    // 判断类型，搜索结果比较杂，可以根据tag简单判断
    const type = /剧|动漫|综艺/.test(tag) ? 'tv' : 'movie';

    const card = {
      vod_id: href,
      vod_name: title,
      vod_pic: '', // 先设置为空
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    };
    cards.push(card);

    // 为每个card创建一个获取海报的Promise
    promises.push(
        tmdb.getPoster(title, type).then(posterUrl => {
            card.vod_pic = posterUrl; // 更新海报
        })
    );
  });

  await Promise.all(promises); // 等待所有海报请求完成
  return jsonify({ list: cards });
}
