/**
 * 观影网脚本 - v5.1 (最终登录版)
 * 
 * 更新日志:
 * - 【v5.1】修正登录逻辑，改用兼容性更好的 $http.post 以获取响应头 ，解决 'response.headers' is undefined 的问题。
 * - 【v5.0】重大更新：由Cookie模式改为用户名/密码自动登录模式。
 * - 【自动登录】实现了performLogin函数，可在脚本启动时自动登录并获取会话Cookie。
 * - 【会话保持】改造了网络请求核心，支持Cookie失效后自动重新登录。
 * - 【配置分离】将用户名和密码配置提取到USER_CONFIG区域，方便用户修改。
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
    ver: 5.1,
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
function log(msg) { try { $log(`[观影网 V5.1] ${msg}`); } catch (_) { console.log(`[观影网 V5.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }


/**
 * 执行登录操作，并从响应头中获取并返回Cookie
 * [v5.1 修正] 改用 $http.post 以获取完整的响应头 ，解决 'response.headers' is undefined 的问题。
 * @returns {Promise<string>} 登录成功后获取的Cookie字符串
 */
async function performLogin() {
    if (!USER_CONFIG.username || !USER_CONFIG.password || USER_CONFIG.username.includes('YOUR_USERNAME')) {
        throw new Error("用户名或密码未配置。");
    }
    
    const loginUrl = 'https://www.gying.org/user/login';
    const payload = `code=&siteid=1&dosubmit=1&cookietime=10506240&username=${encodeURIComponent(USER_CONFIG.username )}&password=${encodeURIComponent(USER_CONFIG.password)}`;

    log('正在尝试登录 (使用 $http )...');
    try {
        // 【关键改动】使用 $http.post 代替 $fetch.post ，因为它通常会返回包含headers的完整响应对象
        const response = await $http.post({
            url: loginUrl,
            body: payload,
            headers: {
                'User-Agent': UA,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://www.gying.org/user/login',
                'Origin': 'https://www.gying.org'
            }
        } );

        // 检查响应对象和响应头是否存在
        if (!response || !response.headers) {
            throw new Error('$http.post调用成功 ，但返回的响应对象中没有headers。');
        }

        // 检查响应体是否包含登录失败的提示
        if (response.body && typeof response.body === 'string' && (response.body.includes('密码错误') || response.body.includes('验证码不正确'))) {
             throw new Error('登录失败，请检查用户名和密码或网页需要验证码。');
        }

        // 从响应头中提取Set-Cookie
        const setCookieHeader = response.headers['set-cookie'] || response.headers['Set-Cookie'];
        if (!setCookieHeader || setCookieHeader.length === 0) {
            throw new Error('登录似乎成功，但未能从响应中捕获到Set-Cookie头。');
        }

        // 将Set-Cookie数组或字符串拼接成一个标准的Cookie字符串
        const cookies = Array.isArray(setCookieHeader) 
            ? setCookieHeader.map(c => c.split(';')[0]).join('; ')
            : setCookieHeader.split(';')[0];
            
        log('登录成功，已获取并设置动态Cookie。');
        return cookies;

    } catch (e) {
        log(`登录请求异常: ${e.message}`);
        // 将错误信息展示给用户，方便调试
        $utils.toastError(`登录失败: ${e.message}`, 5000);
        throw e; // 抛出异常，中断后续操作
    }
}


/**
 * 使用动态Cookie执行网络请求的核心函数
 * 如果Cookie不存在，会自动尝试登录。
 * @param {string} url 请求的URL
 * @param {object} options 请求选项
 * @returns {Promise<object>} 返回请求结果
 */
async function fetchWithCookie(url, options = {}) {
    // 如果全局Cookie为空，则先执行登录
    if (!dynamicCookie) {
        try {
            dynamicCookie = await performLogin();
        } catch (e) {
            // 登录失败，直接抛出错误，不再继续执行
            throw new Error("登录失败，无法继续数据请求。");
        }
    }

    const headers = {
        'User-Agent': UA,
        'Cookie': dynamicCookie, // 使用动态获取的Cookie
        'Referer': appConfig.site,
        ...options.headers
    };
    const finalOptions = { ...options, headers };

    try {
        // 注意：这里的$fetch.get也可能需要换成$http.get ，取决于环境。先用$fetch尝试。
        const response = await $fetch.get(url, finalOptions);
        // 如果响应数据表明需要登录（例如返回登录页HTML），说明Cookie失效
        if (typeof response.data === 'string' && response.data.includes('用户登录')) {
             throw new Error('Cookie已失效');
        }
        return response;
    } catch (e) {
        // 捕获到Cookie失效的特定错误，或通用网络错误后尝试重新登录
        log(`请求失败: ${e.message}。可能是Cookie失效，将尝试重新登录。`);
        dynamicCookie = ''; // 清空旧Cookie
        // 递归调用，会自动触发登录流程
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
        const { data } = await fetchWithCookie(url); // 使用带登录逻辑的请求函数
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
