// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3000/api';
// --- 配置区 ---

function log(msg) {
  try { $log(`[网盘资源社插件] ${msg}`); } catch (_) { console.log(`[网盘资源社插件] ${msg}`); }
}

async function request(url) {
  log(`发起请求: ${url}`);
  try {
    const response = await $fetch.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
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

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  return jsonify({
    ver: 1,
    title: '网盘资源社',
    site: API_BASE_URL,
    cookie: '',
    tabs: [
      { name: '影视/剧集', ext: { id: 'forum-1.htm' } },
      { name: '4K专区', ext: { id: 'forum-12.htm' } },
      { name: '动漫区', ext: { id: 'forum-3.htm' } },
      { name: '教程/书籍', ext: { id: 'forum-8.htm' } },
      { name: '综艺娱乐', ext: { id: 'forum-2.htm' } },
      { name: '音乐MV', ext: { id: 'forum-4.htm' } }
    ],
  });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  log(`获取分类数据: id=${id}, page=${page}`);
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
  log(`成功处理 ${cards.length} 条分类数据`);
  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  log(`获取详情数据: url=${url}`);
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);
  if (data.error) {
    return jsonify({ list: [{ title: '获取失败', tracks: [{ name: '网络错误或解析失败', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  if (data.list && data.list.length > 0) {
    const detailItem = data.list[0];
    let playUrlRaw = detailItem.vod_play_url;
    if (Array.isArray(playUrlRaw)) {
      playUrlRaw = playUrlRaw.join('\n');
    }

    if (typeof playUrlRaw === 'string' && playUrlRaw.trim() && playUrlRaw !== '暂无有效网盘链接') {
      const playUrls = playUrlRaw.split(/\$\$\$|\n/).filter(s => s.trim() !== '');

      playUrls.forEach((playUrl, index) => {
        let panName = `网盘 ${index + 1}`;
        let actualUrl = playUrl.trim();
        let passCode = '';
        const match = actualUrl.match(/\s*提取码[:：]?\s*([a-zA-Z0-9]+)/);
        if (match) {
          passCode = match[1];
          actualUrl = actualUrl.replace(match[0], '').trim();
        }

        if (actualUrl.includes('quark')) panName = `夸克网盘 ${index + 1}`;
        else if (actualUrl.includes('baidu') || actualUrl.includes('pan.baidu')) panName = `百度网盘 ${index + 1}`;
        else if (actualUrl.includes('aliyundrive') || actualUrl.includes('alipan')) panName = `阿里云盘 ${index + 1}`;
        else if (actualUrl.includes('115')) panName = `115网盘 ${index + 1}`;
        else if (actualUrl.includes('lanzou')) panName = `蓝奏云 ${index + 1}`;
        else if (actualUrl.includes('weiyun')) panName = `微云 ${index + 1}`;

        if (passCode) panName += ` [码:${passCode}]`;

        tracks.push({ name: panName, pan: actualUrl, ext: { passCode } });
        log(`添加网盘链接: ${panName}, URL: ${actualUrl}, 提取码: ${passCode}`);
      });
    }

    if (tracks.length === 0) {
      tracks.push({ name: '暂无有效网盘资源', pan: '', ext: {} });
    }
  } else {
    tracks.push({ name: '详情数据为空或格式异常', pan: '', ext: {} });
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) return jsonify({ list: [] });
  log(`执行搜索: keyword=${text}`);
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
  log(`搜索成功，找到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}

// --- 兼容 XPTV 老接口 ---
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

log('✅ 网盘资源社插件加载完成');
