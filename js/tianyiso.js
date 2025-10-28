/**
 * reboys.cn 聚合脚本 - V5.1.0 (前后端分离，使用IP地址)
 *
 * 更新日志 (V5.1.0):
 * 1. 将后端API地址修改为直接使用IP和端口，适配无域名部署场景。
 */

// !! 重要 !!: 将此IP和端口替换为您自己后端服务的实际地址
const MY_BACKEND_API_URL = "http://192.168.10.106:3000";

const FALLBACK_PIC = "https://reboys.cn/favicon.ico";

// ============ 日志与其他辅助函数 ============
function log(msg ) { console.log(`[reboys-plugin] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// ============ API 调用层 (现在非常简单) ============
async function searchAPI(keyword, page = 1) {
  // 注意：确保你的App环境允许请求 http:// 协议的地址
  const url = `${MY_BACKEND_API_URL}/search?keyword=${encodeURIComponent(keyword )}&page=${page}`;
  log(`请求我方后端: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (e) {
    log(`请求我方后端失败: ${e.message}`);
    return { code: -1, message: e.message, data: null };
  }
}

// ============ 插件接口 (逻辑不变) ============
async function getConfig() {
  return jsonify({
    ver: 1, title: 'reboys聚合(分离版)', site: MY_BACKEND_API_URL,
    tabs: [
      { name: '短剧', ext: { id: '短剧' } }, { name: '电影', ext: { id: '电影' } },
      { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } },
      { name: '综艺', ext: { id: '综艺' } }
    ]
  });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { id: categoryName = '电影', page = 1 } = ext;
  const apiResp = await searchAPI(categoryName, page);
  if (!apiResp || apiResp.code !== 0 || !apiResp.data) {
    return jsonify({ list: [] });
  }
  const results = apiResp.data?.data?.data?.results || [];
  const cards = results.map(item => ({
    vod_id: item.id.toString(),
    vod_name: item.title,
    vod_pic: item.image || FALLBACK_PIC,
    vod_remarks: `[${item.source_name || '未知'}]`,
  }));
  return jsonify({ list: cards });
}

async function search(ext) {
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  if (!text.trim()) return jsonify({ list: [] });
  const apiResp = await searchAPI(text, page);
  if (!apiResp || apiResp.code !== 0 || !apiResp.data) {
    return jsonify({ list: [] });
  }
  const results = apiResp.data?.data?.data?.results || [];
  const cards = results.map(item => ({
    vod_id: item.id.toString(),
    vod_name: item.title,
    vod_pic: FALLBACK_PIC,
    vod_remarks: `[${item.source_name || '未知'}]`,
  }));
  return jsonify({ list: cards });
}

// 其他接口可以保持简单或暂不实现
async function init(cfg) { return await getConfig(); }
async function home(filter) { const c = JSON.parse(await getConfig()); return jsonify({ class: c.tabs, filters: {} }); }
async function category(tid, pg) { return await getCards({ id: tid, page: pg || 1 }); }
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id) { return jsonify({ url: id }); }

// 导出
if (typeof globalThis !== 'undefined') {
  globalThis.init = init; globalThis.home = home; globalThis.category = category;
  globalThis.detail = detail; globalThis.play = play; globalThis.search = search;
}
