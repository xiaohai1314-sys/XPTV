/**
 * 海绵小站前端插件 - v6 (最终精准修复版)
 * 
 * 更新日志:
 * - 【v6 核心修复】修正了 getTracks 函数，使其能够正确解析后端返回的“数据包”。
 *   现在它会将链接和访问码分离，并分别放入 App 能识别的 pan 和 ext.pwd 字段，
 *   从根本上解决点击资源按钮后无响应的问题。
 * - 【v6 兼容性】新的解析逻辑能够兼容后端返回的各种微小格式差异。
 * - 【v6 健壮性】保留了所有其他函数的原始逻辑，确保只修复核心问题而不引入新错误。
 */

// --- 配置区 ---
// 请务必确保这里的地址和端口与您后端服务运行的地址完全一致！
const API_BASE_URL = 'http://192.168.1.7:3002/api'; 
// --- 配置区 ---

// XPTV App 环境函数 (模拟 )
function log(msg) {
  try { $log(`[海绵小站插件] ${msg}`); } catch (_) { console.log(`[海绵小站插件] ${msg}`); }
}
async function request(url) {
  log(`发起请求: ${url}`);
  try {
    const response = await $fetch.get(url, { headers: { 'Accept': 'application/json' }, timeout: 45000 });
    if (response.status !== 200) throw new Error(`HTTP错误! 状态: ${response.status}`);
    const data = JSON.parse(response.data);
    if (data.error) throw new Error(`API返回错误: ${data.error}`);
    log(`请求成功, 收到 ${data.list?.length || 0} 条数据`);
    return data;
  } catch (error) {
    log(`请求失败: ${error.message}`);
    return { error: true, message: error.message, list: [] };
  }
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  const appConfig = {
    ver: 1,
    title: '海绵小站',
    site: API_BASE_URL,
    cookie: '',
    tabs: [
      { name: '电影', ext: { id: 'forum-1.htm' } },
      { name: '剧集', ext: { id: 'forum-2.htm' } },
      { name: '动漫', ext: { id: 'forum-3.htm' } },
      { name: '综艺', ext: { id: 'forum-5.htm' } },
    ],
  };
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  log(`获取分类数据: id=${id}, page=${page}`);
  
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);

  if (data.error) {
    log(`获取分类数据失败: ${data.message}`);
    return jsonify({ list: [] });
  }

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id },
  }));

  log(`成功处理 ${cards.length} 条分类数据`);
  return jsonify({ list: cards });
}

/**
 * 获取详情和播放链接 - 【v6 最终精准修复版】
 * 修复点：在前端正确解析后端返回的数据包，分离链接与访问码，
 *         并将其放入App能识别的 pan 和 ext.pwd 字段。
 */
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) {
    log('获取详情失败: 缺少URL参数');
    return jsonify({ list: [] });
  }

  log(`获取详情数据: url=${url}`);
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  if (data.error || !data.list || data.list.length === 0) {
    log(`获取详情数据失败或内容为空: ${data.message || '无有效列表'}`);
    return jsonify({ list: [{ title: '云盘', tracks: [{ name: '获取资源失败或帖子无内容', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  const detailItem = data.list[0];

  if (detailItem.vod_play_url && detailItem.vod_play_url.trim() !== '' && detailItem.vod_play_url !== '暂无有效网盘链接') {
    const playUrls = detailItem.vod_play_url.split('$$$');
    
    playUrls.forEach((playUrl) => {
      if (playUrl.trim()) {
        const parts = playUrl.split('$');
        if (parts.length < 2) return;

        let fileName = parts[0];
        let dataPacket = parts[1]; // 后端返回的完整数据包，例如: https://...（访问码：wh6i ）
        
        // --- 唯一的修改点在这里 ---
        let pureLink = '';
        let accessCode = '';
        
        // 使用正则表达式从数据包中分离纯链接和访问码
        // 这个正则能兼容后端可能输出的全角或半角符号
        const match = dataPacket.match(/(https?:\/\/[^\s（(]+ )[\s（(]+访问码[：:]+([^）)]+)/);
        
        if (match && match.length === 3) {
          pureLink = match[1].trim();   // 提取纯链接
          accessCode = match[2].trim(); // 提取访问码
        } else {
          // 如果正则匹配失败（例如，后端只返回了一个纯链接），则将整个数据包作为纯链接
          pureLink = dataPacket.trim();
        }
        // --- 修改结束 ---

        tracks.push({
          name: fileName,
          pan: pureLink,            // 【修复】只传递纯净的URL给pan字段
          ext: { pwd: accessCode }, // 【修复】将访问码（可能为空）放入ext.pwd字段
        });
        
        log(`已分离 -> 文件名: ${fileName}, 纯链接: ${pureLink}, 访问码: ${accessCode}`);
      }
    });
  }

  if (tracks.length === 0) {
    tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} });
    log('该帖子不含有效链接或所有链接解析失败');
  }

  log(`成功处理 ${tracks.length} 个播放链接`);
  return jsonify({ list: [{ title: '云盘', tracks }] });
}


async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) {
    log('搜索失败: 缺少关键词');
    return jsonify({ list: [] });
  }
  
  log(`执行搜索: keyword=${text}`);
  const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
  const data = await request(url);

  if (data.error) {
    log(`搜索失败: ${data.message}`);
    return jsonify({ list: [] });
  }

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: '',
    ext: { url: item.vod_id },
  }));

  log(`搜索成功，找到 ${cards.length} 条结果`);
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

log('海绵小站插件加载完成');
