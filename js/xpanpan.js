/**
 * XPTV App 插件前端代码 (最终修复版)
 * 
 * 功能:
 * - 与后端API交互，获取网盘资源社的内容
 * - 支持分类浏览、搜索、详情查看
 * - 智能识别网盘类型并显示提取码
 * 
 * 最终版本优化:
 * 1. 【修复】getTracks函数能正确分离后端传来的“链接 (提取码: XXX)”格式，保证点击跳转的URL纯净有效。
 * 2. 【优化】增强了错误处理和用户体验，即使解析失败也有友好提示。
 * 3. 【兼容】支持多种网盘类型的识别和显示。
 */

// --- 配置区 ---
const API_BASE_URL = "http://192.168.10.111:3000/api"; // 【重要】请务必替换为你的后端服务实际地址
// --- 配置区 ---

// 假设的 XPTV App 环境函数
function log(msg) { try { $log(`[网盘资源社] ${msg}`); } catch (_) { console.log(`[网盘资源社] ${msg}`); } }
function jsonify(data) { return JSON.stringify(data); }
function argsify(ext) { if (typeof ext === "string") { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
async function request(url) {
  log(`发起请求: ${url}`);
  try {
    // 假设 $fetch.get 是 App 提供的原生请求方法
    const response = await $fetch.get(url, { headers: { "Accept": "application/json" }, timeout: 45000 });
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
  return jsonify({
    ver: 1,
    title: "网盘资源社",
    site: API_BASE_URL, // site 字段通常不直接使用，但按规范保留
    cookie: "",
    tabs: [
      { name: "影视/剧集", ext: { id: "forum-1.htm" } },
      { name: "4K专区", ext: { id: "forum-12.htm" } },
      { name: "动漫区", ext: { id: "forum-3.htm" } },
      { name: "教程/书籍", ext: { id: "forum-8.htm" } },
      { name: "综艺娱乐", ext: { id: "forum-2.htm" } },
      { name: "音乐MV", ext: { id: "forum-4.htm" } }
    ],
  });
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
    vod_pic: item.vod_pic || "",
    vod_remarks: "",
    ext: { url: item.vod_id },
  }));

  log(`成功处理 ${cards.length} 条分类数据`);
  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) {
    log("获取详情失败: 缺少URL参数");
    return jsonify({ list: [] });
  }

  log(`获取详情数据: url=${url}`);
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  if (data.error) {
    log(`获取详情数据失败: ${data.message}`);
    return jsonify({ list: [{ title: "获取失败", tracks: [{ name: "网络错误或解析失败", pan: "", ext: {} }] }] });
  }

  const tracks = [];
  if (data.list && data.list.length > 0) {
    const detailItem = data.list[0];
    if (detailItem.vod_play_url && detailItem.vod_play_url !== "暂无有效网盘链接") {
      const playUrls = detailItem.vod_play_url.split("$$$");
      
      playUrls.forEach((playUrl, index) => {
        if (!playUrl.trim()) return;

        let cleanUrl = playUrl.trim();
        let passCode = "";

        // 使用正则分离链接和提取码，格式为 "链接 (提取码: XXX)"
        const passCodeMatch = cleanUrl.match(/^(https?:\/\/[^\s]+)\s*\(提取码:\s*([a-zA-Z0-9]+)\)$/);
        
        if (passCodeMatch && passCodeMatch[1] && passCodeMatch[2]) {
          cleanUrl = passCodeMatch[1].trim(); // 纯净的链接
          passCode = passCodeMatch[2];       // 提取码
        }
        
        let panName = `网盘 ${index + 1}`;
        if (cleanUrl.includes("quark")) panName = `夸克网盘 ${index + 1}`;
        else if (cleanUrl.includes("baidu")) panName = `百度网盘 ${index + 1}`;
        else if (cleanUrl.includes("alipan")) panName = `阿里云盘 ${index + 1}`;
        
        if (passCode) panName += ` [码:${passCode}]`;
        
        tracks.push({
          name: panName,
          pan: cleanUrl, // 【关键】用于跳转的纯净链接
          ext: {},
        });
        log(`添加网盘链接: ${panName}, URL: ${cleanUrl}`);
      });
    }
  }

  if (tracks.length === 0) {
    tracks.push({ name: "暂无有效资源", pan: "", ext: {} });
    log("该帖子未解析到有效的网盘链接");
  }

  log(`成功处理 ${tracks.length} 个播放链接`);
  return jsonify({ list: [{ title: "资源列表", tracks }] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || "";
  if (!text) {
    log("搜索失败: 缺少关键词");
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
    vod_pic: item.vod_pic || "",
    vod_remarks: "",
    ext: { url: item.vod_id },
  }));

  log(`搜索成功，找到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}

// --- 兼容旧版 XPTV App 接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === "object" ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log("网盘资源社插件加载完成 (最终修复版)");


