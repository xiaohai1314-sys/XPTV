/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v35.4 (最终稳定版：基于V33 + 验证优化)
 *
 * 更新说明:
 * - 修复: 解决了 Tab 栏消失的问题，回归 V33 的稳定结构。
 * - 机制: 移除外部验证函数，将验证逻辑内联到主函数，避免初始化错误。
 * - 优化: 统一使用移动端 UA，提高 Cloudflare Cookie 同步率。
 * - 验证流程: 不中断脚本，只触发 Safari 跳转，依赖用户手动重试。
 * =================================================================
 */

// 统一使用移动端 UA，模仿玩偶哥哥脚本
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)";
const cheerio = createCheerio();
const BACKEND_URL = 'http://192.168.1.3:3001'; [span_0](start_span)//[span_0](end_span)

const appConfig = {
  ver: 35.4, // 版本号
  [span_1](start_span)title: '雷鲸', //[span_1](end_span)
  [span_2](start_span)site: 'https://www.leijing.xyz', //[span_2](end_span)
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  [span_3](start_span)], //[span_3](end_span)
};

async function getConfig() {
  [span_4](start_span)// 保持简洁，确保 Tab 栏初始化成功[span_4](end_span)
  return jsonify(appConfig);
}

function getHtmlFromResponse(response) {
  if (typeof response === 'string') return response; [span_5](start_span)//[span_5](end_span)
  if (response && typeof response.data === 'string') return response.data; [span_6](start_span)//[span_6](end_span)
  console.error("收到了非预期的响应格式:", response); [span_7](start_span)//[span_7](end_span)
  return ''; [span_8](start_span)//[span_8](end_span)
}

// getCards 函数
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext; [span_9](start_span)//[span_9](end_span)
  
  const requestUrl = `${appConfig.site}/${id}&page=${page}`; [span_10](start_span)//[span_10](end_span)
  const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } }); [span_11](start_span)//[span_11](end_span)
  const htmlData = getHtmlFromResponse(response);

  // ✅ Cloudflare 验证检测 (内联逻辑，不中断，不使用外部函数)
  const $check = cheerio.load(htmlData);
  const title = $check('title').text().trim();
  if (
    title.includes('Just a moment') ||
    htmlData.includes('cf-challenge') ||
    htmlData.includes('Checking your browser') ||
    htmlData.includes('Attention Required')
  ) {
      console.log("检测到人机验证，已自动打开 Safari。");
      $utils.openSafari(appConfig.site, UA);
      // 流程继续，解析将失败，返回空列表，等待用户手动重试。
  }
  // ------------------------------------

  const $ = cheerio.load(htmlData); [span_12](start_span)//[span_12](end_span)
  $('.topicItem').each((_, each) => {
    [span_13](start_span)if ($(each).find('.cms-lock-solid').length > 0) return; //[span_13](end_span)
    const href = $(each).find('h2 a').attr('href');
    const title = $(each).find('h2 a').text();
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const r = $(each).find('.summary').text();
    const tag = $(each).find('.tag').text();
    if (/content/.test(r) && !/cloud/.test(r)) return;
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return; [span_14](start_span)//[span_14](end_span)
    cards.push({
      vod_id: href,
      vod_name: dramaName,
      [span_15](start_span)vod_pic: '', //[span_15](end_span)
      vod_remarks: '',
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards }); [span_16](start_span)//[span_16](end_span)
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] }); [span_17](start_span)//[span_17](end_span)
}

function getProtocolAgnosticUrl(rawUrl) {
  if (!rawUrl) return null; [span_18](start_span)//[span_18](end_span)
  const cleaned = rawUrl.replace(/（访问码[:：\uff1a][a-zA-Z0-9]{4,6}）/g, ''); [span_19](start_span)//[span_19](end_span)
  const match = cleaned.match(/cloud\.189\.cn\/[a-zA-Z0-9\/?=]+/); [span_20](start_span)//[span_20](end_span)
  return match ? match[0] : null;
}

// getTracks 函数
async function getTracks(ext) {
  ext = argsify(ext);
  const tracks = []; [span_21](start_span)//[span_21](end_span)
  const uniqueLinks = new Set(); [span_22](start_span)//[span_22](end_span)

  try {
    const requestUrl = ext.url; [span_23](start_span)//[span_23](end_span)
    const response = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } }); [span_24](start_span)//[span_24](end_span)
    const htmlData = getHtmlFromResponse(response);
    
    // ✅ Cloudflare 验证检测 (内联逻辑，不中断，不使用外部函数)
    const $check = cheerio.load(htmlData);
    const title = $check('title').text().trim();
    if (
      title.includes('Just a moment') ||
      htmlData.includes('cf-challenge') ||
      htmlData.includes('Checking your browser') ||
      htmlData.includes('Attention Required')
    ) {
        console.log("检测到人机验证，已自动打开 Safari。");
        $utils.openSafari(appConfig.site, UA);
        // 流程继续，解析将失败，返回空列表，等待用户手动重试。
    }
    // ------------------------------------

    const $ = cheerio.load(htmlData); [span_25](start_span)//[span_25](end_span)

    const pageTitle = $('.topicBox .title').text().trim() || "网盘资源"; [span_26](start_span)//[span_26](end_span)
    const bodyText = $('body').text(); [span_27](start_span)//[span_27](end_span)

    // 第一部分：精准匹配
    const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+  ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g; [span_28](start_span)//[span_28](end_span)
    let match;
    [span_29](start_span)while ((match = precisePattern.exec(bodyText)) !== null) { //[span_29](end_span)
      let panUrl = match[0].replace('http://', 'https://');
      let agnosticUrl = getProtocolAgnosticUrl(panUrl); [span_30](start_span)//[span_30](end_span)
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl); [span_31](start_span)//[span_31](end_span)
    }

    // 第二部分：<a> 标签提取
    $('a[href*="cloud.189.cn"]').each((_, el) => {
      const $el = $(el);
      let href = $el.attr('href');
      if (!href) return;
      let agnosticUrl = getProtocolAgnosticUrl(href);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) return;
      href = href.replace('http://', 'https://');
      let trackName = $el.text().trim() || pageTitle;
      tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
      [span_32](start_span)if (agnosticUrl) uniqueLinks.add(agnosticUrl); //[span_32](end_span)
    });

    // 第三部分：裸文本提取
    [span_33](start_span)const urlPattern = /https?:\/\/cloud\.189\.cn\/[^\s"'<>）)]+/g; //[span_33](end_span)
    while ((match = urlPattern.exec(bodyText)) !== null) {
      let panUrl = match[0].replace('http://', 'https://');
      let accessCode = '';
      const codeMatch = bodyText.slice(match.index, match.index + 100)
        .match(/（访问码[:：\uff1a]([a-zA-Z0-9]{4,6})）/);
      if (codeMatch) accessCode = codeMatch[1];
      panUrl = panUrl.trim().replace(/[）\)]+$/, '');
      if (accessCode) panUrl = `${panUrl}（访问码：${accessCode}）`; [span_34](start_span)//[span_34](end_span)
      const agnosticUrl = getProtocolAgnosticUrl(panUrl);
      if (agnosticUrl && uniqueLinks.has(agnosticUrl)) continue;
      tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
      if (agnosticUrl) uniqueLinks.add(agnosticUrl);
    }

    return tracks.length
      ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
      : jsonify({ list: [] });

  [span_35](start_span)} catch (e) { //[span_35](end_span)
    console.error('获取详情页失败:', e);
    return jsonify({
      list: [{
        title: '错误',
        tracks: [{ name: '加载失败', pan: 'about:blank', ext: { accessCode: '' } }]
      }]
    }); [span_36](start_span)//[span_36](end_span)
  }
}

// search 函数
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1; [span_37](start_span)//[span_37](end_span)

  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`; [span_38](start_span)//[span_38](end_span)
  const response = await $fetch.get(requestUrl);
  const htmlData = getHtmlFromResponse(response); [span_39](start_span)//[span_39](end_span)

  // ✅ Cloudflare 验证检测 (内联逻辑，不中断，不使用外部函数)
  const $check = cheerio.load(htmlData);
  const title = $check('title').text().trim();
  if (
    title.includes('Just a moment') ||
    htmlData.includes('cf-challenge') ||
    htmlData.includes('Checking your browser') ||
    htmlData.includes('Attention Required')
  ) {
      console.log("检测到人机验证，已自动打开 Safari。");
      $utils.openSafari(appConfig.site, UA);
  }
  // ------------------------------------

  const $ = cheerio.load(htmlData); [span_40](start_span)//[span_40](end_span)

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
  return jsonify({ list: cards }); [span_41](start_span)//[span_41](end_span)
}
