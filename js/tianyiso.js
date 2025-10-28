/**
 * reboys.cn 聚合脚本 - 极简测试版
 * 目的：排查 App 是否能正常调用脚本
 */

// !! 替换为你的后端地址
const API = "http://192.168.10.106:3000";

// ===== 核心函数 =====
async function search(ext) {
  const obj = typeof ext === 'string' ? JSON.parse(ext) : ext;
  const keyword = obj.text || '电影';
  const page = obj.page || 1;
  
  try {
    // 使用测试端点，避免启动浏览器
    const url = `${API}/test?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    if (data.code === 0) {
      const results = data.data?.data?.data?.results || [];
      const list = results.map(item => ({
        vod_id: String(item.id),
        vod_name: item.title,
        vod_pic: item.image,
        vod_remarks: item.source_name
      }));
      return JSON.stringify({ list });
    }
  } catch (e) {
    // 静默失败
  }
  
  return JSON.stringify({ list: [] });
}

async function category(tid, pg) {
  return await search({ text: tid, page: pg || 1 });
}

async function detail(id) {
  return JSON.stringify({ list: [] });
}

async function play(flag, id) {
  return JSON.stringify({ url: id });
}

async function init(cfg) {
  return JSON.stringify({
    ver: 1,
    title: 'reboys测试',
    site: API,
    tabs: [
      { name: '电影', ext: { id: '电影' } },
      { name: '剧集', ext: { id: '电视剧' } }
    ]
  });
}

async function home(filter) {
  const cfg = JSON.parse(await init());
  return JSON.stringify({ 
    class: cfg.tabs, 
    filters: {} 
  });
}

// ===== 导出 =====
if (typeof globalThis !== 'undefined') {
  globalThis.init = init;
  globalThis.home = home;
  globalThis.category = category;
  globalThis.detail = detail;
  globalThis.play = play;
  globalThis.search = search;
}
