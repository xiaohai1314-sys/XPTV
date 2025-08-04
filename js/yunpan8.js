/**
 * 海绵小站前端插件 - v8.1 (终极完整校对版)
 * 
 * 更新日志:
 * - 【v8.1 完整性】根据用户要求，已将所有原始函数 (getConfig, getTracks, search, init, home 等) 完整恢复，确保功能无删减。
 * - 【v8.1 精确改造】仅对核心的 request 函数进行改造，并新增 login/verify 函数，以支持新的登录验证流程。
 * - 【v8.1 最终版】此版本为新登录逻辑与原始前端功能的最终、完整合并版，确保了最大的兼容性和功能的完整性。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.10.111:3002/api'; 
let userCredentials = { username: '', password: '' }; // 用于存储用户凭证
let currentSessionId = null; // 用于存储待验证的会话ID
// --- 配置区 ---

// --- 核心辅助函数 (来自您的原始脚本 ，未作更改) ---
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

// --- 【改造】核心请求函数，增加登录和验证处理 ---
async function request(url, options = {}, isRetry = false) {
  log(`发起请求: ${url}`);
  try {
    // 使用 $fetch.get 发起请求
    const response = await $fetch.get(url, { headers: { 'Accept': 'application/json' }, timeout: 45000 });
    
    // 检查HTTP状态码
    if (response.status === 401 && !isRetry) {
        log("会话失效或未登录，将尝试自动登录。");
        if (!userCredentials.username || !userCredentials.password) {
            log("错误：请先在插件设置中填写账号密码。");
            throw new Error("用户未登录，且没有可用凭证。");
        }
        const loginSuccess = await login(userCredentials.username, userCredentials.password);
        if (loginSuccess) {
            log("重新登录成功，重试原始请求...");
            return await request(url, options, true); // 登录成功后重试
        } else {
            log("重新登录失败。");
            throw new Error("登录失败，无法完成请求。");
        }
    }
    
    if (response.status === 409) {
        log("⚠️ 请求被拦截，需要进行人机验证。");
        const data = JSON.parse(response.data);
        log(`验证类型: ${data.verificationType || '未知'}, 消息: ${data.message}`);
        log("请在后端服务器的浏览器窗口中手动完成验证，然后在App中点击“我已完成”之类的按钮来继续。");
        currentSessionId = data.sessionId;
        // 实际应用中，这里应弹出一个对话框，让用户确认操作完成后再继续
        // 此处用延时模拟用户操作
        await new Promise(resolve => setTimeout(resolve, 8000)); // 给予用户8秒操作时间
        const verifySuccess = await verify(currentSessionId);
        if(verifySuccess) {
            return await request(url, options, true); // 验证成功后重试
        } else {
            throw new Error("验证失败，无法完成请求。");
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

// --- 【新增】登录与验证函数 ---
async function login(username, password) {
    log(`尝试登录: ${username}`);
    try {
        const response = await $fetch.post(`${API_BASE_URL}/login`, { username, password }, { headers: { 'Content-Type': 'application/json' } });
        const data = JSON.parse(response.data);

        if (data.success) {
            log("登录成功！");
            return true;
        } else if (data.needsVerification) {
            log(`登录需要验证: ${data.message}`);
            log("请在后端服务器的浏览器窗口中手动完成验证，然后继续。");
            currentSessionId = data.sessionId;
            await new Promise(resolve => setTimeout(resolve, 8000));
            return await verify(currentSessionId);
        } else {
            log(`登录失败: ${data.message}`);
            return false;
        }
    } catch (error) {
        log(`登录请求异常: ${error.message}`);
        try {
            const errorData = JSON.parse(error.response.data);
            if (errorData.needsVerification) {
                log(`登录需要验证: ${errorData.message}`);
                log("请在后端服务器的浏览器窗口中手动完成验证，然后继续。");
                currentSessionId = errorData.sessionId;
                await new Promise(resolve => setTimeout(resolve, 8000));
                return await verify(currentSessionId);
            }
        } catch (e) {}
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

log('海绵小站插件加载完成 (V8.1 - 终极完整版)');
