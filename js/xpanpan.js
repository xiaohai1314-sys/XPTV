/**
 * XPTV App 插件前端代码 (v11.0 - 终极融合最终版)
 * 
 * 功能:
 * - 与 v18.0 版本后端完美配合。
 * - 核心: 融合了所有成功经验，采取“组合URL+提供豁免符”的最终策略。
 * - 组合URL: 在前端将后端数据组合成夸克能识别的、带 ?pwd= 参数的标准URL。
 * - 提供豁免符: 同时提供 ext: { pwd: '' }，明确告知App无需再处理密码，直接使用pan字段的URL。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.4:3000/api'; // 请务必替换为你的后端服务实际地址
// --- 配置区 ---

function log(msg ) {
  try { $log(`[网盘资源社插件] ${msg}`); } catch (_) { console.log(`[网盘资源社插件] ${msg}`); }
}

async function request(url) {
  log(`发起请求: ${url}`);
  try {
    const response = await $fetch.get(url, { headers: { 'Accept': 'application/json' }, timeout: 60000 });
    if (response.status !== 200) throw new Error(`HTTP错误! 状态: ${response.status}`);
    const data = JSON.parse(response.data);
    if (data.error) throw new Error(`API返回错误: ${data.error}`);
    return data;
  } catch (error) {
    log(`请求失败: ${error.message}`);
    return { error: true, message: error.message, list: [] };
  }
}

async function getConfig() {
  const appConfig = {
    ver: 1,
    title: '网盘资源社',
    site: API_BASE_URL,
    cookie: '',
    tabs: [
      { name: '影视/剧集', ext: { id: 'forum-1.htm' } },
      { name: '4K专区', ext: { id: 'forum-12.htm' } },
      { name: '动漫区', ext: { id: 'forum-3.htm' } },
      { name: '教程/书籍', ext: { id: 'forum-8.htm' } }
    ],
  };
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);
  if (data.error) return jsonify({ list: [] });
  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id },
  }));
  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  if (data.error || !data.list || data.list.length === 0) {
    return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '获取资源失败或帖子无内容', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  const detailItem = data.list[0];

  if (detailItem.vod_play_url && detailItem.vod_play_url.trim() !== '' && detailItem.vod_play_url !== '暂无有效网盘链接') {
    const playUrlPackages = detailItem.vod_play_url.split('$$$');
    
    playUrlPackages.forEach((pkg) => {
      if (pkg.trim()) {
        const parts = pkg.split('$');
        if (parts.length < 2) return;

        const fileName = parts[0];
        const dataPacket = parts[1]; // 拿到 "纯净链接|密码"

        const linkParts = dataPacket.split('|');
        const pureLink = linkParts[0] || '';
        const accessCode = linkParts[1] || '';

        // 【v11.0 核心修改】组合标准URL + 提供豁免符
        let finalPan = pureLink;
        if (accessCode) {
            const separator = pureLink.includes('?') ? '&' : '?';
            finalPan = `${pureLink}${separator}pwd=${accessCode}`;
        }

        tracks.push({
          name: fileName,
          pan: finalPan,          // 传递一个标准的、可直接打开的URL
          ext: { pwd: '' },       // 【关键！】同时提供“豁免符”，告诉App不要再处理密码了
        });
      }
    });
  }

  if (tracks.length === 0) {
    tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} });
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) return jsonify({ list: [] });
  
  const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
  const data = await request(url);
  if (data.error) return jsonify({ list: [] });

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: '',
    ext: { url: item.vod_id },
  }));
  return jsonify({ list: cards });
}

// --- 兼容旧版 XPTV App 接口 ---
async function init() { return getConfig(); }
async function home() { 
  const c = await getConfig(); 
  const config = JSON.parse(c);
  return jsonify({ class: config.tabs, filters: {} }); 
}
async function category(tid, pg) { 
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg }); 
}
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
