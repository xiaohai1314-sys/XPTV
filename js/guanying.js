/**
 * 观影网脚本 - v6.0 (免配置最终版)
 * 
 * 更新日志:
 * - 【v6.0】返璞归真：回归并优化Cookie模式，以适应特殊的JS运行环境。
 * - 【免配置】不再需要填写任何用户名、密码或Cookie字符串。
 * - 【自动会话】脚本将自动利用App内置WebView或系统浏览器中已有的观影网登录会话。
 * - 【登录验证】增加启动时检查函数，通过访问用户中心来验证登录状态，并提供清晰的指引。
 * - 【移除冗余】删除了所有在当前环境下无法工作的登录尝试代码。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

const appConfig = {
    ver: 6.0,
    title: '观影网 (免配置版)',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// 全局变量 ，用于标记登录状态检查是否已完成
let loginChecked = false;

// ================== 核心函数 ==================

// --- 辅助函数 ---
function log(msg) { try { $log(`[观影网 V6.0] ${msg}`); } catch (_) { console.log(`[观影网 V6.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

/**
 * 检查登录状态的核心函数。
 * 它通过访问用户中心页面并检查页面内容来确认是否已登录。
 * 这是所有网络请求前必须执行的第一步。
 */
async function checkLoginStatus() {
    if (loginChecked) {
        return true; // 如果已经检查过，直接返回成功
    }

    log('正在验证观影网登录状态...');
    const userCenterUrl = 'https://www.gying.org/user/';
    
    try {
        // 使用环境中唯一可用的 $fetch
        const { data } = await $fetch.get(userCenterUrl, {
            headers: { 'User-Agent': UA }
        } );

        // 检查返回的HTML是否包含表示“未登录”的关键词
        if (data.includes('用户登录') || data.includes('立即注册')) {
            log('验证失败：未登录。');
            $utils.toastError('请先在手机浏览器(Safari)中登录观影网！', 5000);
            throw new Error('Not logged in.');
        }

        // 如果页面包含通常在登录后才出现的内容，则认为已登录
        if (data.includes('我的收藏') || data.includes('退出登录')) {
            log('登录状态验证成功！');
            loginChecked = true; // 标记为已检查
            return true;
        }
        
        // 作为最后的防线
        log('无法明确判断登录状态，将尝试继续。');
        loginChecked = true;
        return true;

    } catch (e) {
        log(`登录状态检查异常: ${e.message}`);
        // 如果错误不是 "Not logged in."，则显示通用错误
        if (e.message !== 'Not logged in.') {
            $utils.toastError('检查登录状态时发生网络错误。', 3000);
        }
        throw e; // 抛出异常，中断后续操作
    }
}

/**
 * 带有登录检查的网络请求函数。
 * @param {string} url 请求的URL
 * @param {object} options 请求选项
 * @returns {Promise<object>} 返回 $fetch 的结果
 */
async function fetchWithLoginCheck(url, options = {}) {
    // 在每次请求前（如果需要），都先确保登录状态是有效的
    await checkLoginStatus();
    
    const finalOptions = {
        ...options,
        headers: {
            'User-Agent': UA,
            'Referer': appConfig.site,
            ...options.headers,
        },
    };
    
    return $fetch.get(url, finalOptions);
}


// --- getCards, getTracks, search 等函数统一使用新的请求逻辑 ---

async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithLoginCheck(url);
        const $ = cheerio.load(data);

        const scriptContent = $('script').filter((_, script) => {
            return $(script).html().includes('_obj.header');
        }).html();

        if (!scriptContent) {
            throw new Error("未能找到包含'_obj.header'的关键script标签。可能是登录会话已失效。");
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
        if (!e.message.includes('Not logged in')) {
            $utils.toastError(`加载失败: ${e.message}`, 4000);
        }
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
    log(`请求详情数据: ${url}`);

    try {
        const { data } = await fetchWithLoginCheck(url);
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
        const { data } = await fetchWithLoginCheck(url);
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
