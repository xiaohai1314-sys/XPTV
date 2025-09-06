/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v27 (列表页海报+Cookie修正版)
 *
 * 修正说明:
 * - 严格保持 appConfig, getCards, search 函数与v21原版一致。
 * - 引入“协议无关”的去重逻辑。
 * - 保留“脏链接”以适应App的特殊工作机制。
 * - 根据用户要求，直接在网络请求中添加 Cookie 以实现登录。
 * - 修改为从列表页直接获取海报，其他逻辑原封不动。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

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

async function getConfig(  ) {
  return jsonify(appConfig);
}

// getCards 函数已修改为从列表页获取海报
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { 
    headers: { 
      'Referer': appConfig.site, 
      'User-Agent': UA,
      'Cookie': 'JSESSIONID=C57781E1D646D6C1A62A32160611FC62; cms_token=4febafb5c99a429d8373159ebcd4b7aa; __gads=ID=c3736e4ae873135e:T=1757177996:RT=1757177996:S=ALNI_MZ_4VhTl7nwkhAkCWRTG-rGl5F0lg; __gpi=UID=000011910c26eee9:T=1757177996:RT=1757177996:S=ALNI_MZZ6cUxfxPPF9flu3zbHBHbMPbcXA; __eoi=ID=b3f4d74171b08e4b:T=1757177996:RT=1757177996:S=AA-AfjZOBi2cilokmucUViJXs__q; cms_accessToken=94f3a9fd5a684a9db9e9952716b8b3a4; cms_refreshToken=4a45b4adceb74936a4c4011a85655f1d'
    } 
  });
  const $ = cheerio.load(data);
  $('.topicItem').each((index, each) => {
    const $each = $(each); // 将 each 转换为 cheerio 对象
    if ($each.find('.cms-lock-solid').length > 0) return;
    const href = $each.find('h2 a').attr('href');
    const title = $each.find('h2 a').text();
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const r = $each.find('.summary').text();
    const tag = $each.find('.tag').text();
    if (/content/.test(r) && !/cloud/.test(r)) return;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;

    // --- 修改部分：尝试从列表项中直接获取海报 ---
    let pic = $each.find('.videoInfo .cover').attr('src') || '';
    if (pic && !pic.startsWith('http' )) {
        pic = new URL(pic, appConfig.site).href;
    }

    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: pic, // 使用从列表页获取到的海报
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

// 辅助函数：从任何链接中提取“协议无关”的纯净URL用于去重
function getProtocolAgnosticUrl(rawUrl) {
    if (!rawUrl) return null;
    const match = rawUrl.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/);
    return match ? match[0] : null;
}

async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set(); // 用于去重的“登记簿”

    try {
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

// search 函数已修改为从列表页获取海报
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { 
    headers: { 
      'User-Agent': UA,
      'Cookie': 'JSESSIONID=C57781E1D646D6C1A62A32160611FC62; cms_token=4febafb5c99a429d8373159ebcd4b7aa; __gads=ID=c3736e4ae873135e:T=1757177996:RT=1757177996:S=ALNI_MZ_4VhTl7nwkhAkCWRTG-rGl5F0lg; __gpi=UID=000011910c26eee9:T=1757177996:RT=1757177996:S=ALNI_MZZ6cUxfxPPF9flu3zbHBHbMPbcXA; __eoi=ID=b3f4d74171b08e4b:T=1757177996:RT=1757177996:S=AA-AfjZOBi2cilokmucUViJXs__q; cms_accessToken=94f3a9fd5a684a9db9e9952716b8b3a4; cms_refreshToken=4a45b4adceb74936a4c4011a85655f1d'
    } 
  });
  const $ = cheerio.load(data);
  $('.topicItem').each((_, el) => {
    const $el = $(el); // 将 el 转换为 cheerio 对象
    const a = $el.find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const tag = $el.find('.tag').text();
    if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;

    // --- 修改部分：尝试从列表项中直接获取海报 ---
    let pic = $el.find('.videoInfo .cover').attr('src') || '';
    if (pic && !pic.startsWith('http' )) {
        pic = new URL(pic, appConfig.site).href;
    }

    cards.push({
      vod_id: href,
      vod_name: title,
      vod_pic: pic, // 使用从列表页获取到的海报
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}
