/**
 * 观影网脚本 - v10.1 (后端驱动-带自检)
 * 
 * 更新日志:
 * - 【v10.1】增加启动自检：在getConfig时主动测试与后端的连接，提前暴露问题。
 * - 【v10.1】优化错误提示：为连接失败和配置错误提供更清晰的弹窗提示。
 * - 【v10.1】修复冷启动无请求的问题。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// ★★★★★【请配置你的个人后端服务地址】★★★★★
// 将这里的IP地址替换为你运行后端服务的电脑的局域网IP地址。
// ！！！！！！重要：请务必确认这里的地址是你后端服务正在监听的正确地址！！！！！！
const BACKEND_API_URL = 'http://192.168.10.111:5000/getCookie'; 
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const appConfig = {
    ver: 10.1,
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// 全局变量
let dynamicCookie = ''; 
let isBackendOk = false; // 标记后端连接状态

/**
 * 从个人后端服务获取最新的有效Cookie 。
 */
async function getCookieFromBackend() {
    if (dynamicCookie) {
        log('使用已缓存的Cookie。');
        return dynamicCookie;
    }

    // 检查配置是否为初始模板
    if (!BACKEND_API_URL || BACKEND_API_URL.includes('192.168.1.88')) {
         const errorMsg = '请先在脚本中正确配置你的后端服务地址 (BACKEND_API_URL)！';
         $utils.toastError(errorMsg, 8000);
         throw new Error(errorMsg);
    }

    log(`正在从个人后端 (${BACKEND_API_URL}) 获取最新Cookie...`);
    try {
        const { data } = await $fetch.get(BACKEND_API_URL, { timeout: 10000 }); // 增加10秒超时
        const parsedData = JSON.parse(data);

        if (parsedData.status === 'success' && parsedData.cookie) {
            log('成功从后端获取Cookie！');
            dynamicCookie = parsedData.cookie;
            isBackendOk = true; // 标记后端正常
            return dynamicCookie;
        } else {
            const errorMessage = `后端返回错误: ${parsedData.message}`;
            throw new Error(errorMessage);
        }
    } catch (e) {
        const errorMessage = `无法连接到后端服务: ${e.message}. 请检查: 1.后端是否运行. 2.IP地址是否正确. 3.防火墙是否关闭. 4.是否在同一局域网.`;
        log(errorMessage);
        $utils.toastError(errorMessage, 10000); // 显示更详细的错误
        throw new Error(errorMessage);
    }
}

/**
 * 封装了所有对观影网的网络请求。
 */
async function fetchGying(url, options = {}) {
    const cookie = await getCookieFromBackend();
    const headers = {
        'User-Agent': UA,
        'Referer': appConfig.site,
        'Cookie': cookie,
        ...options.headers,
    };
    return $fetch.get(url, { ...options, headers });
}

// --- 核心改动：在 getConfig 中执行启动自检 ---

async function getConfig() {
    // App加载脚本后会先调用此函数，我们在这里执行自检
    if (!isBackendOk) {
        try {
            log("--- 启动自检：测试与后端的连接 ---");
            await getCookieFromBackend();
            $utils.toastSuccess('后端连接成功！', 3000);
        } catch (e) {
            log(`自检失败: ${e.message}`);
            // getCookieFromBackend 内部已经弹窗了，这里不用重复
        }
    }
    return jsonify(appConfig);
}


// --- 其他数据获取函数保持不变 ---

async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchGying(url);
        const $ = cheerio.load(data);

        const scriptContent = $('script').filter((_, script) => $(script).html().includes('_obj.header')).html();
        if (!scriptContent) throw new Error("未能找到关键数据，请检查后端服务是否正常。");

        const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) throw new Error("未能解析到列表数据。");

        const inlistData = JSON.parse(inlistMatch[1]);
        if (inlistData && inlistData.i) {
            inlistData.i.forEach((item, index) => {
                const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: inlistData.t[index],
                    vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                    vod_remarks: inlistData.g[index],
                    ext: { url: detailApiUrl },
                } );
            });
        }
        return jsonify({ list: cards });
    } catch (e) {
        log(`获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ... getTracks, search, getPlayinfo 等函数与之前版本相同，此处省略 ...
async function getTracks(ext){/*...与v10.0相同...*/}
async function search(ext){/*...与v10.0相同...*/}
async function getPlayinfo(ext){/*...与v10.0相同...*/}
