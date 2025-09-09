/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v34 (分类页优化版)
 *
 * 最终优化说明:
 * - 根据用户的最新反馈，移除了 getCards (分类页) 函数中不必要的 Cookie。
 * - getTracks (详情页) 保持不变，继续使用前端 Cookie 访问。
 * - search (搜索) 保持不变，继续通过后端服务代理。
 * - 这是目前最精简、最高效、最符合实际情况的混合模式脚本。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// 定义后端服务地址（仅供 search 函数使用）
const LOCAL_SERVER_URL = 'http://192.168.10.111:3001';

const appConfig = {
  ver: 34,
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

// getCards 函数 - 【前端直连，无Cookie】
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  
  // =================== 核心优化点 START ===================
  // 根据您的反馈，此请求不再发送Cookie
  const { data } = await $fetch.get(url, { 
    headers: { 
      'Referer': appConfig.site, 
      'User-Agent': UA
      // 'Cookie' field has been removed
    } 
  });
  // =================== 核心优化点 END =====================

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

function getProtocolAgnosticUrl(rawUrl) {
    if (!rawUrl) return null;
    const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
    return match ? match[0] : null;
}

// getTracks 函数 - 【前端直连，带Cookie】(保持不变)
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        // 详情页很可能需要Cookie，因此予以保留
        const { data } = await $fetch.get(url, { 
          headers: { 
            'Referer': appConfig.site, 
            'User-Agent': UA,
            'Cookie': 'JSESSIONID=C57781E1D646D6C1A62A32160611FC62; cms_token=4febafb5c99a429d8373159ebcd4b7aa; __gads=ID=c3736e4ae873135e:T=1757177996:RT=1757177996:S=ALNI_MZ_4VhTl7nwkhAkCWRTG-rGl5F0lg; __gpi=UID=000011910c26eee9:T=1757177996:RT=1757177996:S=ALNI_MZZ6cUxfxPPF9flu3zbHBHbMPbcXA; __eoi=ID=b3f4d74171b08e4b:T=1757177996:RT=1757177996:S=AA-AfjZOBi2cilokmucUViJXs__q; cms_accessToken=94f3a9fd5a684a9db9e9952716b8b3a4; cms_refreshToken=4a45b4adceb74936a4c4011a85655f1d'
          } 
        });
        const $ = cheerio.load(data);
        
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();

        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
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
            href = href.replace('http://', 'https://' );
            let trackName = $el.text().trim();
            if (trackName.startsWith('http' ) || trackName === '') trackName = pageTitle;
            tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });

        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText )) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
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

// search 函数 - 【后端代理】(保持不变)
async function search(ext) {
  ext = argsify(ext);
  const { text, page = 1 } = ext;
  
  const proxyUrl = `${LOCAL_SERVER_URL}/search?text=${encodeURIComponent(text)}&page=${page}`;
  
  try {
    const { data } = await $fetch.get(proxyUrl);
    return jsonify(data);
  } catch (e) {
    console.error('搜索失败，请检查后端服务是否运行:', e.message);
    return jsonify({ list: [] });
  }
}
