// =======================================================================
// v15.3 前端脚本 (观影网 - 终极海报修复版)
// 更新日志:
// - 【拨乱反正】彻底废除v15.1和v15.2的所有破坏性修改，100%回归v15.0的稳定框架。
// - 【终极修复】getCards函数回归原始逻辑，只在内部增加了一个基于“影片ID”定位的、绝对可靠的备用海报抓取方案。
// - 【稳定至上】确保分类列表和所有核心功能100%正常工作，只精准解决部分海报丢失问题。
// =======================================================================

// --- 配置区 (与v15.0完全相同) ---
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = "http://192.168.10.111:5000"; // ★★★ 请务必修改为你的后端IP和端口 ★★★

const appConfig = {
    ver: 15.3,
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// --- 核心函数 (与v15.0完全相同 ) ---
function log(msg) { try { $log(`[观影网 v15.3] ${msg}`); } catch (_) { console.log(`[观影网 v15.3] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

let cachedCookie = "";
async function getCookieFromBackend() {
    if (cachedCookie) return cachedCookie;
    log("正在从后端获取Cookie...");
    try {
        const { data } = await $fetch.get(`${BACKEND_URL}/getCookie`, { timeout: 20000 });
        if (data.status === "success" && data.cookie) {
            log("成功从后端获取Cookie！");
            cachedCookie = data.cookie;
            return cachedCookie;
        }
        throw new Error(data.message || "后端返回Cookie失败");
    } catch (e) {
        log(`从后端获取Cookie失败: ${e.message}`);
        $utils.toastError(`连接后端失败: ${e.message}`, 5000);
        return null;
    }
}

async function fetchWithCookie(url, options = {}) {
    const cookie = await getCookieFromBackend();
    if (!cookie) throw new Error("未能获取到有效的Cookie");
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}

async function getConfig() {
    return jsonify(appConfig);
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【终极修复后的 getCards 函数】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);

        // 【回归v15.0的稳定内核】我们依然100%信任JS变量作为数据源
        const scriptContent = $('script').filter((_, script) => $(script).html().includes('_obj.header')).html();
        if (!scriptContent) { throw new Error("未能找到关键script标签。"); }

        const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) { throw new Error("未能匹配到_obj.inlist数据。"); }

        const inlistData = JSON.parse(inlistMatch[1]);
        if (inlistData && inlistData.i) {
            inlistData.i.forEach((item, index) => {
                const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
                
                // --- 【终极海报修复逻辑】 ---
                // 1. 首先，生成一个默认的标准海报URL
                let vod_pic_url = `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`;
                
                // 2. 然后 ，去HTML里寻找这个影片的“备用”海报地址
                //    【核心修正】我们使用影片ID作为最可靠的定位锚点！
                const anchorSelector = `a[href*="/${inlistData.ty}/${item}"]`;
                const anchorElement = $(anchorSelector);
                
                if (anchorElement.length > 0) {
                    const backupImgElement = anchorElement.find('img'); // 在锚点内部寻找img
                    if (backupImgElement.length > 0) {
                        const backup_src = backupImgElement.attr('data-src') || backupImgElement.attr('src');
                        if (backup_src && !backup_src.includes('loading.gif')) {
                           log(`为影片《${inlistData.t[index]}》找到备用海报: ${backup_src}`);
                           vod_pic_url = backup_src;
                        }
                    }
                }
                // --- 【修复逻辑结束】 ---

                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: inlistData.t[index],
                    vod_pic: vod_pic_url, // 使用我们智能决策后的海报URL
                    vod_remarks: inlistData.g[index],
                    ext: { url: detailApiUrl },
                });
            });
        }
        return jsonify({ list: cards });

    } catch (e) {
        log(`获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}


// --- search, getTracks, getPlayinfo 函数 (与v15.0完全相同，100%稳定) ---
async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
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

async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url;
    try {
        const { data } = await fetchWithCookie(url);
        const respstr = JSON.parse(data);
        if (respstr.hasOwnProperty('panlist')) {
            const regex = { '中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g, '原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g };
            respstr.panlist.url.forEach((item, index) => {
                let name = '';
                for (const keyword in regex) {
                    const matches = (respstr.panlist.name[index] || '').match(regex[keyword]);
                    if (matches) { name = `${name}${matches[0]}`; }
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

async function getPlayinfo(ext) {
    return jsonify({ urls: [ext.url] });
}
