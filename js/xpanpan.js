// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3000/api'; 
// --- 其余配置保持不变 ---

// 获取卡片数据（补充图片显示）
async function getCards(ext) {
  ext = argsify(ext);
  const { id, page = 1 } = ext;
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);
  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '', // 现在能获取到图片
    vod_remarks: item.vod_remarks || ''
  }));
  return jsonify({ list: cards });
}

// 获取播放链接（修复链接解析）
async function getTracks(ext) {
  const { url } = ext;
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);
  if (data.list && data.list.length > 0) {
    const tracks = data.list[0].tracks.map(track => ({
      name: track.name,
      id: track.pan // 直接使用解析后的网盘链接
    }));
    return jsonify({ list: [{ title: '资源列表', tracks }] });
  }
  return jsonify({ list: [] });
}

// 保留原有兼容函数
async function category(tid, pg, filter, extend) {
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg });
}
async function detail(id) {
  return getTracks({ url: id });
}
async function play(flag, id) {
  return getPlayinfo({ pan: id });
