/**
 * 观影网脚本 - v5.2 (最终兼容版)
 * 
 * 更新日志:
 * - 【v5.2】终极修正：改用标准的、与环境无关的 fetch() API 进行登录，以解决 $http 未定义和 $fetch 功能不全的问题 。
 * - 【v5.1】修正登录逻辑，尝试使用 $http.post 。
 * - 【v5.0】重大更新：由Cookie模式改为用户名/密码自动登录模式。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// ★★★★★【请在这里填写你的观影网账号信息】★★★★★
const USER_CONFIG = {
    username: '1083328569@qq.com', // 替换为你的观影网登录邮箱或用户名
    password: 'xiaohai1314'             // 替换为你的观影网登录密码
};
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const appConfig = {
    ver: 5.2,
    title: '观影网 (登录版)',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// 全局变量 ，用于存储登录后动态获取的Cookie
let dynamicCookie = '';

// ================== 核心函数 ==================

// --- 辅助函数 ---
function log(msg) { try { $log(`[观影网 V5.2] ${msg}`); } catch (_) { console.log(`[观影网 V5.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }


/**
 * 执行登录操作，并从响应头中获取并返回Cookie
 * [v5.2 修正] 改用标准的 fetch() API，以保证最大的环境兼容性。
 * @returns {Promise<string>} 登录成功后获取的Cookie字符串
 */
async function performLogin() {
    if (!USER_CONFIG.username || !USER_CONFIG.password || USER_CONFIG.username.includes('YOUR_USERNAME')) {
        throw new Error("用户名或密码未配置。");
    }
    
    const loginUrl = 'https://www.gying.org/user/login';
    const payload = `code=&siteid=1&dosubmit=1&cookietime=10506240&username=${encodeURIComponent(USER_CONFIG.username )}&password=${encodeURIComponent(USER_CONFIG.password)}`;

    log('正在尝试登录 (使用标准 fetch)...');
    try {
        // 【关键改动】使用标准的 fetch API
        const response = await fetch(loginUrl, {
            method: 'POST',
            body: payload,
            headers: {
                'User-Agent': UA,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://www.gying.org/user/login',
                'Origin': 'https://www.gying.org'
            }
        } );

        // 检查网络请求是否成功
        if (!response.ok) {
            throw new Error(`网络请求失败，状态码: ${response.status}`);
        }

        // 检查响应体是否包含登录失败的提示
        const responseText = await response.text();
        if (responseText.includes('密码错误') || responseText.includes('验证码不正确')) {
             throw new Error('登录失败，请检查用户名和密码或网页需要验证码。');
        }

        // 从响应头中提取Set-Cookie
        // response.headers.get() 对于多个同名头，只会返回第一个，我们需要所有
        // 但在浏览器环境中，'set-cookie' 是一个特例，直接访问会得到拼接好的字符串
        // 在非浏览器环境中，可能需要特殊处理，但先用标准方法尝试
        const setCookieHeader = response.headers.get('set-cookie');
        if (!setCookieHeader) {
            // 如果获取不到，尝试遍历所有头
            let cookies = [];
            for (let pair of response.headers.entries()) {
                if (pair[0].toLowerCase() === 'set-cookie') {
                    cookies.push(pair[1].split(';')[0]);
                }
            }
            if (cookies.length > 0) {
                dynamicCookie = cookies.join('; ');
                log('登录成功，已获取并设置动态Cookie。');
                return dynamicCookie;
            }
            throw new Error('登录似乎成功，但未能从响应中捕获到Set-Cookie头。');
        }
        
        // 标准浏览器环境可以直接处理
        const cookies = setCookieHeader.split(', ').map(c => c.split(';')[0]).join('; ');
        log('登录成功，已获取并设置动态Cookie。');
        return cookies;

    } catch (e) {
        log(`登录请求异常: ${e.message}`);
        $utils.toastError(`登录失败: ${e.message}`, 5000);
        throw e; // 抛出异常，中断后续操作
    }
}


/**
 * 使用动态Cookie执行网络请求的核心函数
 * 如果Cookie不存在，会自动尝试登录。
 * @param {string} url 请求的URL
 * @param {object} options 请求选项
 * @returns {Promise<object>} 返回请求结果 { data: '...' }
 */
async function fetchWithCookie(url, options = {}) {
    if (!dynamicCookie) {
        try {
            dynamicCookie = await performLogin();
        } catch (e) {
            throw new Error("登录失败，无法继续数据请求。");
        }
    }

    const headers = {
        'User-Agent': UA,
        'Cookie': dynamicCookie,
        'Referer': appConfig.site,
        ...options.headers
    };

    try {
        // 使用标准 fetch 执行后续请求
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();

        if (data.includes('用户登录')) {
             throw new Error('Cookie已失效');
        }
        // 返回与原$fetch兼容的格式
        return { data: data }; 
    } catch (e) {
        log(`请求失败: ${e.message}。可能是Cookie失效，将尝试重新登录。`);
        dynamicCookie = '';
        return await fetchWithCookie(url, options);
    }
}


// --- 【核心修正】getCards函数，使用新的fetchWithCookie ---
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);

        const scriptContent = $('script').filter((_, script) => {
            return $(script).html().includes('_obj.header');
        }).html();

        if (!scriptContent) {
            throw new Error("未能找到包含'_obj.header'的关键script标签。");
        }

        const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) {
            throw new Error("在script标签中未能匹配到'_obj.inlist'数据。");
        }

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
            log(`成功从JS变量中解析到 ${cards.length} 个项目。`);
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`获取卡片列表异常: ${e.message}`);
        if (!e.message.includes("登录失败")) {
            $utils.toastError(`加载失败: ${e.message}`, 4000);
        }
        return jsonify({ list: [] });
    }
}

// --- getTracks, search等函数也统一使用fetchWithCookie ---

async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
    log(`请求详情数据: ${url}`);

    try {
        const { data } = await fetchWithCookie(url);
        const respstr = JSON.parse(data);

        if (respstr.hasOwnProperty('panlist')) {
            const regex = { '中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g, '原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g };
            respstr.panlist.url.forEach((item, index) => {
                let name = '';
                for (const keyword in regex) {
                    const matches = (respstr.panlist.name[index] || '').match(regex[keyword]);
                    if (matches) {
                        name = `${name}${matches[0]}`;
                    }
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
        const { data } = await fetchWithCookie(url);
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

// getConfig函数保持不变
async function getConfig() {
    return jsonify(appConfig);
}
