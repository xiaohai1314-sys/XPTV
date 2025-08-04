/**
 * 海绵小站前端插件 - v8.5 (最终安全交互版 - 真正完整版)
 * 
 * 更新日志:
 * - 【v8.5 完整性修正】恢复所有被意外删节的函数实现，确保代码的完整性和可测试性。
 * - 【v8.5 架构坚持】在确认了海绵小站的独特复杂性后，坚定地回归至“后端Puppeteer+前端交互”的唯一正确架构。
 * - 【v8.5 安全提示】采用最安全、最不可能出错的 `showToast` 作为主要的用户提示方式，并结合15秒的等待时间，给予用户充足的操作窗口，旨在解决前端白屏问题。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.10.111:3002/api'; 
let userCredentials = { username: '', password: '' };
let currentSessionId = null;

// --- 核心辅助函数 ---
function log(msg ) { try { $log(`[海绵小站插件] ${msg}`); } catch (_) { console.log(`[海绵小站插件] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 【改造】最安全的用户交互函数 ---
async function handleVerification(verificationData) {
    log(`⚠️ 需要人机协作: ${verificationData.message}`);
    currentSessionId = verificationData.sessionId;
    const toastMessage = `需要手动验证！请在电脑浏览器完成【${verificationData.verificationType === 'slide_puzzle' ? '滑动拼图' : '旋转图片'}】操作。程序将等待15秒后自动继续。`;

    // 方案A: 优先尝试使用 $utils.toastError (从“云巢”脚本学到)
    if (typeof $utils !== 'undefined' && typeof $utils.toastError === 'function') {
        log("检测到 '$utils.toastError'，将使用Toast进行提示。");
        // toastError通常不需要await，且可以指定显示时长
        $utils.toastError(toastMessage, 5000); // 显示5秒
    } 
    // 方案B: 备用方案 xptv.showToast
    else if (typeof xptv !== 'undefined' && typeof xptv.showToast === 'function') {
        log("检测到 'xptv.showToast'，将使用Toast进行提示。");
        await xptv.showToast(toastMessage);
    } 
    // 方案C: 最终降级
    else {
        log("警告: 所有Toast函数均不可用。将进行静默等待。请留意日志。");
    }

    // 给予用户充足的操作时间
    log("开始15秒等待，请在电脑上完成验证...");
    await new Promise(resolve => setTimeout(resolve, 15000));
    log("等待结束，通知后端检查结果...");

    const verifySuccess = await verify(currentSessionId);
    return verifySuccess;
}

// --- 【核心请求和登录函数】 ---
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
        // 注意：这里我们不关心成功的返回，因为登录流程很可能会被409验证拦截
        await $fetch.post(`${API_BASE_URL}/login`, { username, password }, { headers: { 'Content-Type': 'application/json' } });
        // 如果代码能走到这里，说明登录无需验证就成功了（不太可能，但做兼容）
        return true; 
    } catch (error) {
        log(`登录请求异常: ${error.message}`);
        // 核心逻辑：捕获409错误
        if (error.response && error.response.status === 409) {
            const errorData = JSON.parse(error.response.data);
            if (errorData.needsVerification) {
                // 将验证流程交给handleVerification处理
                return await handleVerification(errorData);
            }
        }
        // 其他类型的错误，视为登录失败
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
            if (typeof $utils !== 'undefined' && typeof $utils.toastError === 'function') {
                $utils.toastError("验证失败: " + data.message);
            }
            return false;
        }
    } catch (error) {
        log(`验证请求异常: ${error.message}`);
        return false;
    }
}

// --- 【所有原始功能函数，完整实现】 ---

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  const appConfig = {
    ver: 1,
    title: '海绵小站',
    site: API_BASE_URL, // site字段对于此架构无实际意义，但保留
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
  // 在需要时设置用户凭证
  userCredentials.username = "1083328569@qq.com"; // 【需替换】
  userCredentials.password = "xiaohai1314"; // 【需替换】

  ext = argsify(ext);
  const { page = 1, id } = ext;
  log(`获取分类数据: id=${id}, page=${page}`);
  
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url); // 使用我们带重试和验证处理的request函数

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
        let dataPacket = parts[1];
        let pureLink = '';
        let accessCode = '';
        
        const match = dataPacket.match(/(https?:\/\/[^\s（(]+ )[\s（(]+访问码[：:]+([^）)]+)/);
        
        if (match && match.length === 3) {
          pureLink = match[1].trim();
          accessCode = match[2].trim();
        } else {
          pureLink = dataPacket.trim();
        }

        tracks.push({
          name: fileName,
          pan: pureLink,
          ext: { pwd: accessCode },
        });
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

// --- 兼容旧版 XPTV App 接口 (完全保留) ---
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

log('海绵小站插件加载完成 (V8.5 - 最终安全交互版)');
