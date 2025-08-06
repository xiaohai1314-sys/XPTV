/**
 * 观影网脚本 - v10.2 (后端驱动 - 稳定版)
 * 
 * 更新日志:
 * - 【v10.2】修复致命缺陷：移除getConfig中的异步自检，确保分类列表能100%加载。
 * - 【v10.2】采用懒加载：仅在首次需要数据时（如getCards）才连接后端，提高稳定性。
 * - 【v10.2】增强状态管理：引入更健壮的后端状态管理，避免重复失败。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// ★★★★★【请配置你的个人后端服务地址】★★★★★
// 请务必确认这里的地址是你后端服务正在监听的正确地址。
// 如果电脑端测试不通，可以尝试用 ngrok 生成的 https 地址 。
const BACKEND_API_URL = 'http://192.168.10.111:5000/getCookie'; 
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const appConfig = {
    ver: 10.2,
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// 全局状态管理
let dynamicCookie = ''; 
// 'pending': 待检查, 'ok': 成功, 'error': 失败
let backendState = 'pending'; 

/**
 * 从个人后端服务获取最新的有效Cookie 。
 * 带有完整的状态管理和缓存机制。
 */
async function getCookieFromBackend() {
    // 如果之前已成功，直接返回缓存的Cookie
    if (backendState === 'ok' && dynamicCookie) {
        return dynamicCookie;
    }
    // 如果之前已失败，直接抛出错误，避免重复请求
    if (backendState === 'error') {
        throw new Error('后端连接失败，请检查配置或重启。');
    }

    // 检查配置是否为初始模板
    if (!BACKEND_API_URL || BACKEND_API_URL.includes('192.168.1.88')) {
         const errorMsg = '请先在脚本中正确配置你的后端服务地址 (BACKEND_API_URL)！';
         $utils.toastError(errorMsg, 8000);
         throw new Error(errorMsg);
    }

    log(`首次连接后端 (${BACKEND_API_URL}) 获取Cookie...`);
    try {
        const { data } = await $fetch.get(BACKEND_API_URL, { timeout: 15000 }); // 增加超时
        const parsedData = JSON.parse(data);

        if (parsedData.status === 'success' && parsedData.cookie) {
            log('成功从后端获取Cookie！');
            dynamicCookie = parsedData.cookie;
            backendState = 'ok'; // 标记为成功
            $utils.toastSuccess('后端连接成功！', 3000);
            return dynamicCookie;
        } else {
            throw new Error(`后端返回错误: ${parsedData.message}`);
        }
    } catch (e) {
        backendState = 'error'; // 标记为失败
        const errorMessage = `无法连接到后端服务: ${e.message}. 请检查网络和后端状态。`;
        log(errorMessage);
        $utils.toastError(errorMessage, 10000);
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

// --- getConfig 回归极简，确保UI加载 ---
async function getConfig() {
    log("v10.2脚本已加载，返回基础配置。");
    return jsonify(appConfig);
}

// --- 数据获取函数 ---
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        // 这是脚本第一次真正需要网络请求的地方
        const { data } = await fetchGying(url);
        const $ = cheerio.load(data);

        const scriptContent = $('script').filter((_, script) => $(script).html().includes('_obj.header')).html();
        if (!scriptContent) throw new Error("未能找到关键数据，请检查Cookie是否有效。");

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
        // 错误弹窗已在 getCookieFromBackend 中处理，这里不再重复
        return jsonify({ list: [] });
    }
}

// ... 其他数据获取函数 getTracks, search, getPlayinfo 保持不变 ...
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
    log(`请求详情数据: ${url}`);

    try {
        const { data } = await fetchGying(url);
        const respstr = JSON.parse(data);

        if (respstr.hasOwnProperty('panlist')) {
            const regex = { '中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g, '原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g };
            respstr.panlist.url.forEach((item, index) => {
                let name = '';
                for (const keyword in regex) {
                    const matches = (respstr.panlist.name[index] || '').match(regex[keyword]);
                    if (matches) name = `${name}${matches[0]}`;
                }
                tracks.push({ name: name || respstr.panlist.name[index], pan: item, ext: { url: '' } });
            });
        } else if (respstr.hasOwnProperty('file')) {
            $utils.toastError('网盘验证掉签，请前往主站完成验证');
        } else {
            $utils.toastError('没有找到网盘资源');
        }
        return jsonify({ list: [{ title: '默认分组', tracks }] });
    } catch (e) {
        log(`获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索: ${url}`);

    try {
        const { data } = await fetchGying(url);
        const $ = cheerio.load(data);
        let cards = [];
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const name = $element.find('b').text().trim();
            const imgUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
            const additionalInfo = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;

            const match = path.match(/\/([a-z]+)\/(\d+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;

            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: imgUrl || '',
                vod_remarks: additionalInfo,
                ext: { url: detailApiUrl },
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    return jsonify({ urls: [ext.url] });
}
