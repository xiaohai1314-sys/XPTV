/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v27 (搜索修正版)
 *
 * 最终修正说明:
 * - getCards, getPlayinfo, getTracks 函数与原版逻辑一致。
 * - search 函数已根据最新的网站 HTML 结构进行修正。
 * - 引入“协议无关”的去重逻辑，彻底解决所有策略之间的重复按钮问题。
 * - 保留“脏链接”以适应App的特殊工作机制。
 * - 修正所有已知的、由我引入的错误。
 * - 根据用户要求，直接在网络请求中添加 Cookie 以实现登录。
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

async function getConfig(    ) {
  return jsonify(appConfig);
}

// getCards 函数与 v21 原版完全一致 (已添加 Cookie)
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  // --- 修改部分：添加了 Cookie ---
  const { data } = await $fetch.get(url, { 
    headers: { 
      'Referer': appConfig.site, 
      'User-Agent': UA,
      'Cookie': 'cms_token=9a85d97e4f834e0fbc7cf7bbcda5c534; __gads=ID=6264d985209341bc:T=1757398233:RT=1757398233:S=ALNI_MYRqqjCYqCvzG9qO-Panm8HwXv8CA; __gpi=UID=0000119384d9d03e:T=1757398233:RT=1757398233:S=ALNI_MaFtC8si7aMa0VqRRA6pfC55I0LPQ; __eoi=ID=3f91d1c77bd77ead:T=1757398233:RT=1757398233:S=AA-AfjbHRx5XLOeOd9IUrD-f7uG0; JSESSIONID=620543793A2C0C8EEA5AD0EAD5D6EAE3'
    } 
  });
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
        // --- 修改部分：添加了 Cookie ---
        const { data } = await $fetch.get(url, { 
          headers: { 
            'Referer': appConfig.site, 
            'User-Agent': UA,
            'Cookie': 'cms_token=9a85d97e4f834e0fbc7cf7bbcda5c534; __gads=ID=6264d985209341bc:T=1757398233:RT=1757398233:S=ALNI_MYRqqjCYqCvzG9qO-Panm8HwXv8CA; __gpi=UID=0000119384d9d03e:T=1757398233:RT=1757398233:S=ALNI_MaFtC8si7aMa0VqRRA6pfC55I0LPQ; __eoi=ID=3f91d1c77bd77ead:T=1757398233:RT=1757398233:S=AA-AfjbHRx5XLOeOd9IUrD-f7uG0; JSESSIONID=620543793A2C0C8EEA5AD0EAD5D6EAE3'
          } 
        });
        const $ = cheerio.load(data);
        
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();

        // --- 策略一：精准匹配 (已修正) ---
        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+    ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://'    );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }

        // --- 策略二：<a>标签扫描 (已修正) ---
        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const $el = $(el);
            let href = $el.attr('href');
            if (!href) return;
            
            let agnosticUrl = getProtocolAgnosticUrl(href);
            if (!agnosticUrl || uniqueLinks.has(agnosticUrl)) return;

            href = href.replace('http://', 'https://'    );

            let trackName = $el.text().trim();
            if (trackName.startsWith('http'    ) || trackName === '') {
                trackName = pageTitle;
            }

            tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });

        // --- 策略三：纯文本URL扫描 (已修正) ---
        const urlPattern = /https?:\/\/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/g;
        while ((match = urlPattern.exec(bodyText    )) !== null) {
            let panUrl = match[0].replace('http://', 'https://'    );
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

// ==================== 搜索函数 - 已修正 ====================
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  const text = encodeURIComponent(ext.text); // 关键词需要进行 URL 编码
  const page = ext.page || 1;
  const url = `${appConfig.site}/search?keyword=${text}&page=${page}`;

  try {
    // 请求部分保持不变，GET 请求是正确的
    const { data } = await $fetch.get(url, { 
      headers: { 
        'User-Agent': UA,
        'Referer': appConfig.site, // 添加 Referer 是个好习惯
        'Cookie': 'cms_token=9a85d97e4f834e0fbc7cf7bbcda5c534; __gads=ID=6264d985209341bc:T=1757398233:RT=1757398233:S=ALNI_MYRqqjCYqCvzG9qO-Panm8HwXv8CA; __gpi=UID=0000119384d9d03e:T=1757398233:RT=1757398233:S=ALNI_MaFtC8si7aMa0VqRRA6pfC55I0LPQ; __eoi=ID=3f91d1c77bd77ead:T=1757398233:RT=1757398233:S=AA-AfjbHRx5XLOeOd9IUrD-f7uG0; JSESSIONID=3D87DCA5B39F72C34DFD613070F6F8E3'
      } 
    });

    const $ = cheerio.load(data);

    // --- 核心修正：使用新的、正确的 CSS 选择器来解析 HTML ---
    $('.topicItem').each((_, el) => {
      const $el = $(el); // 将当前元素包装成 jQuery 对象以便后续查找
      
      const a = $el.find('h2.title a'); // 标题在 class="title" 的 h2 标签下的 a 链接中
      const href = a.attr('href');
      const title = a.text().trim();
      
      // 分类标签在 class="tag" 的 span 中
      const tag = $el.find('.content .info .tag').text().trim();

      // 过滤掉不想要的结果
      if (!href || /软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) {
        return; // 相当于 continue
      }

      cards.push({
        vod_id: href,
        vod_name: title,
        vod_pic: '', // 搜索结果页通常没有图片
        vod_remarks: tag, // 使用 tag 作为备注
        ext: { url: `${appConfig.site}/${href}` },
      });
    });
  } catch (e) {
    console.error('搜索失败:', e);
  }

  return jsonify({ list: cards });
}
// ==========================================================
