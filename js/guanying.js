// =======================================================================
// B计划：备用前端脚本 (HTML直抓版 - 完整代码)
// 这是一个独立的、仅供测试和查漏补缺的脚本。
// 它的getCards函数只从HTML元素提取数据，可以用来查找被v15.0遗漏的影片。
// 不要用它作为日常主力脚本，因为它可能在某些分类下抓不到任何东西。
// =======================================================================

// --- 配置区 ---
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = "http://192.168.10.111:5000"; // ★★★ 请务必修改为你的后端IP和端口 ★★★

const appConfig = {
    ver: "B-Plan-HTML",
    title: '观影网 (B计划 )',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// --- 核心函数 ---
function log(msg ) { try { $log(`[观影网 B计划] ${msg}`); } catch (_) { console.log(`[观影网 B计划] ${msg}`); } }
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

// --- getCards 函数 (纯HTML直抓版) ---
async function getCards(ext) {
    ext = argsify(ext);
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表 (HTML直抓模式): ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        let cards = [];
        
        // 只使用HTML元素抓取模式
        $('ul.content-list li').each((_, element) => {
            const $li = $(element);
            const linkElement = $li.find('a.li-img-cover');
            const imgElement = $li.find('img');
            const nameElement = $li.find('h3 a');
            const remarkElement = $li.find('span.bottom > span:last-child');
            
            const href = linkElement.attr('href');
            if (!href || !href.startsWith('/')) return;

            const vod_id_path = href.substring(1);
            // 修正正则表达式以匹配可能包含子文件夹的路径
            const match = vod_id_path.match(/([a-z]+)\/([\w\d\/-]+)/);
            if (!match) return;

            const type = match[1];
            const vodIdWithSubfolder = match[2];
            // 提取路径中最后一部分作为ID
            const vodId = vodIdWithSubfolder.split('/').pop();
            
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;

            cards.push({
                vod_id: detailApiUrl,
                vod_name: nameElement.attr('title') || '未知影片',
                vod_pic: imgElement.attr('data-src') || imgElement.attr('src') || '',
                vod_remarks: remarkElement.text().trim() || '',
                ext: { url: detailApiUrl },
            });
        });
        
        log(`HTML直抓模式完成，共找到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`HTML直抓异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- search, getTracks, getPlayinfo 函数 (与v15.0完全相同) ---
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
