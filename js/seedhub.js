// ========================
//  SeedHub 前端脚本（完整稳定版）
// ========================

// --- 必须依赖（XPTV 内置桥接） ---
const cheerio = createCheerio();

const jsonify = (o) => JSON.stringify(o);
const argsify = (o) => (typeof o === 'string' ? JSON.parse(o) : o);
const $log = (msg) => { try { console.log(msg); } catch (e) {} };

const $utils = {
    toastError(msg) { 
        try { toast(msg); } catch (e) { console.log('[Toast]', msg); } 
    }
};

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

// ========================
//     SeedHub 配置
// ========================

const searchCacheForGetCards = {}

const appConfig = {
    ver: 1,
    title: 'SeedHub',
    site: 'https://www.seedhub.cc',
    tabs: [
        { name: '首页', ext: { id: '/' } },
        { name: '电影', ext: { id: '/categories/1/movies/' } },
        { name: '剧集', ext: { id: '/categories/3/movies/' } },
        { name: '动漫', ext: { id: '/categories/2/movies/' } }
    ],
};

async function getConfig() {
    return jsonify(appConfig)
}

// ========================
//         列表
// ========================

async function getCards(ext) {
    ext = argsify(ext)
    let cards = []
    let { page = 1, id } = ext

    const url = appConfig.site + id + `?page=${page}`
    const { data } = await $fetch.get(url, {
        headers: {
            "User-Agent": UA,
            "Referer": appConfig.site + '/',
            "Origin": appConfig.site
        },
    });

    const $ = cheerio.load(data)
    const videos = $('.cover')
    videos.each((_, e) => {
        const href = $(e).find('a').attr('href')
        const title = $(e).find('a img').attr('alt')
        const cover = $(e).find('a img').attr('src')

        cards.push({
            vod_id: href,
            vod_name: title,
            vod_pic: cover,
            vod_remarks: '',
            ext: { url: `${appConfig.site}${href}` },
        })
    })

    // --- 原分页逻辑 ---
    let pagecount = 0;
    $('span.page a').each((_, link) => {
        const p = parseInt($(link).text().trim());
        if (!isNaN(p)) pagecount = Math.max(pagecount, p);
    });

    if (cards.length === 0) {
        pagecount = page - 1;
        if (pagecount < 1) pagecount = 1;
    } else if (pagecount === 0) {
        pagecount = page;
    }

    searchCacheForGetCards.pagecount = pagecount;

    return jsonify({
        list: cards,
        pagecount,
        total: cards.length,
    })
}

// ========================
//         详情 tracks
// ========================

async function getTracks(ext) {
    ext = argsify(ext);
    const detailUrl = ext.url;

    const { data: detailHtml } = await $fetch.get(detailUrl, {
        headers: {
            'User-Agent': UA,
            'Referer': detailUrl,
            'Origin': appConfig.site
        },
    });

    const $ = cheerio.load(detailHtml);
    const panLinkElements = $('.pan-links li a');

    if (panLinkElements.length === 0) {
        $utils.toastError('没有网盘资源条目');
        return jsonify({ list: [] });
    }

    const postTitle = $('h1').text().replace(/^#\s*/, '').split(' ')[0].trim();

    const trackPromises = panLinkElements.get().map(async (link) => {
        const intermediateUrl = appConfig.site + $(link).attr('href');
        const originalTitle = $(link).attr('title') || $(link).text().trim();

        try {
            const { data: intermediateHtml } = await $fetch.get(intermediateUrl, {
                headers: {
                    'User-Agent': UA,
                    'Referer': detailUrl,
                    'Origin': appConfig.site
                },
            });

            const match = intermediateHtml.match(/var panLink = "([^"]+)"/);
            if (match && match[1]) {
                const finalPanUrl = match[1];

                let newName = originalTitle;
                const specMatch = originalTitle.match(/(合集|次时代|\d+部|\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|原盘|REMUX|[\d\.]+G[B]?)/ig);

                if (specMatch) {
                    const tags = specMatch.join(' ');
                    newName = `${postTitle} [${tags}]`;
                } else {
                    newName = postTitle;
                }

                return { name: newName, pan: finalPanUrl };
            }
        } catch (e) { }
        return null;
    });

    const resolvedTracks = await Promise.all(trackPromises);
    const tracks = resolvedTracks.filter(e => e);

    if (!tracks.length) {
        $utils.toastError('所有网盘链接解析均失败');
        return jsonify({ list: [] });
    }

    return jsonify({
        list: [{ title: postTitle, tracks }],
    });
}

// ========================
//        播放地址
// ========================

async function getPlayinfo(ext) {
    ext = argsify(ext);
    return jsonify({ urls: [ext.url] })
}

// ========================
//         搜索
// ========================

const searchCache = {};

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;

    if (!text) return jsonify({ list: [] });

    if (searchCache.keyword !== text) {
        $log(`新关键词 "${text}"，重置搜索缓存`);
        searchCache.keyword = text;
        searchCache.data = {};
        searchCache.pagecount = 0;
    }

    if (searchCache.pagecount > 0 && page > searchCache.pagecount) {
        return jsonify({ list: [], pagecount: searchCache.pagecount });
    }

    if (searchCache.data && searchCache.data[page]) {
        return jsonify({
            list: searchCache.data[page],
            pagecount: searchCache.pagecount
        });
    }

    const url = `${appConfig.site}/s/${encodeURIComponent(text)}/?page=${page}`;
    const { data } = await $fetch.get(url, {
        headers: {
            'User-Agent': UA,
            'Referer': appConfig.site + '/',
            'Origin': appConfig.site
        },
    });

    const $ = cheerio.load(data);
    const cards = [];
    $('.cover').each((_, e) => {
        const href = $(e).find('a').attr('href');
        const title = $(e).find('a img').attr('alt');
        const cover = $(e).find('a img').attr('src');

        cards.push({
            vod_id: href,
            vod_name: title,
            vod_pic: cover,
            vod_remarks: '',
            ext: { url: `${appConfig.site}${href}` },
        });
    });

    let pagecount = searchCache.pagecount;
    if (pagecount === 0) {
        $('span.page a').each((_, link) => {
            const p = parseInt($(link).text().trim());
            if (!isNaN(p)) pagecount = Math.max(pagecount, p);
        });
    }

    if (!cards.length) {
        pagecount = page > 1 ? page - 1 : (pagecount > 0 ? pagecount : 1);
    } else if (pagecount === 0) {
        pagecount = page;
    }

    searchCache.pagecount = pagecount;
    searchCache.data[page] = cards;

    return jsonify({
        list: cards,
        pagecount,
    });
}

// ========================
//   必须导出
// ========================

export default {
    getConfig,
    getCards,
    getTracks,
    getPlayinfo,
    search,
};
