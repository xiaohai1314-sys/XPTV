/**
 * 观影网脚本 - v3.2 (拨乱反正-最终修复版)
 * 
 * 更新日志:
 * - 【v3.2】拨乱反正，修复因错误修改getCards逻辑导致列表无法加载的致命问题。
 * - 【尊重原版】确保getCards返回的vod_id和ext.url结构与原版脚本完全一致，保证数据流正确。
 * - 【Cookie驱动】保留Cookie认证，彻底摆脱对Safari人机验证的依赖，实现跨平台兼容。
 *   我为之前反复的、不可饶恕的低级错误致歉。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const appConfig = {
    ver: 3.2,
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【用户Cookie已内置】★★★★★
const COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;PHPSESSID=i63pfrc51f5osto68bi40a3dq2;';
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

// --- 辅助函数 ---
function log(msg ) { try { $log(`[观影网 V3.2] ${msg}`); } catch (_) { console.log(`[观影网 V3.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 带Cookie的网络请求 ---
async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.includes('YOUR_COOKIE_STRING_HERE')) {
        $utils.toastError("Cookie未配置，请更新脚本", 3000);
        throw new Error("Cookie not configured.");
    }
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, 'Referer': appConfig.site, ...options.headers };
    const finalOptions = { ...options, headers };
    return $fetch.get(url, finalOptions);
}

async function getConfig() {
    return jsonify(appConfig);
}

// --- 【核心修正】getCards函数 ---
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);

        $('.v5d').each((_, element) => {
            const $element = $(element);
            const linkElement = $element.find('a');
            const path = linkElement.attr('href');
            if (!path) return;

            const name = $element.find('b').text().trim();
            const img = $element.find('picture source[data-srcset]').attr('data-srcset');
            const remarks = $element.find('p').text().trim();
            
            const match = path.match(/\/([a-z]+)\/(\d+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];

            // 【关键修正】构造正确的、可直接用于getTracks的vod_id
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;

            cards.push({
                vod_id: detailApiUrl, // vod_id就是详情API的URL
                vod_name: name,
                vod_pic: img || '',
                vod_remarks: remarks,
                ext: {
                    url: detailApiUrl, // ext.url也保持一致
                },
            });
        });
        log(`成功解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`获取卡片列表异常: ${e.message}`);
        if (e.message !== "Cookie not configured.") {
            $utils.toastError("加载失败，请检查网络或更新Cookie", 3000);
        }
        return jsonify({ list: [] });
    }
}

// --- getTracks函数，现在可以正确接收vod_id ---
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    // 【关键】现在ext.url就是我们从getCards传过来的完整API URL
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
            $utils.toastError('网盘验证掉签，请前往主站完成验证或更新Cookie');
        } else {
            $utils.toastError('没有找到网盘资源');
        }
        return jsonify({ list: [{ title: '默认分组', tracks }] });
    } catch (e) {
        log(`获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- search函数，同样修正vod_id的构造 ---
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

            // 【关键修正】构造正确的、可直接用于getTracks的vod_id
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;

            cards.push({
                vod_id: detailApiUrl, // vod_id就是详情API的URL
                vod_name: name,
                vod_pic: imgUrl || '',
                vod_remarks: additionalInfo,
                ext: {
                    url: detailApiUrl, // ext.url也保持一致
                },
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容旧版接口 ---
async function getPlayinfo(ext) {
    return jsonify({ urls: [ext.url] });
}
