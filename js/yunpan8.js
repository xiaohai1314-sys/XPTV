/**
 * 海绵小站前端插件 - v45.0 增强修正版（2025-08-05）
 */

const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png";

// ✅ 你的原始 Cookie 已放入此处
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";

function log(msg) { try { $log(`[海绵小站 V45.0] ${msg}`); } catch (_) { console.log(`[海绵小站 V45.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function fetchWithCookie(url, options = {}) {
    if (!COOKIE) throw new Error("Cookie 未配置");
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, ...options.headers };
    const finalOptions = { ...options, headers };
    return options.method === 'POST'
        ? $fetch.post(url, options.body, finalOptions)
        : $fetch.get(url, finalOptions);
}

async function reply(url) {
    const threadId = url.match(/thread-(\d+)/)?.[1];
    if (!threadId) return false;
    const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const msgList = ["资源很好,感谢分享!", "感谢楼主!", "找了很久终于找到了!", "赞一个!"];
    try {
        const { data } = await fetchWithCookie(postUrl, {
            method: 'POST',
            body: {
                doctype: 1,
                return_html: 1,
                message: msgList[Math.floor(Math.random() * msgList.length)],
                quotepid: 0,
                quick_reply_message: 0
            },
            headers: { 'Referer': url }
        });
        return !data.includes("您尚未登录");
    } catch { return false; }
}

function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http')) return path;
    return `${SITE_URL}/${path.replace(/^\.?\//, '')}`;
}

const normalizeCode = (rawCode) => {
    const map = {
        '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
        '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
        'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e', 'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i',
        'ｊ': 'j', 'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o', 'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r',
        'ｓ': 's', 'ｔ': 't', 'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z'
    };
    return [...rawCode].map(c => map[c] || c).join('').trim();
};

async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    const { data } = await fetchWithCookie(detailUrl);
    let $ = cheerio.load(data);

    if ($("div.alert.alert-warning").text().includes("回复后")) {
        const ok = await reply(detailUrl);
        if (!ok) return jsonify({ list: [{ title: '提示', tracks: [{ name: 'Cookie失效或无效', pan: '', ext: {} }] }] });
        await new Promise(r => setTimeout(r, 1000));
        const retry = await fetchWithCookie(detailUrl);
        $ = cheerio.load(retry.data);
    }

    const tracks = [];
    const seen = new Set();
    const title = $("h4.break-all").text().trim();
    const msg = $('.message[isfirst="1"]');
    const push = (name, link, pwd = '') => {
        if (!link || seen.has(link)) return;
        seen.add(link);
        tracks.push({ name, pan: link, ext: { pwd: normalizeCode(pwd) } });
    };

    // 引擎一：<a>
    msg.find('a[href*="cloud.189.cn"]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        const parent = $(el).parent().text();
        const pwd = parent.match(/(?:访问码|提取码|密码)\s*[:：]?\s*([\w*.:-]{4,8})/)?.[1] || '';
        push(text.length > 5 ? text : title, href, pwd);
    });

    // 引擎二：分行智能识别
    const lines = msg.text().split(/\n+/).map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        const cur = lines[i], next = lines[i + 1] || '', next2 = lines[i + 2] || '', prev = lines[i - 1] || '';
        const link = cur.match(/https?:\/\/cloud\.189\.cn\/\S+/)?.[0];
        if (link && /访问码.*[:：]?\s*([\w*.:-]{4,8})/.test(next)) return jsonify({ list: [{ title: '云盘', tracks: [ { name: title, pan: link, ext: { pwd: normalizeCode(next.match(/访问码.*[:：]?\s*([\w*.:-]{4,8})/)[1]) } } ] }] });
        if (/访问码/.test(cur) && /^[\w*.:-]{4,8}$/.test(next)) {
            const link2 = lines[i + 2]?.match(/https?:\/\/cloud\.189\.cn\/\S+/)?.[0]
                       || lines[i - 1]?.match(/https?:\/\/cloud\.189\.cn\/\S+/)?.[0] || '';
            if (link2) push(title, link2, next);
        }
    }

    // 引擎三：纯文本顺序分配
    const raw = msg.text();
    const allLinks = (raw.match(/https?:\/\/cloud\.189\.cn\/[^\s）)）]+/g) || []).filter(l => !seen.has(l));
    const allCodes = [...raw.matchAll(/(?:访问码|提取码|密码)\s*[:：]?\s*([\w*.:-]{4,8})/g)].map(m => m[1]);
    for (let i = 0; i < allLinks.length; i++) {
        push(title, allLinks[i], allCodes[i] || '');
    }

    if (tracks.length === 0) tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
    return jsonify({ list: [{ title: '云盘', tracks }] });
}

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${SITE_URL}/${id}-${page}.htm`;
    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        const cards = [];
        $("ul.threadlist > li.media.thread").each((_, item) => {
            const pic = $(item).find("a:first-child > img.avatar-3")?.attr("src");
            cards.push({
                vod_id: $(item).find(".subject a")?.attr("href") || "",
                vod_name: $(item).find(".subject a")?.text().trim() || "",
                vod_pic: getCorrectPicUrl(pic),
                vod_remarks: $(item).find(".text-grey:last-child")?.text().trim() || "",
                ext: { url: $(item).find(".subject a")?.attr("href") || "" }
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        return jsonify({ list: [] });
    }
}

async function getConfig() {
    return jsonify({
        ver: 1, title: '海绵小站', site: SITE_URL,
        tabs: [
            { name: '电影', ext: { id: 'forum-1' } },
            { name: '剧集', ext: { id: 'forum-2' } },
            { name: '动漫', ext: { id: 'forum-3' } },
            { name: '综艺', ext: { id: 'forum-5' } },
        ],
    });
}

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const url = `${SITE_URL}/search-${encodeURIComponent(text)}.htm`;
    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        const cards = [];
        $("ul.threadlist > li.media.thread").each((_, item) => {
            const pic = $(item).find("a:first-child > img.avatar-3")?.attr("src");
            cards.push({
                vod_id: $(item).find(".subject a")?.attr("href") || "",
                vod_name: $(item).find(".subject a")?.text().trim() || "",
                vod_pic: getCorrectPicUrl(pic),
                vod_remarks: $(item).find(".text-grey:last-child")?.text().trim() || "",
                ext: { url: $(item).find(".subject a")?.attr("href") || "" }
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        return jsonify({ list: [] });
    }
}

async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v45.0 最终增强修正版)');
