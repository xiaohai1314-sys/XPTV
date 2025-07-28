/**
 * =================================================================
 * 最终可用脚本 - 融合分析与优化
 * 版本: 22.2 (分类列表修正版)
 *
 * 更新日志:
 * - [修正] 解决了 getCards 函数中过滤条件过于严格，导致分类列表无法显示任何内容的问题。
 * - [优化] 调整了 getCards 中的过滤逻辑，使其更加合理，能正确加载影视列表。
 *
 * 功能:
 * - 适配雷鲸小站 (leijing.xyz) 的影视资源抓取。
 * - 支持分类浏览（剧集、电影等）。
 * - 支持关键词搜索。
 * - 智能提取详情页中的天翼云盘链接和访问码。
 * =================================================================
 */

// --- 全局常量和初始化 ---
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio(); // 使用宿主环境提供的函数

// --- 应用配置 ---
const appConfig = {
  ver: 22.2,
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

// --- 核心接口函数 ---

/**
 * 获取应用配置
 */
async function getConfig( ) {
  return jsonify(appConfig);
}

/**
 * 获取分类卡片列表
 * @param {string} ext - 包含分类ID和页码的参数字符串
 */
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
  const $ = cheerio.load(data);

  $('.topicItem').each((index, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return; // 跳过加密内容
    const a = $(each).find('h2 a');
    const href = a.attr('href');
    const title = a.text();
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const tag = $(each).find('.tag').text();

    // **修正点**: 移除或修改了过于严格的过滤条件
    // 只根据标签过滤非影视内容
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

/**
 * 获取播放信息 (此脚本主要用于网盘，故此函数为空)
 */
async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] });
}

/**
 * 获取详情页的网盘轨迹 (核心提取逻辑)
 * @param {string} ext - 包含详情页URL的参数字符串
 */
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    const uniqueLinks = new Set();

    try {
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        const $ = cheerio.load(data);

        const $content = $('.topicContent');
        if ($content.length === 0) {
            return jsonify({ list: [] });
        }
        
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        const contentText = $content.text();

        let globalAccessCode = '';
        const globalCodeMatch = contentText.match(/(?:通用|全局|解压|访问|提取)[密碼码][：:]?\s*([a-z0-9]{4,6})\b/i);
        if (globalCodeMatch) {
            globalAccessCode = globalCodeMatch[1];
        }

        $content.find('a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const linkText = $el.text();

            if (!href || !href.includes('cloud.189.cn')) {
                return;
            }

            const urlMatch = (href + ' ' + linkText).match(/https?:\/\/cloud\.189\.cn\/[^\s<>( )（）]+/);
            if (!urlMatch) return;
            const panUrl = urlMatch[0];
            
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) {
                return;
            }

            let accessCode = extractAccessCode(href + ' ' + linkText);
            if (!accessCode) {
                accessCode = extractAccessCode($el.parent().text());
            }
            if (!accessCode) {
                accessCode = globalAccessCode;
            }
            
            tracks.push({ 
                name: linkText.trim().substring(0, 50) || title,
                pan: panUrl, 
                ext: { accessCode: accessCode || '' }
            });
            uniqueLinks.add(normalizedUrl);
        });
        
        const textUrlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share\?code= )[^\s<>()（）]+/g;
        let match;
        while ((match = textUrlPattern.exec(contentText)) !== null) {
            const panUrl = match[0];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) {
                continue;
            }

            const searchArea = contentText.substring(Math.max(0, match.index - 50), match.index + panUrl.length + 50);
            let accessCode = extractAccessCode(searchArea) || globalAccessCode;

            tracks.push({ 
                name: title, 
                pan: panUrl, 
                ext: { accessCode: accessCode || '' } 
            });
            uniqueLinks.add(normalizedUrl);
        }

        if (tracks.length > 0) {
            return jsonify({ list: [{ title: "天翼云盘", tracks }] });
        } else {
            return jsonify({ list: [] });
        }

    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
    }
}

/**
 * 搜索功能
 * @param {string} ext - 包含搜索关键词和页码的参数字符串
 */
async function search(ext) {
  ext = argsify(ext);
  let cards = [];
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  
  const searchItems = $('.search-result ul > li, .topic-list > .topic-item, .result-list > .item, ul.search-results > li.result-item, .topicItem, .searchModule .item');
  
  searchItems.each((index, each) => {
    const $item = $(each);
    const a = $item.find('a.title, h2 a, h3 a, .item-title a, .title > span a');
    const href = a.attr('href');
    const title = a.text();
    if (!href || !title) return;

    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/;
    const match = title.match(regex);
    const dramaName = match ? match[1] : title;
    const tag = $item.find('.tag, .category, .item-tag, .detailInfo .module').text().trim();
    
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return;

    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: tag,
      ext: { url: `${appConfig.site}/${href}` },
    });
  });
  return jsonify({ list: cards });
}

// --- 辅助函数 ---

/**
 * 从文本中提取4-6位的访问码
 * @param {string} text - 待搜索的文本
 * @returns {string} - 访问码或空字符串
 */
function extractAccessCode(text) {
    if (!text) return '';
    let match = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (match && match[1]) return match[1];
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)?\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
    if (match && match[1]) return match[1];
    return '';
}

/**
 * 标准化URL，用于去重
 * @param {string} url - 原始URL
 * @returns {string} - 标准化后的URL
 */
function normalizePanUrl(url) {
    try {
        const cleanUrl = url.split(/[\(（\s]/)[0];
        const urlObj = new URL(cleanUrl);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>(  )（）]+/);
        return match ? match[0].toLowerCase() : url.toLowerCase();
    }
}
