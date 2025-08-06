/**
 * 海绵小站前端插件 - v45.4 (后端日志调试版)
 * 
 * 更新日志:
 * - 【v45.4 调试版】此版本为解决根本问题而生，内置了强大的后端日志功能。
 * - 【后端日志】: 新增logToBackend函数，会将插件运行的每一步关键日志，实时发送到您指定的
 *   后端服务器。这使我们能清晰地看到插件内部的每一个变量和判断，从而精准定位问题。
 * - 【使用方法】: 1. 运行配套的Node.js后端服务器。 2. 将本插件中的 DEBUG_ENDPOINT 
 *   修改为您电脑的局域网IP和端口。 3. 在App中正常操作，然后在后端控制台查看实时日志。
 */

// ★★★★★【调试配置区】★★★★★
const DEBUG_MODE = true; // 总开关，设为false可关闭后端日志功能
const DEBUG_ENDPOINT = "http://192.168.10.111:3000/log"; // 【请修改为您后端的IP地址和端口】
// ★★★★★★★★★★★★★★★★★★★

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";

// --- 【核心改造】带后端功能的日志系统 ---
async function logToBackend(level, message ) {
    if (!DEBUG_MODE) return;
    try {
        // 使用$fetch.post发送日志，不等待返回结果，避免阻塞主流程
        $fetch.post(DEBUG_ENDPOINT, {
            level: level,
            message: message,
            timestamp: new Date().toISOString()
        }, { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        // 后端日志发送失败，在本地打印错误，但不影响插件运行
        console.log(`[LogBackend Error] ${e.message}`);
    }
}

function log(msg) { 
    const logMsg = `[海绵小站 V45.4 调试版] ${msg}`;
    try { 
        $log(logMsg); 
    } catch (_) { 
        console.log(logMsg); 
    }
    logToBackend('info', msg); // 将原始消息发送到后端
}

function logError(msg) {
    const logMsg = `[海绵小站 V45.4 调试版] [ERROR] ${msg}`;
     try { 
        $log(logMsg); 
    } catch (_) { 
        console.log(logMsg); 
    }
    logToBackend('error', msg);
}
// --- 其他辅助函数 ---
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 网络请求封装 ---
async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE")) {
        const msg = "请先在插件脚本中配置Cookie";
        $utils.toastError(msg, 3000);
        logError(msg);
        throw new Error("Cookie not configured.");
    }
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, ...options.headers };
    const finalOptions = { ...options, headers };
    if (options.method === 'POST') {
        return $fetch.post(url, options.body, finalOptions);
    }
    return $fetch.get(url, finalOptions);
}

// --- 自动回帖 ---
async function reply(url) {
    log("尝试使用Cookie自动回帖...");
    const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
    const threadIdMatch = url.match(/thread-(\d+)/);
    if (!threadIdMatch) {
        logError("回帖失败：无法从URL中匹配到threadId。");
        return false;
    }
    
    const threadId = threadIdMatch[1];
    const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const postData = { doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0 };

    try {
        const { data } = await fetchWithCookie(postUrl, {
            method: 'POST',
            body: postData,
            headers: { 'Referer': url }
        });
        if (data.includes("您尚未登录")) {
            const msg = "回帖失败：Cookie已失效或不正确。";
            logError(msg);
            $utils.toastError("Cookie已失效，请重新获取", 3000);
            return false;
        }
        log("回帖成功！");
        return true;
    } catch (e) {
        logError(`回帖请求异常: ${e.message}`);
        if (e.message !== "Cookie not configured.") {
            $utils.toastError("回帖异常，请检查网络或Cookie", 3000);
        }
        return false;
    }
}

// --- 核心函数 (其他函数保持不变) ---
async function getConfig() { /* ...与之前版本相同... */ }
function getCorrectPicUrl(path) { /* ...与之前版本相同... */ }
async function getCards(ext) { /* ...与之前版本相同... */ }
async function search(ext) { /* ...与之前版本相同... */ }

// =================================================================================
// =================== 【V45核心 + V54全角格式】最终版 getTracks 函数 ===================
// =================================================================================
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    log(`开始处理详情页: ${detailUrl}`);
    
    try {
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);
        
        let isContentHidden = $("div.alert.alert-warning").text().includes("回复后");
        if (isContentHidden) {
            log("内容被隐藏，启动回帖流程...");
            const replied = await reply(detailUrl);
            if (replied) {
                log("回帖成功，重新获取页面内容...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data);
            } else {
                logError("无法自动回帖，流程终止。");
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: '', ext: {} }] }] });
            }
        }

        const mainMessage = $('.message[isfirst="1"]');
        // 将主楼HTML发送到后端，用于深入分析
        logToBackend('debug', `主楼HTML内容: ${mainMessage.html()}`);

        const tracks = [];
        const seenUrls = new Set();
        const pageTitle = $("h4.break-all").text().trim();
        log(`页面标题: ${pageTitle}`);

        const processAndPushTrack = (fileName, rawLink, accessCode = '') => {
            log(`[processAndPushTrack] 收到原始数据 -> 文件名: ${fileName}, 链接: ${rawLink}, 访问码: ${accessCode}`);
            if (!rawLink || seenUrls.has(rawLink.split('（')[0].trim())) {
                log(`[processAndPushTrack] 链接为空或已处理，跳过: ${rawLink}`);
                return;
            }
            
            const preliminaryCleanCode = (accessCode || '').replace(/(?:访问码|提取码|密码)\s*[:：]\s*/i, '');
            let dataPacket = rawLink;
            if (preliminaryCleanCode) { dataPacket = `${rawLink}（访问码：${preliminaryCleanCode}）`; }
            
            let pureLink = '';
            let finalAccessCode = '';
            const splitMatch = dataPacket.match(/(https?:\/\/[^\s（(]+ )[\s（(]+访问码[：:]+([^）)]+)/);
            
            if (splitMatch && splitMatch.length === 3) {
                pureLink = splitMatch[1].trim();
                finalAccessCode = splitMatch[2].trim();
            } else {
                pureLink = dataPacket.trim();
            }
            
            const normalizeCode = (rawCode) => {
                const charMap = { '₆': '6' };
                let normalized = '';
                for (const char of rawCode) { normalized += charMap[char] || char; }
                return normalized.trim();
            };
            finalAccessCode = normalizeCode(finalAccessCode);
            log(`[V45逻辑提取结果] 纯链接: '${pureLink}', 访问码: '${finalAccessCode}'`);
            
            if (seenUrls.has(pureLink)) {
                log(`[processAndPushTrack] 清洗后的纯链接已处理，跳过: ${pureLink}`);
                return;
            }
            seenUrls.add(pureLink);

            let finalPan;
            if (finalAccessCode) {
                finalPan = `${pureLink}（访问码：${finalAccessCode}）`;
                log(`[V54全角格式] 拼接: '${finalPan}'`);
            } else {
                finalPan = pureLink;
            }

            // 为了调试，我们把最终结果的详细信息也发到后端
            const finalTrack = { name: fileName, pan: finalPan, ext: { pwd: '' } };
            logToBackend('debug', `最终生成的Track对象: ${JSON.stringify(finalTrack)}`);

            tracks.push(finalTrack);
        };

        log("引擎一：开始解析<a>标签(名称链接)...");
        mainMessage.find('a[href*="cloud.189.cn"]').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href');
            if (!href) return;

            const text = linkElement.text().trim();
            let fileName = text.length > 5 && !text.startsWith('http' ) ? text : pageTitle;
            
            const parentText = linkElement.parent().text();
            const preciseMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
            let accessCode = '';
            if (preciseMatch && preciseMatch[1]) {
                accessCode = preciseMatch[1];
            }
            processAndPushTrack(fileName, href, accessCode);
        });
        log("引擎一：<a>标签解析完成。");

        log("引擎二：开始解析剩余纯文本链接...");
        const mainMessageText = mainMessage.text();
        const allLinksInMessage = (mainMessageText.match(/https?:\/\/cloud\.189\.cn\/[^\s]+/g ) || []);
        log(`引擎二：在纯文本中找到的链接: ${JSON.stringify(allLinksInMessage)}`);
        const isolatedLinks = allLinksInMessage.filter(link => !seenUrls.has(link));
        log(`引擎二：过滤后剩余的孤立链接: ${JSON.stringify(isolatedLinks)}`);

        if (isolatedLinks.length > 0) {
            const codeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
            let potentialCodes = [];
            let match;
            while ((match = codeRegex.exec(mainMessageText)) !== null) {
                potentialCodes.push(match[1]);
            }
            log(`引擎二：在纯文本中找到的所有潜在访问码: ${JSON.stringify(potentialCodes)}`);
            
            const usedCodes = new Set();
            tracks.forEach(t => {
                 const m = t.pan.match(/访问码：([^）]+)/);
                 if (m && m[1]) usedCodes.add(m[1]);
            });
            log(`引擎二：已被引擎一使用的访问码: ${JSON.stringify(Array.from(usedCodes))}`);
            const availableCodes = potentialCodes.filter(c => !usedCodes.has(c));
            
            log(`引擎二：最终可用的访问码池: ${JSON.stringify(availableCodes)}`);

            for (let i = 0; i < isolatedLinks.length; i++) {
                const link = isolatedLinks[i];
                const code = availableCodes[i] || '';
                processAndPushTrack(pageTitle, link, code);
            }
        }
        log("引擎二：纯文本链接解析完成。");

        if (tracks.length === 0) {
            log("所有方法均未找到有效资源，返回提示信息。");
        }
        log(`处理完成，共找到 ${tracks.length} 个资源。`);
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        logError(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}
// =================================================================================

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v45.4 - 后端日志调试版)');
