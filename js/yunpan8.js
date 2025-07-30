/**
 * 海绵小站前端插件 - v5 (纯净显示版)
 * 
 * 功能:
 * - 【v5 最终修复】完美适配 v46 后端，不再对显示名称做任何多余处理（如添加[翼]），将后端返回的“数据包”原样传递给App。
 * - 【v4 继承】能解析后端返回的`文件名$数据包`格式。
 * - 【v4 继承】智能交互，能正确处理纯净链接和带访问码的数据包。
 * - 【v3 继承】增强容错性，解决二次打开卡死问题，明确提示无资源情况。
 */

// --- 配置区 ---
// 请务必确保这里的地址和端口与您后端服务运行的地址完全一致！
const API_BASE_URL = 'http://192.168.1.7:3000/api'; 
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
 * 获取详情和播放链接 - 【v5 纯净显示版】
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
        let dataPacket = parts[1]; // 后端拼接好的标准“数据包”
        
        tracks.push({
          name: fileName, // 直接使用后端返回的文件名
          pan: dataPacket, // 将后端拼接好的“数据包”原样传递给App
          ext: {},
        });
        
        log(`添加网盘链接: ${fileName}, 提交给App的数据包: ${dataPacket}`);
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
