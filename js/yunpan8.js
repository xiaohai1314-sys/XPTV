/**
 * 海绵小站前端插件 - v8.4 (终极交互修正版)
 * 
 * 更新日志:
 * - 【v8.4 架构回归】确认并回归至V8.x的“前后端分离”架构，以支持自动回帖和复杂解析等高级功能。
 * - 【v8.4 交互修正】解决了前端白屏的最终问题。新的 `showUserInteraction` 函数将优先尝试使用从“玩偶哥哥”脚本中得到的 `$utils.openSafari` 函数来提示用户。
 * - 【v8.4 优雅降级】如果 `$utils.openSafari` 不可用，会依次尝试 `xptv.showModal` 和 `xptv.showToast`，确保在任何情况下都不会白屏，并提供清晰的日志。
 * - 【v8.4 目标】此版本旨在完美结合后端的强大功能与前端的正确交互，提供最终的、可工作的解决方案。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.10.111:3002/api'; 
let userCredentials = { username: '', password: '' };
let currentSessionId = null;
// --- 配置区 ---

// --- 核心辅助函数 (未作更改 ) ---
function log(msg) { try { $log(`[海绵小站插件] ${msg}`); } catch (_) { console.log(`[海绵小站插件] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 【新增】终极版的用户交互函数 ---
async function showUserInteraction(verificationData) {
    const message = `请在运行后端服务的电脑上，打开浏览器窗口，手动完成【${verificationData.verificationType === 'slide_puzzle' ? '滑动拼图' : '旋转图片'}】验证。`;
    
    // 方案A: 尝试使用从“玩偶哥哥”脚本学到的 `$utils.openSafari`
    // 虽然它叫 openSafari，但在这里我们用它来显示一个提示页，因为它能强制用户看到信息。
    // 我们将提示信息编码到URL中，让它在WebView中显示出来。
    if (typeof $utils !== 'undefined' && typeof $utils.openSafari === 'function') {
        log("检测到 '$utils.openSafari'，将使用该函数进行交互提示。");
        const htmlContent = `
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>手动验证提示</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; text-align: center; background-color: #f0f0f0; }
                        .container { background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                        h2 { color: #333; }
                        p { color: #555; line-height: 1.6; }
                        .button { display: inline-block; padding: 12px 25px; background-color: #007aff; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>需要您手动操作</h2>
                        <p>${message}</p>
                        <p>完成后，请关闭此窗口，程序将自动继续。</p>
                        <a href="#" onclick="window.close();" class="button">我已完成，关闭窗口</a>
                    </div>
                </body>
            </html>`;
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
        await $utils.openSafari(dataUrl, 'Mozilla/5.0');
        return; // 成功，直接返回
    }

    // 方案B: 尝试使用 showModal (原始方案)
    if (typeof xptv !== 'undefined' && typeof xptv.showModal === 'function') {
        log("警告: '$utils.openSafari' 不可用，回退到 'xptv.showModal'。");
        const modalPayload = { title: "需要手动验证", content: message + "\n\n完成后，请点击下方的按钮。", buttons: [{ text: "我已完成验证", action: "continue" }] };
        await xptv.showModal(jsonify(modalPayload));
        return;
    }

    // 方案C: 尝试使用 showToast (次级降级)
    if (typeof xptv !== 'undefined' && typeof xptv.showToast === 'function') {
        log("警告: '$utils' 和 'xptv.showModal' 均不可用，回退到 'xptv.showToast'。");
        await xptv.showToast("需要手动验证！请在电脑完成操作后等待15秒。");
        await new Promise(resolve => setTimeout(resolve, 15000));
        return;
    }

    // 方案D: 最终降级 (确保不崩溃)
    log("严重警告: 所有交互函数均不可用！将采用15秒静默等待。请立即在电脑上完成验证！");
    await new Promise(resolve => setTimeout(resolve, 15000));
}


// --- 【改造】人机协作处理函数，使用新的交互函数 ---
async function handleVerification(verificationData) {
    log(`⚠️ 需要人机协作: ${verificationData.message}`);
    currentSessionId = verificationData.sessionId;

    // 调用我们新的、终极版的交互函数
    await showUserInteraction(verificationData);

    log("✅ 用户已确认或等待超时，将通知后端进行检查...");
    const verifySuccess = await verify(currentSessionId);
    return verifySuccess;
}


// --- 【V8.3的核心请求和登录函数，逻辑正确，无需修改】 ---
async function request(url, options = {}, isRetry = false) {
  log(`发起请求: ${url}`);
  try {
    const response = await $fetch.get(url, { headers: { 'Accept': 'application/json' }, timeout: 45000 });
    if (response.status === 401 && !isRetry) {
        log("会话失效或未登录，将尝试自动登录。");
        if (!userCredentials.username || !userCredentials.password) throw new Error("用户未登录，且没有可用凭证。");
        const loginSuccess = await login(userCredentials.username, userCredentials.password);
        if (loginSuccess) return await request(url, options, true);
        throw new Error("登录失败，无法完成请求。");
    }
    if (response.status === 409) {
        const data = JSON.parse(response.data);
        const verificationSuccess = await handleVerification(data);
        if(verificationSuccess) return await request(url, options, true);
        throw new Error("验证失败或被用户取消，无法完成请求。");
    }
    if (response.status !== 200) throw new Error(`HTTP错误! 状态: ${response.status}`);
    const data = JSON.parse(response.data);
    if (data.error) throw new Error(`API返回错误: ${data.error}`);
    return data;
  } catch (error) {
    log(`请求失败: ${error.message}`);
    return { error: true, message: error.message, list: [] };
  }
}

async function login(username, password) {
    log(`尝试登录: ${username}`);
    try {
        await $fetch.post(`${API_BASE_URL}/login`, { username, password }, { headers: { 'Content-Type': 'application/json' } });
        return true; 
    } catch (error) {
        log(`登录请求异常: ${error.message}`);
        if (error.response && error.response.status === 409) {
            const errorData = JSON.parse(error.response.data);
            if (errorData.needsVerification) {
                return await handleVerification(errorData);
            }
        }
        return false;
    }
}

async function verify(sessionId) {
    log(`通知后端已完成验证, Session: ${sessionId}`);
    try {
        const response = await $fetch.post(`${API_BASE_URL}/verify`, { sessionId }, { headers: { 'Content-Type': 'application/json' } });
        const data = JSON.parse(response.data);
        if (data.success) {
            log("后端确认验证成功！");
            return true;
        } else {
            log(`后端确认验证失败: ${data.message}`);
            if (typeof xptv !== 'undefined' && typeof xptv.showToast === 'function') {
                await xptv.showToast("验证失败: " + data.message);
            }
            return false;
        }
    } catch (error) {
        log(`验证请求异常: ${error.message}`);
        return false;
    }
}


// --- 【所有原始功能函数，原封不动】 ---
async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  const appConfig = { ver: 1, title: '海绵小站', site: API_BASE_URL, cookie: '', tabs: [ { name: '电影', ext: { id: 'forum-1.htm' } }, { name: '剧集', ext: { id: 'forum-2.htm' } }, { name: '动漫', ext: { id: 'forum-3.htm' } }, { name: '综艺', ext: { id: 'forum-5.htm' } }, ], };
  return jsonify(appConfig);
}

async function getCards(ext) {
  userCredentials.username = "1083328569@qq.com";
  userCredentials.password = "xiaohai1314";
  ext = argsify(ext);
  const { page = 1, id } = ext;
  log(`获取分类数据: id=${id}, page=${page}`);
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);
  if (data.error) { log(`获取分类数据失败: ${data.message}`); return jsonify({ list: [] }); }
  const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic || '', vod_remarks: item.vod_remarks || '', ext: { url: item.vod_id }, }));
  log(`成功处理 ${cards.length} 条分类数据`);
  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) { log('获取详情失败: 缺少URL参数'); return jsonify({ list: [] }); }
  log(`获取详情数据: url=${url}`);
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);
  if (data.error || !data.list || data.list.length === 0) { log(`获取详情数据失败或内容为空: ${data.message || '无有效列表'}`); return jsonify({ list: [{ title: '云盘', tracks: [{ name: '获取资源失败或帖子无内容', pan: '', ext: {} }] }] }); }
  const tracks = [];
  const detailItem = data.list[0];
  if (detailItem.vod_play_url && detailItem.vod_play_url.trim() !== '' && detailItem.vod_play_url !== '暂无有效网盘链接') {
    const playUrls = detailItem.vod_play_url.split('$$$');
    playUrls.forEach((playUrl) => {
      if (playUrl.trim()) {
        const parts = playUrl.split('$');
        if (parts.length < 2) return;
        let fileName = parts[0]; let dataPacket = parts[1]; let pureLink = ''; let accessCode = '';
        const match = dataPacket.match(/(https?:\/\/[^\s（(]+ )[\s（(]+访问码[：:]+([^）)]+)/);
        if (match && match.length === 3) { pureLink = match[1].trim(); accessCode = match[2].trim(); } else { pureLink = dataPacket.trim(); }
        tracks.push({ name: fileName, pan: pureLink, ext: { pwd: accessCode }, });
      }
    });
  }
  if (tracks.length === 0) { tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} }); log('该帖子不含有效链接或所有链接解析失败'); }
  log(`成功处理 ${tracks.length} 个播放链接`);
  return jsonify({ list: [{ title: '云盘', tracks }] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) { log('搜索失败: 缺少关键词'); return jsonify({ list: [] }); }
  log(`执行搜索: keyword=${text}`);
  const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
  const data = await request(url);
  if (data.error) { log(`搜索失败: ${data.message}`); return jsonify({ list: [] }); }
  const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic || '', vod_remarks: '', ext: { url: item.vod_id }, }));
  log(`搜索成功，找到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}

async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (V8.4 - 终极交互修正版)');
