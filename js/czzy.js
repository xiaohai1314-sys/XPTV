/**
 * 增强版：在 V4.0 基础上增加【分类分页锁】防止无限重复循环
 * 仅新增分页锁，其他逻辑完全不改
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.1.3:3003/search";
const SITE_URL = "https://reboys.cn";

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === "string") ? JSON.parse(ext) : (ext || {}); }
function jsonify(o) { return JSON.stringify(o); }
function getCorrectUrl(path) {
    if (!path || path.startsWith("http")) return path || "";
    return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

// --- 入口 ---
async function getConfig() {
    log("==== 插件初始化 V4.0 + 分页锁 ====");
    return jsonify({
        ver: 4.0,
        title: "4k热播影视",
        site: SITE_URL,
        cookie: "",
        tabs: [
            { name: "短剧", ext: { id: 1 } },
            { name: "电影", ext: { id: 2 } },
            { name: "电视剧", ext: { id: 3 } },
            { name: "动漫", ext: { id: 4 } },
            { name: "综艺", ext: { id: 5 } },
        ]
    });
}

// ★★★★★ 分类页（增加分页锁）★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = Number(ext.page || 1);

    log(`[getCards] 分类ID: ${categoryId}, 页码: ${page}`);

    // -----------------------------------------------------
    // ⭐⭐⭐ 新增：分页锁（阻止无限重复加载）
    // -----------------------------------------------------
    if (page > 1) {
        log(`[getCards] 页码 > 1，触发分页锁，返回空列表以阻止无限循环`);
        return jsonify({ list: [] });
    }
    // -----------------------------------------------------

    try {
        log(`[getCards] 正在加载首页 HTML: ${SITE_URL}`);
        const { data } = await $fetch.get(SITE_URL, {
            headers: { "User-Agent": UA }
        });
        const $ = cheerio.load(data);
        const cards = [];

        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        if (contentBlock.length === 0) {
            log(`[getCards] ❌ 未找到分类块 ID = ${categoryId}`);
            return jsonify({ list: [] });
        }

        contentBlock.find("a.item").each((_, element) => {
            const el = $(element);
            const url = el.attr("href");

            cards.push({
                vod_id: getCorrectUrl(url),
                vod_name: el.find("p").text().trim(),
                vod_pic: getCorrectUrl(el.find("img").attr("src")),
                vod_remarks: "",
                ext: { url: getCorrectUrl(url) }
            });
        });

        log(`[getCards] ✓ 成功提取 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[getCards] ❌ 异常：${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★ 搜索功能（保持不变）★★★★★
async function search(ext) {
    ext = argsify(ext);
    const kw = ext.text || "";
    const page = Number(ext.page || 1);

    if (page > 1) {
        log(`[search] 页码 > 1，返回空结果避免重复搜索`);
        return jsonify({ list: [] });
    }

    if (!kw) return jsonify({ list: [] });

    const url = `${API_ENDPOINT}?keyword=${encodeURIComponent(kw)}`;
    log(`[search] 请求 API: ${url}`);

    try {
        const { data: jsonString } = await $fetch.get(url, { headers: { "User-Agent": UA } });
        const response = JSON.parse(jsonString);

        if (response.code !== 0) return jsonify({ list: [] });

        const results = response.data?.data?.results || [];
        const list = results.map(item => {
            const link = item.links?.[0]?.url;
            if (!link) return null;
            return {
                vod_id: link,
                vod_name: item.title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: item.datetime ? new Date(item.datetime).toLocaleDateString() : "未知时间",
                ext: { url: link }
            };
        }).filter(Boolean);

        return jsonify({ list });
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★ 详情页（不变）★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url;
    if (!id) return jsonify({ list: [] });

    if (id.includes("pan.quark.cn") || id.includes("pan.baidu.com") || id.includes("aliyundrive.com")) {
        let pan = "网盘资源";
        if (id.includes("quark")) pan = "夸克网盘";
        if (id.includes("baidu")) pan = "百度网盘";
        if (id.includes("aliyundrive")) pan = "阿里云盘";

        return jsonify({
            list: [{ title: "点击播放", tracks: [{ name: pan, pan: id, ext: {} }] }]
        });
    }

    const keyword = id.split("/").pop().replace(".html", "");
    const api = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;

    try {
        const { data: jsonString } = await $fetch.get(api);
        const response = JSON.parse(jsonString);
        const finalUrl = response.data?.data?.results?.[0]?.links?.[0]?.url;

        let panName = "夸克网盘";
        if (finalUrl.includes("baidu")) panName = "百度网盘";
        if (finalUrl.includes("aliyundrive")) panName = "阿里云盘";

        return jsonify({
            list: [{ title: "解析成功", tracks: [{ name: panName, pan: finalUrl, ext: {} }] }]
        });
    } catch (e) {
        return jsonify({
            list: [{ title: "自动解析失败", tracks: [{ name: "请手动打开", pan: id, ext: {} }] }]
        });
    }
}

// --- 兼容 ---
async function init() { return getConfig(); }
async function home() {
    const conf = JSON.parse(await getConfig());
    return jsonify({ class: conf.tabs, filters: {} });
}
async function category(tid, pg) {
    const id = typeof tid === "object" ? tid.id : tid;
    return getCards({ id, page: pg || 1 });
}
async function detail(id) { return getTracks({ url: id }); }
async function play(_, id) { return jsonify({ url: id }); }
