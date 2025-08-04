/**
 * 海绵小站前端插件 - v8.2 (人机协作修正版)
 * 
 * 更新日志:
 * - 【v8.2 核心修正】修复了“双重验证”和“前端静默失败”的问题。
 * - 【v8.2 交互优化】当后端需要手动验证时，不再使用固定的8秒等待，而是弹出一个对话框，等待用户在浏览器中完成操作后，点击“我已完成验证”按钮，真正实现了人机协作。
 * - 【v8.2 兼容性】保留了所有原始函数 (getConfig, getTracks, search, init, home 等) 的完整性，确保功能无删减。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.10.111:3002/api'; 
let userCredentials = { username: '', password: '' }; // 用于存储用户凭证
let currentSessionId = null; // 用于存储待验证的会话ID
// --- 配置区 ---

// --- 核心辅助函数 (来自您的原始脚本  ，未作更改) ---
function log(msg) {
  try { $log(`[海绵小站插件] ${msg}`); } catch (_) { console.log(`[海绵小站插件] ${msg}`); }
}

function argsify(ext) {
    if (typeof ext === 'string') {
        try {
            return JSON.parse(ext);
        } catch (e) {
            return {};
        }
    }
    return ext || {};
}

function jsonify(data) {
    return JSON.stringify(data);
}

// --- 【新增】人机协作处理函数 ---
async function handleVerification(verificationData) {
    log(`⚠️ 需要人机协作: ${verificationData.message}`);
    currentSessionId = verificationData.sessionId;

    // 弹出一个模态对话框，等待用户确认
    // 这是实现真正人机协作的关键！
    const modalPayload = {
        title: "需要手动验证",
        content: `请在运行后端服务的电脑上，打开浏览器窗口，手动完成【${verificationData.verificationType === 'slide_puzzle' ? '滑动拼图' : '旋转图片'}】验证，然后点击下方的“我已完成”按钮。`,
        buttons: [{ text: "我已完成验证", action: "continue" }]
    };

    try {
        // 使用 xptv.showModal 来显示对话框并等待用户操作
        // 这会暂停代码执行，直到用户点击按钮
        await xptv.showModal(jsonify(modalPayload));
        log("✅ 用户已确认完成操作，将通知后端进行检查...");
        
        // 用户点击后，我们才调用 verify 函数
        const verifySuccess = await verify(currentSessionId);
        return verifySuccess;

    } catch (e) {
        log(`模态框显示或用户操作被取消: ${e.message}`);
        return false;
    }
}


// --- 【改造】核心请求函数，集成新的人机协作流程 ---
async function request(url, options = {}, isRetry = false) {
  log(`发起请求: ${url}`);
  try {
    const response = await $fetch.get(url, { headers: { 'Accept': 'application/json' }, timeout: 45000 });
    
    if (response.status === 401 && !isRetry) {
        log("会话失效或未登录，将尝试自动登录。");
        if (!userCredentials.username || !userCredentials.password) {
            log("错误：请先在插件设置中填写账号密码。");
            throw new Error("用户未登录，且没有可用凭证。");
        }
        const loginSuccess = await login(userCredentials.username, userCredentials.password);
        if (loginSuccess) {
            log("重新登录成功，重试原始请求...");
            return await request(url, options, true);
        } else {
            log("重新登录失败。");
            throw new Error("登录失败，无法完成请求。");
        }
    }
    
    if (response.status === 409) {
        const data = JSON.parse(response.data);
        const verificationSuccess = await handleVerification(data);
        if(verificationSuccess) {
            log("验证流程成功，重试原始请求...");
            return await request(url, options, true);
        } else {
            throw new Error("验证失败或被用户取消，无法完成请求。");
        }
    }

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

// --- 【改造】登录函数，集成新的人机协作流程 ---
async function login(username, password) {
    log(`尝试登录: ${username}`);
    try {
        const response = await $fetch.post(`${API_BASE_URL}/login`, { username, password }, { headers: { 'Content-Type': 'application/json' } });
        const data = JSON.parse(response.data);

        if (data.success) {
            log("登录成功！");
            return true;
        } 
        // 注意：理论上，成功的登录流程也会被验证拦截，所以主要处理catch块
        return false;

    } catch (error) {
        log(`登录请求异常: ${error.message}`);
        try {
            // 检查是否是需要验证的特定错误 (409 Conflict)
            if (error.response && error.response.status === 409) {
                const errorData = JSON.parse(error.response.data);
                if (errorData.needsVerification) {
                    // 调用统一的验证处理函数
                    return await handleVerification(errorData);
                }
            }
        } catch (e) {
            log(`解析登录错误响应失败: ${e.message}`);
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
            // 如果验证失败，也可以弹窗提示用户
            await xptv.showToast("验证失败: " + data.message);
            return false;
        }
    } catch (error) {
        log(`验证请求异常: ${error.message}`);
        return false;
    }
}


// --- XPTV App 插件入口函数 (完全保留原始结构) ---

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
  // 【重要】实际使用时，请确保在此之前通过某种方式（如设置页面）填充了账号密码
  userCredentials.username = "1083328569@qq.com"; // 【需替换】
  userCredentials.password = "xiaohai1314"; // 【需替换】

  ext = argsify(ext);
  const { page = 1, id } = ext;
  log(`获取分类数据: id=${id}, page=${page}`);
  
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url); // 使用新的request函数

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
  const data = await request(detailUrl); // 使用新的request函数

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
  const data = await request(url); // 使用新的request函数

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

log('海绵小站插件加载完成 (V8.2 - 人机协作修正版)');
