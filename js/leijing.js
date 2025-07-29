/* 
 * 雷鲸资源站脚本 - 2025-07-29-jump-naked-final (混合模式版)
 * frontend.js
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0 Safari/537.36';
const cheerio = createCheerio();

// --- 新增：后端服务地址配置 ---
// 请将此地址替换为您部署的后端服务的实际地址
const BACKEND_API_URL = 'http://localhost:3000/api/extractNakedText'; 

const appConfig = {
  ver: 2025072915,
  title: '雷鲸·jump跳转修正版',
  site: 'https://www.leijing.xyz',
  // ... tabs 配置保持不变 ...
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
};

// getConfig, getCards, getPlayinfo, search 函数保持不变...
async function getConfig( ) { /* ... */ }
async function getCards(ext) { /* ... */ }
async function getPlayinfo(ext) { /* ... */ }
async function search(ext) { /* ... */ }


// --- 核心修改：增强后的 getTracks 函数 ---
async function getTracks(ext) {
  ext = argsify(ext);
  const url = ext.url;
  const tracks = [];
  const unique = new Set();
  let title = '网盘资源'; // 默认标题

  // --- 第一步：前端本地提取 (精准匹配 + a标签) ---
  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    title = $('.topicBox .title').text().trim() || title;

    // 1️⃣ 精准匹配
    const precise = /https?:\/\/cloud\.189\.cn\/(?:t\/([a-zA-Z0-9]+ )|web\/share\?code=([a-zA-Z0-9]+))\s*[\(（\uff08]访问码[:：\uff1a]([a-zA-Z0-9]{4,6})[\)）\uff09]/g;
    let m;
    while ((m = precise.exec(data)) !== null) {
      const panUrl = `https://cloud.189.cn/${m[1] ? 't/' + m[1] : 'web/share?code=' + m[2]}`;
      if (!unique.has(panUrl )) {
        tracks.push({ name: title, pan: panUrl, ext: { accessCode: m[3] } });
        unique.add(panUrl);
      }
    }

    // 2️⃣ <a> 标签提取
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
  } catch (e) {
    console.log('前端本地提取阶段发生错误:', e.message);
  }

  // --- 第二步：调用后端进行裸文本提取作为补充 ---
  try {
    // 构造请求后端的 URL
    const backendUrl = `${BACKEND_API_URL}?url=${encodeURIComponent(url)}`;
    const response = await $fetch.get(backendUrl); // 使用环境的 fetch
    const backendTracks = JSON.parse(response.data); // 假设返回的是 JSON 字符串

    if (Array.isArray(backendTracks)) {
      backendTracks.forEach(track => {
        // 检查后端返回的链接是否已存在，不存在则添加
        if (track.pan && !unique.has(track.pan)) {
          tracks.push(track);
          unique.add(track.pan);
        }
      });
    }
  } catch (e) {
    console.log('调用后端提取时发生错误:', e.message);
    // 此处失败不影响已有结果，实现优雅降级
  }

  // --- 第三步：返回最终合并后的结果 ---
  return tracks.length
    ? jsonify({ list: [{ title: '天翼云盘', tracks }] })
    : jsonify({ list: [] });
}


// --- 辅助函数 (保持不变) ---
function argsify(ext) {
  if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; }
  return ext || {};
}
function jsonify(data) {
  return JSON.stringify(data);
}
