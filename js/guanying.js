// =======================================================================
// v15.1 前端脚本 (观影网 - 智能融合抓取版)
// 更新日志:
// - 【重大升级】重构getCards函数，使其能够同时处理“HTML直出”和“JS变量”两种渲染模式。
// - 【修复BUG】解决了部分影片因采用不同渲染方式而导致海报和信息无法显示的致命问题。
// - 【健壮性提升】优先从HTML元素直接提取数据，JS变量作为备用，确保数据覆盖最全面。
// =======================================================================

// --- 配置区 (与v15.0完全相同) ---
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = "http://192.168.10.111:5000"; // ★★★ 请务必修改为你的后端IP和端口 ★★★

const appConfig = {
    ver: 15.1,
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// --- 核心函数 (与v15.0完全相同 ) ---
function log(msg) { try { $log(`[观影网 v15.1] ${msg}`); } catch (_) { console.log(`[观影网 v15.1] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【重大升级的 getCards 函数】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================
async function getCards(ext) {
    ext = argsify(ext);
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        let cards = [];
        const processedUrls = new Set(); // 用于防止重复添加

        // --- 策略一: 优先从HTML元素直接提取 (处理方式B) ---
        log("执行策略一：从HTML元素直接提取...");
        $('ul.content-list li').each((_, element) => {
            const $li = $(element);
            const linkElement = $li.find('a.li-img-cover');
            const imgElement = $li.find('img');
            const nameElement = $li.find('h3 a');
            const remarkElement = $li.find('span.bottom > span:last-child');

            const href = linkElement.attr('href');
            if (!href || !href.startsWith('/')) return;

            const vod_id_path = href.substring(1);
            const match = vod_id_path.match(/([a-z]+)\/(\w+)/);
            if (!match) return;

            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            
            // 检查是否已处理过，避免重复
            if (processedUrls.has(detailApiUrl)) return;

            cards.push({
                vod_id: detailApiUrl,
                vod_name: nameElement.attr('title') || '未知影片',
                vod_pic: imgElement.attr('data-src') || imgElement.attr('src') || '',
                vod_remarks: remarkElement.text().trim() || '',
                ext: { url: detailApiUrl },
            });
            processedUrls.add(detailApiUrl);
        });
        log(`策略一完成，提取到 ${cards.length} 个项目。`);

        // --- 策略二: 从JS变量提取作为补充 (处理方式A) ---
        log("执行策略二：从JS变量提取作为补充...");
        const scriptContent = $('script').filter((_, script) => $(script).html().includes('_obj.header')).html();
        if (scriptContent) {
            const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
            if (inlistMatch && inlistMatch[1]) {
                const inlistData = JSON.parse(inlistMatch[1]);
                if (inlistData && inlistData.i) {
                    let js_added_count = 0;
                    inlistData.i.forEach((item, index) => {
                        const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
                        
                        // 如果策略一没有处理过这个影片，才进行添加
                        if (!processedUrls.has(detailApiUrl)) {
                            cards.push({
                                vod_id: detailApiUrl,
                                vod_name: inlistData.t[index],
                                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                                vod_remarks: inlistData.g[index],
                                ext: { url: detailApiUrl },
                            } );
                            processedUrls.add(detailApiUrl);
                            js_added_count++;
                        }
                    });
                    log(`策略二完成，补充了 ${js_added_count} 个新项目。`);
                }
            }
        } else {
            log("策略二跳过：未找到包含 _obj.inlist 的JS变量。");
        }

        log(`总计获取到 ${cards.length} 个影片。`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`获取卡片列表异常: ${e.message}`);
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
