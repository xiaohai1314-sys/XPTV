/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v29 (后端代理+前端解析修正版)
 *
 * 最终修正说明:
 * - 纠正了上一版的严重错误，完整恢复了 getTracks 函数中的网盘链接提取和去重逻辑。
 * - 实现了“后端代理通信，前端负责解析”的正确模式。
 * - getCards 和 search 函数通过后端 /search 接口获取列表数据。
 * - getTracks 函数通过新增的后端 /detail 接口获取页面HTML，然后在前端进行解析。
 * - 前端不再包含任何硬编码的 Cookie 或复杂的请求头。
 * - 请确保您的 server.js 也已更新，包含了 /detail 接口。
 * =================================================================
 */

const cheerio = createCheerio();

// 定义后端服务地址和目标站点
const LOCAL_SERVER_URL = 'http://192.168.10.111:3001';
const TARGET_SITE_URL = 'https://www.leijing.xyz';

// appConfig 与原版保持一致
const appConfig = {
  ver: 29,
  title: '雷鲸',
  site: TARGET_SITE_URL,
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

// getCards 函数通过后端代理获取数据
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  // 分类页面和搜索页面结构相同，都使用后端的 /search 接口
  const proxyUrl = `${LOCAL_SERVER_URL}/search?text=${encodeURIComponent(id)}&page=${page}`;
  try {
    const { data } = await $fetch.get(proxyUrl);
    return jsonify(data);
  } catch (e) {
    console.error('获取分类数据失败:', e.message);
    return jsonify({ list: [] });
  }
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

// getTracks 函数：通过后端获取HTML，在前端进行解析
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const uniqueLinks = new Set(); // 用于去重的“登记簿”

    // 从 ext.url 中提取页面路径，例如 "/topic/12345.html"
    const pagePath = ext.url.replace(appConfig.site, '');
    
    // 构建指向本地后端 /detail 接口的 URL
    const proxyUrl = `${LOCAL_SERVER_URL}/detail?path=${encodeURIComponent(pagePath)}`;

    try {
        // 从后端获取详情页的完整HTML
        const { data: html } = await $fetch.get(proxyUrl);
        const $ = cheerio.load(html);
        
        const pageTitle = $('.topicBox .title').text().trim() || "网盘资源";
        const bodyText = $('body').text();

        // --- 策略一：精准匹配 (来自您的原版逻辑) ---
        const precisePattern = /(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
        let match;
        while ((match = precisePattern.exec(bodyText)) !== null) {
            let panUrl = match[0].replace('http://', 'https://' );
            let agnosticUrl = getProtocolAgnosticUrl(panUrl);
            if (uniqueLinks.has(agnosticUrl)) continue;

            tracks.push({ name: pageTitle, pan: panUrl, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        }

        // --- 策略二：<a>标签扫描 (来自您的原版逻辑) ---
        $('a[href*="cloud.189.cn"]').each((_, el) => {
            const $el = $(el);
            let href = $el.attr('href');
            if (!href) return;
            
            let agnosticUrl = getProtocolAgnosticUrl(href);
            if (!agnosticUrl || uniqueLinks.has(agnosticUrl)) return;

            href = href.replace('http://', 'https://' );

            let trackName = $el.text().trim();
            if (trackName.startsWith('http' ) || trackName === '') {
                trackName = pageTitle;
            }

            tracks.push({ name: trackName, pan: href, ext: { accessCode: '' } });
            uniqueLinks.add(agnosticUrl);
        });

        // --- 策略三：纯文本URL扫描 (来自您的原版逻辑) ---
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
        console.error('获取或解析详情页失败:', e.message);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: '加载失败，请检查后端服务', pan: 'about:blank', ext: { accessCode: '' } }]
            }]
        });
    }
}

// search 函数通过后端代理进行搜索
async function search(ext) {
  ext = argsify(ext);
  const { text, page = 1 } = ext;
  const proxyUrl = `${LOCAL_SERVER_URL}/search?text=${encodeURIComponent(text)}&page=${page}`;
  try {
    const { data } = await $fetch.get(proxyUrl);
    return jsonify(data);
  } catch (e) {
    console.error('搜索失败:', e.message);
    return jsonify({ list: [] });
  }
}
