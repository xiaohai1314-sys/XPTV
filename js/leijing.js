/**
 * =================================================================
 * 雷鲸资源提取脚本 (专版优化)
 * 版本: 22 (雷鲸专版)
 *
 * 更新日志:
 * - 完全重构 getTracks 函数，针对雷鲸网站特殊结构优化
 * - 新增多层搜索策略，解决特殊编码链接识别问题
 * - 增强访问码提取逻辑，支持更多格式
 * - 添加智能链接清理功能，处理URL编码字符
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 22,
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

async function getConfig() {
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  let { page = 1, id } = ext;
  const url = appConfig.site + `/${id}&page=${page}`;
  const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
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
  return jsonify({ 'urls': [] });
}

// --- 详情页函数: 雷鲸专版优化 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    
    try {
        const { data } = await $fetch.get(url, { 
            headers: { 
                'Referer': appConfig.site, 
                'User-Agent': UA 
            } 
        });
        
        const $ = cheerio.load(data);
        const title = $('.topicBox .title').text().trim() || "网盘资源";
        let accessCode = '';

        // 1. 直接在.topicContent中查找访问码
        const topicContent = $('.topicContent').text();
        const accessCodeMatch = topicContent.match(/(?:访问码|密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})/i);
        if (accessCodeMatch && accessCodeMatch[1]) {
            accessCode = accessCodeMatch[1];
        }

        // 2. 查找所有可能的网盘链接（包含特殊编码处理）
        const linkPatterns = [
            // 处理URL编码的链接（如 %EF%BC%89 等）
            /https?:\/\/cloud\.189\.cn\/[^\s<>\"]+%EF%BC%88[^\"]+%EF%BC%89/i,
            // 标准链接格式
            /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code=)[a-zA-Z0-9]+[^\s<>\"]*/i,
            // 包含中文括号的链接
            /https?:\/\/cloud\.189\.cn\/[^\s<>\"]+（[^）]+）/
        ];

        // 3. 在多个位置查找链接
        const searchLocations = [
            $('.topicContent').html() || '',  // 主题内容
            $('a[href*="cloud.189.cn"]').attr('href') || '',  // 包含云盘域名的链接
            $('a:contains("cloud.189.cn")').text() || ''  // 包含云盘域名的文本
        ];

        let foundLink = '';
        
        // 按优先级搜索链接
        for (const pattern of linkPatterns) {
            for (const location of searchLocations) {
                const match = location.match(pattern);
                if (match && match[0]) {
                    foundLink = match[0];
                    break;
                }
            }
            if (foundLink) break;
        }

        // 4. 清理并验证找到的链接
        if (foundLink) {
            // 提取纯净链接（移除括号及之后的内容）
            let cleanLink = foundLink.split(/[\(（]/)[0].trim();
            
            // 解码URL编码字符
            try {
                cleanLink = decodeURIComponent(cleanLink);
            } catch (e) {
                console.log('URL解码失败，使用原始链接');
            }
            
            // 确保是有效的天翼云链接
            if (cleanLink.includes('cloud.189.cn')) {
                // 从原始链接中提取访问码（如果存在）
                const codeMatch = foundLink.match(/(?:访问码|密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})/i);
                const finalAccessCode = (codeMatch && codeMatch[1]) || accessCode;
                
                tracks.push({ 
                    name: title, 
                    pan: cleanLink, 
                    ext: { accessCode: finalAccessCode } 
                });
            }
        }

        // 5. 如果仍未找到，尝试最后的手段
        if (tracks.length === 0) {
            const lastResort = topicContent.match(/(https?:\/\/cloud\.189\.cn\/\S+)/i);
            if (lastResort && lastResort[1]) {
                tracks.push({ 
                    name: title, 
                    pan: lastResort[1], 
                    ext: { accessCode } 
                });
            }
        }

        return jsonify(tracks.length > 0 
            ? { list: [{ title: "天翼云盘", tracks }] } 
            : { list: [] }
        );

    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({ 
            list: [{ 
                title: "资源列表", 
                tracks: [{ 
                    name: "加载失败", 
                    pan: "请检查网络或链接", 
                    ext: { accessCode: "" } 
                }] 
            }] 
        });
    }
}

// 辅助函数：清理和标准化网盘链接
function normalizePanUrl(url) {
    try {
        // 处理URL编码字符
        let cleanUrl = url.replace(/%EF%BC%88|%EF%BC%89|%EF%BC%9A/g, '');
        
        // 提取基础URL部分
        const baseMatch = cleanUrl.match(/https?:\/\/cloud\.189\.cn\/[^\s<>\"]+/i);
        if (baseMatch) {
            cleanUrl = baseMatch[0];
        }
        
        // 移除括号及之后的内容
        cleanUrl = cleanUrl.split(/[\(（]/)[0].trim();
        
        return cleanUrl;
    } catch (e) {
        return url;
    }
}

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
