/**
 * XPTV App 插件前端代码 (最终整合版 - 2025-07-16)
 * 
 * 整合所有优化点:
 * 1. [已修复] 修复 play 函数的致命语法错误。
 * 2. [已优化] getTracks 函数简化了链接处理逻辑，直接使用后端拼接好的结果。
 * 3. [已强化] play 函数增加对URL的“极致净化”逻辑，确保传递给App的链接100%纯净，解决“分享不存在”问题。
 * 4. [已保留] 完整的用户交互提示和剪贴板功能。
 * 5. [已保留] 对新旧版 XPTV App 接口的完全兼容。
 */

// --- 配置区 ---
// 请确保此地址对于运行 App 的设备是可访问的（例如，在同一局域网内）
const API_BASE_URL = 'http://192.168.1.6:3000/api'; 
// --- 配置区 ---

// --- 模拟 XPTV App 环境函数 (用于本地浏览器测试) ---
try {
  $log;
} catch (e) {
  var $log = console.log;
  var $fetch = { get: async (url) => { const res = await fetch(url); return { status: res.status, data: await res.text() }; } };
  var $clipboard = { set: (text) => { navigator.clipboard.writeText(text); console.log('Copied to clipboard:', text); } };
  var argsify = (str) => JSON.parse(str);
  var jsonify = (obj) => JSON.stringify(obj);
}
// --- 模拟函数结束 ---

function log(msg) {
  $log(`[网盘资源社插件] ${msg}`);
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

// --- XPTV App 插件核心函数 ---

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  return jsonify({
    ver: 1,
    title: '网盘资源社',
    site: API_BASE_URL,
    tabs: [
      { name: '影视/剧集', ext: { id: 'forum-1.htm' } },
      { name: '4K专区', ext: { id: 'forum-12.htm' } },
      { name: '动漫区', ext: { id: 'forum-3.htm' } },
      { name: '教程/书籍', ext: { id: 'forum-8.htm' } },
    ],
  });
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

  if (data.error) {
    return jsonify({ list: [{ title: '获取失败', tracks: [{ name: '网络错误或解析失败', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  if (data.list && data.list.length > 0) {
    const detailItem = data.list[0];
    if (detailItem.vod_play_url && detailItem.vod_play_url !== '暂无有效网盘链接') {
      const playUrls = detailItem.vod_play_url.split('$$$');
      playUrls.forEach((fullUrlString, index) => {
        if (fullUrlString && fullUrlString.trim()) {
          let panName = `网盘 ${index + 1}`;
          if (fullUrlString.includes('quark')) panName = `夸克网盘 ${index + 1}`;
          else if (fullUrlString.includes('baidu')) panName = `百度网盘 ${index + 1}`;
          else if (fullUrlString.includes('alipan')) panName = `阿里云盘 ${index + 1}`;
          else if (fullUrlString.includes('115')) panName = `115网盘 ${index + 1}`;
          
          const passCodeMatch = fullUrlString.match(/(?:提取码|pwd|code)\s*[:：\s]*\s*([a-zA-Z0-9]+)/i);
          if (passCodeMatch && passCodeMatch[1]) {
            panName += ` [码:${passCodeMatch[1]}]`;
          }
          
          tracks.push({ name: panName, pan: fullUrlString.trim(), ext: {} });
          log(`添加网盘链接: ${panName}`);
        }
      });
    }
  }

  if (tracks.length === 0) {
      tracks.push({ name: '暂无有效资源', pan: '', ext: {} });
      log('该帖子解析后无有效网盘链接');
  }

  log(`成功处理 ${tracks.length} 个播放链接`);
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
    ext: { url: item.vod_id },
  }));

  log(`搜索成功，找到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}

async function play(flag, id, ext) {
    log(`处理链接: ${id}`);

    const initialMatch = id.match(/https?:\/\/[a-zA-Z0-9.\/_-]+/);
    if (!initialMatch) {
        log(`错误: 无法从ID[${id}]中初步提取有效URL`);
        return jsonify({ parse: 0, url: '', ext: { tip: '链接格式错误，无法打开。' } });
    }
    let urlToProcess = initialMatch[0];
    log(`初步提取URL: ${urlToProcess}`);

    let finalPureUrl = urlToProcess;
    const patterns = [
        /(https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+)/,
        /(https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+)/,
        /(https?:\/\/www\.alipan\.com\/s\/[a-zA-Z0-9]+)/,
    ];

    for (const pattern of patterns) {
        const strictMatch = urlToProcess.match(pattern);
        if (strictMatch && strictMatch[1]) {
            finalPureUrl = strictMatch[1];
            log(`净化成功，最终URL: ${finalPureUrl}`);
            break;
        }
    }
    
    const passCodeMatch = id.match(/(?:提取码|访问码|密码|pwd|code)[:：\s]*([a-zA-Z0-9]+)/i);
    const code = passCodeMatch ? passCodeMatch[1] : '';

    const result = {
        parse: 0,
        url: finalPureUrl,
        ext: {
            isPan: true,
            panType: getPanType(finalPureUrl),
            code: code,
            tip: code 
                ? `链接已在浏览器中打开。\n提取码 [ ${code} ] 已复制到剪贴板，请手动粘贴。`
                : '链接已在浏览器中打开。'
        }
    };
  
    try {
        if (code) {
            $clipboard.set(code); 
            log(`已将提取码复制到剪贴板: ${code}`);
        } else {
            $clipboard.set(finalPureUrl);
            log(`已将链接复制到剪贴板: ${finalPureUrl}`);
        }
    } catch(e) {
        log('剪贴板功能不可用，仅返回数据。');
    }

    log(`返回最终处理结果: ${JSON.stringify(result)}`);
    return jsonify(result);
}

function getPanType(url) {
  if (url.includes('quark')) return 'quark';
  if (url.includes('baidu')) return 'baidu';
  if (url.includes('alipan')) return 'ali';
  if (url.includes('115')) return '115';
  return 'other';
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
  return getCards(jsonify({ id: id, page: pg })); 
}
async function detail(id) { return getTracks(jsonify({ url: id })); }

log('网盘资源社插件加载完成 (最终整合版)');


