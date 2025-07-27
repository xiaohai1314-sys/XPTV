/**
 * =================================================================
 * 最终可用脚本 - 智能回退终极解决方案
 * 版本: 28 (智能回退终极版)
 *
 * 更新日志:
 * - [重大修正] 修复了v26/v27版本中因强制使用WebView而导致所有普通页面解析失败的严重错误。
 * - [核心策略] 引入“智能回退”机制：
 *     1. 优先尝试使用WebView加载页面，专门应对Cloudflare等JS验证。
 *     2. 获取WebView结果后，立刻验证其有效性。
 *     3. 如果WebView失败或返回无效HTML，则自动放弃，并回退到使用标准、快速的 $fetch 重新获取页面。
 * - [稳定性] 此策略确保了脚本既能处理复杂页面，又完全兼容普通页面，解决了“所有资源都识别不了”的问题。
 * - [兼容性] WebView部分依然保留了多种模式切换的选项，以应对不同App环境。
 * - [解析逻辑] 统一使用最可靠的v24版解析方案，直接在获取到的原始HTML上操作。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const cheerio = createCheerio();

const appConfig = {
  ver: 28,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  // ... 其他配置保持不变 ...
};

// ... getConfig, getCards, getPlayinfo, search 等函数保持不变 ...

// --- 详情页函数: v28 智能回退终极版 ---
async function getTracks(ext ) {
    ext = argsify(ext);
    const tracks = [];
    const pageUrl = ext.url;
    const uniqueLinks = new Set();

    try {
        let rawHtml = '';

        // --- 策略一：优先尝试用WebView获取，专门对付Cloudflare ---
        try {
            // =================================================================
            // !! WebView模式切换 (如果需要) !!
            // 1: 'js_eval' (最常见)
            // 2: 'eval'
            const webview_mode = 1;
            // =================================================================
            
            const js_code = `new Promise(r => setTimeout(() => r(document.documentElement.outerHTML), 5000))`; // 等待5秒让JS执行
            
            console.log(`正在以模式 ${webview_mode} 尝试WebView加载...`);
            let webViewResponse;
            if (webview_mode === 1) {
                webViewResponse = await $fetch(pageUrl, { method: 'GET', headers: { 'User-Agent': UA }, js_eval: js_code });
            } else if (webview_mode === 2) {
                webViewResponse = await $fetch(pageUrl, { method: 'GET', headers: { 'User-Agent': UA }, eval: js_code });
            }
            rawHtml = webViewResponse.data;

        } catch (e) {
            console.error("WebView加载失败:", e);
            rawHtml = ''; // 清空，确保会触发回退
        }

        // --- 策略二：智能回退到 $fetch ---
        // 如果WebView失败，或者返回的HTML无效(比如还是CF加载页)，则使用标准$fetch
        if (!rawHtml || !rawHtml.includes('class="topicContent"')) {
            console.log("WebView获取内容无效或失败，回退到标准 $fetch 模式。");
            const response = await $fetch.get(pageUrl, { headers: { 'User-Agent': UA } });
            rawHtml = response.data;
        } else {
            console.log("WebView获取内容成功。");
        }

        // --- 统一的解析逻辑 (基于最可靠的v24方案) ---
        const $ = cheerio.load(rawHtml);
        const title = $('.topicBox .title').text().trim() || "网盘资源";

        const blockPattern = /https?:\/\/cloud\.189\.cn\/[^\s<>"']+/g;
        const potentialBlocks = rawHtml.match(blockPattern ) || [];

        for (const rawBlock of potentialBlocks) {
            let decodedBlock;
            try {
                decodedBlock = decodeURIComponent(rawBlock);
            } catch (e) {
                decodedBlock = rawBlock;
            }

            const linkMatch = decodedBlock.match(/^(https?:\/\/cloud\.189\.cn\/(?:t\/[a-zA-Z0-9]+|web\/share\?code=[a-zA-Z0-9]+ ))/);
            if (!linkMatch) continue;

            const panUrl = linkMatch[1];
            const normalizedUrl = normalizePanUrl(panUrl);
            if (uniqueLinks.has(normalizedUrl)) continue;

            const accessCode = extractAccessCode(decodedBlock);

            tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode || '' } });
            uniqueLinks.add(normalizedUrl);
        }

        if (tracks.length > 0) {
            return jsonify({ list: [{ title: "天翼云盘", tracks }] });
        } else {
            // 如果解析后仍然没有结果，可能是纯文本分离格式，做最后一次尝试
            const bodyText = $('body').text();
            const urlPattern = /https?:\/\/cloud\.189\.cn\/(?:t|web\/share )\/[^\s<>()"'`]+/gi;
            let match;
            while ((match = urlPattern.exec(bodyText)) !== null) {
                const panUrl = match[0];
                const normalizedUrl = normalizePanUrl(panUrl);
                if (uniqueLinks.has(normalizedUrl)) continue;
                const searchArea = bodyText.substring(Math.max(0, match.index - 50), match.index + panUrl.length + 50);
                const accessCode = extractAccessCode(searchArea);
                tracks.push({ name: title, pan: panUrl, ext: { accessCode: accessCode || '' } });
                uniqueLinks.add(normalizedUrl);
            }
        }
        
        if (tracks.length > 0) {
            return jsonify({ list: [{ title: "天翼云盘", tracks }] });
        } else {
            return jsonify({ list: [] });
        }

    } catch (e) {
        console.error('获取详情页失败:', e);
        return jsonify({ list: [{ title: "资源列表", tracks: [{ name: "加载失败", pan: "请检查网络或链接", ext: { accessCode: "" } }] }] });
    }
}

function extractAccessCode(text) {
    if (!text) return '';
    let match = text.match(/(?:访问码|密码|提取码|code)\s*[:：\s]*([a-zA-Z0-9]{4,6})/i);
    if (match && match[1]) return match[1];
    match = text.match(/[\(（\uff08\[【]\s*(?:访问码|密码|提取码|code)?\s*[:：\s]*([a-zA-Z0-9]{4,6})\s*[\)）\uff09\]】]/i);
    if (match && match[1]) return match[1];
    return '';
}

function normalizePanUrl(url) {
    try {
        const urlObj = new URL(url);
        return (urlObj.origin + urlObj.pathname).toLowerCase();
    } catch (e) {
        const match = url.match(/https?:\/\/cloud\.189\.cn\/[^\s<>(  )]+/);
        return match ? match[0].toLowerCase() : url.toLowerCase();
    }
}
