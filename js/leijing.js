/*
 * ====================================================================
 *  雷鲸资源站脚本 - 最终完整测试版 (包含所有功能)
 * ====================================================================
 *  核心逻辑：
 *  1. 这是一个包含所有功能的完整脚本。
 *  2. 严格保留提取方式1和2为用户原始版本，一字不差。
 *  3. 对提取方式3，使用一个更强大的正则进行尝试。
 *  4. 如果提取方式3失败，则将详情页全部文本作为一个备用链接，
 *     以便用户能复制并提供给我们进行最终分析。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0 Safari/537.36';
const cheerio = createCheerio();

// 1. 分类和基础配置 (appConfig)
const appConfig = {
  ver: 2025072915,
  title: '雷鲸·jump跳转修正版',
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

// 2. 获取配置函数 (getConfig )
async function getConfig() {
  return jsonify(appConfig);
}

// 3. 获取分类卡片列表函数 (getCards)
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  const cards = [];
  $('.topicItem').each((_, el) => {
    if ($(el).find('.cms-lock-solid').length) return;
    const a = $(el).find('h2 a');
    const href = a.attr('href');
    const title = a.text().replace(/【.*?】|（.*?）/g, '').trim();
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

// 4. 播放信息函数 (getPlayinfo) - 通常用不到，保持为空
async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

// 5. 获取详情页链接函数 (getTracks) - 我们聚焦的核心
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = [];
  const url = ext.url;
  const unique = new Set();

  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const title = $('.topicBox .title').text().trim() || '网盘资源';

    // --- 提取方式 1 & 2：与您原脚本完全一致，一字不差 ---
    const precise = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let m;
    while ((m = precise.exec(data)) !== null) {
      const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      if (!unique.has(panUrl )) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
        unique.add(panUrl);
      }
    }
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || unique.has(href)) return;
      const ctx = $(el).parent().text();
      const code = /(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i.exec(ctx);
      tracks.push({
        name: $(el).text().trim() || title,
        pan: href,
        ext: { accessCode: code ? code[1] : '' },
      });
      unique.add(href);
    });

    // --- 提取方式 3：裸文本提取 - 【【【最终的、合理的测试点】】】 ---
    const nakedText = $('.topicContent').text();
    const nakedRe = /(https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code= )[a-zA-Z0-9]+(?:[\s\S]{0,10})?[\(（\uff08][\s\S]*?[:：\uff1a\s]*[a-zA-Z0-9]{4,6}[\)）\uff09])/gi;
    
    let matchFoundInNakedText = false;
    let n;
    while ((n = nakedRe.exec(nakedText)) !== null) {
      matchFoundInNakedText = true;
      const fullOriginalLink = n[0].trim();
      if (!unique.has(fullOriginalLink)) {
        tracks.push({
          name: title,
          pan: fullOriginalLink,
          ext: {}
        });
        unique.add(fullOriginalLink);
      }
    }

    // 如果上面所有方式都失败了，并且页面上确实有“访问码”字样
    if (tracks.length === 0 && (data.includes('访问码') || data.includes('accessCode'))) {
        tracks.push({
            name: `[请复制这里的全部内容给我] ${nakedText}`,
            pan: 'about:blank', // 只是个占位符
            ext: {}
        });
    }

    return tracks.length
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  } catch (e) {
    return jsonify({
      list: [{ title: '错误', tracks: [{ name: '加载失败: ' + e.message, pan: 'about:blank', ext: {} }] }],
    });
  }
}

// 6. 搜索函数 (search)
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
    const title = a.text().replace(/【.*?】|（.*?）/g, '').trim();
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
