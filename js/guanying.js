/**
 * 观影网脚本 - v10.0 (后端驱动终极版)
 * 
 * 架构: 本脚本作为客户端，从用户自部署的后端服务获取动态Cookie。
 * 优点: 一次配置，全平台(手机/电视)永久自动登录，无需手动维护。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// ★★★★★【请配置你的个人后端服务地址】★★★★★
// 将这里的IP地址替换为你运行后端服务的电脑的局域网IP地址。
const BACKEND_API_URL = 'http://192.168.10.111:5000/getCookie'; 
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const appConfig = {
    ver: 10.0,
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// 全局变量 ，用于缓存从后端获取的Cookie，避免重复请求
let dynamicCookie = ''; 

/**
 * 从个人后端服务获取最新的有效Cookie。
 * 带有缓存机制，在一次脚本生命周期内只获取一次。
 */
async function getCookieFromBackend() {
    if (dynamicCookie) {
        log('使用已缓存的Cookie。');
        return dynamicCookie;
    }

    if (!BACKEND_API_URL || BACKEND_API_URL.includes('192.168.1.88')) {
         $utils.toastError('请先在脚本中配置你的后端服务地址！', 5000);
         throw new Error('后端服务地址未配置。');
    }

    log('正在从个人后端获取最新Cookie...');
    try {
        // 使用环境中可用的 $fetch 函数
        const { data } = await $fetch.get(BACKEND_API_URL);
        const parsedData = JSON.parse(data);

        if (parsedData.status === 'success' && parsedData.cookie) {
            log('成功从后端获取Cookie！');
            dynamicCookie = parsedData.cookie; // 缓存Cookie
            return dynamicCookie;
        } else {
            // 如果后端返回了错误信息，则显示出来
            const errorMessage = `后端返回错误: ${parsedData.message}`;
            log(errorMessage);
            $utils.toastError(errorMessage, 5000);
            throw new Error(errorMessage);
        }
    } catch (e) {
        const errorMessage = `无法连接到后端服务: ${e.message}`;
        log(errorMessage);
        $utils.toastError('无法连接到你的个人后端服务，请检查地址和网络。', 5000);
        throw new Error(errorMessage);
    }
}

/**
 * 封装了所有对观影网的网络请求。
 * 它会自动处理Cookie的获取。
 */
async function fetchGying(url, options = {}) {
    const cookie = await getCookieFromBackend();
    
    const headers = {
        'User-Agent': UA,
        'Referer': appConfig.site,
        'Cookie': cookie, // 使用从后端获取的Cookie
        ...options.headers,
    };
    
    return $fetch.get(url, { ...options, headers });
}

// --- 所有数据获取函数均统一调用 fetchGying ---

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
        // 不再重复弹窗，因为上游函数已经弹过了
        return jsonify({ list: [] });
    }
}

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

async function getConfig() {
    return jsonify(appConfig);
}
