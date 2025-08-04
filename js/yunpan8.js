/**
 * haimianxz-frontend (V8.2 - 人机协作优化版)
 * 
 * 更新日志:
 * - 【v8.2 核心优化】修改了 login 函数的错误处理逻辑，使其能够直接响应后端触发验证码后返回的409状态，并立即调用验证处理函数，完美适配最新的人机协作流程。
 * - 【v8.2 承诺】此版本为可以直接使用的、与后端V75.9配套的完整前端文件。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.10.111:3002/api'; 
// --- 配置区 ---

// --- 全局状态 ---
let userCredentials = { username: '', password: '' };
let verificationSession = { sessionId: null };
let isVerifying = false;

// --- 模拟App环境函数 ---
function log(msg ) { try { $log(`[海绵小站插件] ${msg}`); } catch (_) { console.log(`[海绵小站插件] ${msg}`); } }
function jsonify(data) { return JSON.stringify(data); }
function argsify(str) { try { return JSON.parse(str); } catch (e) { return {}; } }
async function request(url, options = {}) {
    log(`发起请求: ${url}`);
    try {
        const response = await $fetch.get(url, { headers: { 'Accept': 'application/json' }, timeout: 45000, ...options });
        if (response.status >= 400) {
            let errorData;
            try {
                errorData = JSON.parse(response.data);
            } catch (e) {
                errorData = { message: `HTTP错误! 状态: ${response.status}` };
            }
            throw { status: response.status, data: errorData };
        }
        const data = JSON.parse(response.data);
        log(`请求成功, 收到 ${data.list?.length || 0} 条数据`);
        return { status: response.status, data: data };
    } catch (error) {
        log(`请求失败: ${error.status ? `状态 ${error.status}, 信息: ${error.data?.message}` : error.message}`);
        return { error: true, status: error.status || 500, data: error.data || { message: error.message } };
    }
}
async function postRequest(url, body) {
    log(`发起POST请求: ${url}`);
    try {
        const response = await $fetch.post(url, { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, timeout: 45000 });
        if (response.status >= 400) {
            let errorData;
            try {
                errorData = JSON.parse(response.data);
            } catch (e) {
                errorData = { message: `HTTP错误! 状态: ${response.status}` };
            }
            throw { status: response.status, data: errorData };
        }
        const data = JSON.parse(response.data);
        log(`POST请求成功`);
        return { status: response.status, data: data };
    } catch (error) {
        log(`POST请求失败: ${error.status ? `状态 ${error.status}, 信息: ${error.data?.message}` : error.message}`);
        return { error: true, status: error.status || 500, data: error.data || { message: error.message } };
    }
}
function showModal(title, content, buttons) {
    try {
        $ui.showModal({ title, content, buttons });
    } catch (e) {
        // 降级处理：在浏览器环境中模拟
        const buttonText = buttons.map(b => b.title).join('\n');
        alert(`${title}\n\n${content}\n\n可选操作:\n${buttonText}`);
    }
}

// --- 登录与验证核心逻辑 ---
async function handleVerification(verificationData) {
    isVerifying = true;
    verificationSession.sessionId = verificationData.sessionId;
    showModal(
        '需要手动验证',
        `后端需要您手动操作以继续。\n\n操作类型: ${verificationData.message}\n\n请在电脑上弹出的浏览器窗口中完成操作，然后点击下方的“我已完成”按钮。`,
        [{
            title: '我已完成验证',
            onClick: async () => {
                log('用户点击 "我已完成验证"，通知后端...');
                const res = await postRequest(`${API_BASE_URL}/verify`, { sessionId: verificationSession.sessionId });
                if (res.error) {
                    if (res.status === 409) { // 可能需要多轮验证
                        log('需要新一轮验证...');
                        handleVerification(res.data);
                    } else {
                        showModal('验证失败', `后端返回错误: ${res.data.message}`, [{ title: '好的' }]);
                        isVerifying = false;
                    }
                } else {
                    showModal('登录成功', '您已成功登录，可以正常使用插件了。', [{ title: '太棒了！' }]);
                    isVerifying = false;
                }
            }
        }]
    );
}

async function login() {
    if (!userCredentials.username || !userCredentials.password) {
        log("用户名或密码未设置，跳过登录。");
        return { error: true, message: "用户名或密码未设置" };
    }
    log(`尝试使用账号 ${userCredentials.username} 登录...`);
    const res = await postRequest(`${API_BASE_URL}/login`, userCredentials);
    if (res.error) {
        // 【V8.2 核心修正点】直接处理后端返回的409验证请求
        if (res.status === 409 && res.data.needsVerification) {
            log("收到后端的验证请求，转交用户处理...");
            handleVerification(res.data);
            return { needsVerification: true };
        }
        log(`登录失败: ${res.data.message}`);
        return { error: true, message: res.data.message };
    }
    log("登录成功！");
    return { success: true };
}

async function ensureLoggedIn(apiCall) {
    if (isVerifying) {
        log("正在验证中，请稍候...");
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '正在等待您手动验证，请完成后再试', pan: '', ext: {} }] }] });
    }
    try {
        return await apiCall();
    } catch (error) {
        if (error.status === 401) {
            log("会话失效或未登录，尝试重新登录...");
            const loginResult = await login();
            if (loginResult.success) {
                log("重新登录成功，重试API调用...");
                return await apiCall();
            } else if (loginResult.needsVerification) {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: '需要您手动验证后才能继续', pan: '', ext: {} }] }] });
            } else {
                return jsonify({ list: [{ title: '错误', tracks: [{ name: `登录失败: ${loginResult.message}`, pan: '', ext: {} }] }] });
            }
        }
        // 【V8.2 核心修正点】处理在调用普通API时，后端也可能要求验证的情况
        if (error.status === 409 && error.data.needsVerification) {
            log("API调用期间收到验证请求...");
            handleVerification(error.data);
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '需要您手动验证后才能继续', pan: '', ext: {} }] }] });
        }
        log(`API调用捕获到未知错误: ${error.data?.message || error.message}`);
        throw error;
    }
}

// --- XPTV App 插件入口函数 (完整无缺) ---

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
    ext = argsify(ext);
    // 【重要】实际使用时，请确保在此之前通过某种方式（如设置页面）填充了账号密码
    userCredentials.username = "1083328569@qq.com"; // 【需替换】
    userCredentials.password = "xiaohai1314"; // 【需替换】

    return await ensureLoggedIn(async () => {
        const { page = 1, id } = ext;
        log(`获取分类数据: id=${id}, page=${page}`);
        const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
        const res = await request(url);
        if (res.error) throw { status: res.status, data: res.data };

        const cards = (res.data.list || []).map(item => ({
            vod_id: item.vod_id,
            vod_name: item.vod_name,
            vod_pic: item.vod_pic || '',
            vod_remarks: item.vod_remarks || '',
            ext: { url: item.vod_id },
        }));
        log(`成功处理 ${cards.length} 条分类数据`);
        return jsonify({ list: cards });
    });
}

async function getTracks(ext) {
    ext = argsify(ext);
    return await ensureLoggedIn(async () => {
        const { url } = ext;
        if (!url) {
            log('获取详情失败: 缺少URL参数');
            return jsonify({ list: [] });
        }
        log(`获取详情数据: url=${url}`);
        const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
        const res = await request(detailUrl);
        if (res.error) throw { status: res.status, data: res.data };

        const tracks = [];
        const detailItem = res.data.list[0];
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
                    const match = dataPacket.match(/(https?:\/\/[^\s（(]+ )[\s（(]+(?:访问码|提取码|密码)[：:]+([^）)]+)/);
                    if (match && match.length === 3) {
                        pureLink = match[1].trim();
                        accessCode = match[2].trim();
                    } else {
                        pureLink = dataPacket.trim();
                    }
                    tracks.push({ name: fileName, pan: pureLink, ext: { pwd: accessCode } });
                    log(`已分离 -> 文件名: ${fileName}, 纯链接: ${pureLink}, 访问码: ${accessCode}`);
                }
            });
        }
        if (tracks.length === 0) {
            tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} });
            log('该帖子不含有效链接或所有链接解析失败');
        }
        log(`成功处理 ${tracks.length} 个播放链接`);
        return jsonify({ list: [{ title: '云盘', tracks }] });
    });
}

async function search(ext) {
    ext = argsify(ext);
    return await ensureLoggedIn(async () => {
        const text = ext.text || '';
        if (!text) {
            log('搜索失败: 缺少关键词');
            return jsonify({ list: [] });
        }
        log(`执行搜索: keyword=${text}`);
        const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
        const res = await request(url);
        if (res.error) throw { status: res.status, data: res.data };

        const cards = (res.data.list || []).map(item => ({
            vod_id: item.vod_id,
            vod_name: item.vod_name,
            vod_pic: item.vod_pic || '',
            vod_remarks: '',
            ext: { url: item.vod_id },
        }));
        log(`搜索成功，找到 ${cards.length} 条结果`);
        return jsonify({ list: cards });
    });
}

// --- 兼容旧版 XPTV App 接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v8.2)');
