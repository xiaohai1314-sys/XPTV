// == 反混淆说明 ==
// 原始代码来自 jsjiami.com.v7 加密
// 反混淆后保留所有逻辑、变量名已重命名更清晰
// 依赖：cheerio, $fetch (类似 axios/fetch), jsonify, argsify, parseJsonIfString
// 功能：视频网站爬虫（ikanbot.com）
// 包含：配置、列表、详情、播放、搜索

const cheerio = require('cheerio');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const headers = {
    'Referer': 'https://v.ikanbot.com/',
    'Origin': 'https://v.ikanbot.com',
    'User-Agent': UA
};

const appConfig = {
    ver: 1,
    title: 'ikanbot 影视',
    site: 'https://v.ikanbot.com',
    tabs: [
        {
            name: '电影',
            ext: { url: 'https://v.ikanbot.com/hot/index-movie-热门-p-{page}.html' }
        },
        {
            name: '剧集',
            ext: { url: 'https://v.ikanbot.com/hot/index-tv-热门-p-{page}.html' }
        }
    ]
};

// 获取配置
async function getConfig() {
    return jsonify(appConfig);
}

// 获取视频卡片列表（首页、分类页）
async function getCards(input) {
    const args = argsify(input);
    let list = [];
    let url = args.ext.url;
    const page = args.page || 1;

    // 处理分页
    if (page === 1) {
        url = url.replace('-p-1.html', '.html');
    } else {
        url = url.replace('{page}', page);
    }

    // 请求页面
    const { data: html } = await $fetch.get(url, { headers });
    const $ = cheerio.load(html);

    // 遍历每个视频项
    $('div.media').each((i, el) => {
        const $item = $(el);
        const $link = $item.find('a.cover-link');
        const href = $link.attr('href');

        list.push({
            vod_id: href,
            vod_name: $item.find('p').text().trim(),
            vod_pic: appConfig.site + $item.find('img').attr('data-src'),
            vod_remarks: '',
            ext: {
                url: appConfig.site + href
            },
            id: href.replace('/play/', '').split('?')[0]
        });
    });

    return jsonify({ list });
}

// 获取播放线路和集数
async function getTracks(input) {
    const args = argsify(input);
    let tracksList = [];
    const detailUrl = args.ext.url;

    // 请求详情页
    const { data: html } = await $fetch.get(detailUrl, { headers });
    const $ = cheerio.load(html);

    // 获取加密参数
    const currentId = $('#current_id').val();
    const playSourceData = $('#play_source_data').val();

    if (!currentId || !playSourceData) return jsonify({ list: [] });

    // 解密 playSourceData
    const len = currentId.length;
    const suffix = currentId.substring(len - 4);
    let decoded = '';
    let remaining = playSourceData;

    for (let i = 0; i < suffix.length; i++) {
        const digit = parseInt(suffix[i]);
        const step = (digit % 3) + 1;
        const part = remaining.substring(step, step + 8);
        decoded += part;
        remaining = remaining.substring(step + 8);
    }

    // 获取 mtype
    const mtype = $('#mtype').val();

    // 构造播放接口 URL
    const playApiUrl = `${appConfig.site}/play/${args.id}&mtype=${mtype}&sign=${decoded}`;

    // 请求播放数据
    const { data: playResponse } = await $fetch.get(playApiUrl, { headers });
    const playData = parseJsonIfString(playResponse);
    const sources = playData.data.list;

    // 遍历线路
    sources.forEach((source, index) => {
        const lineName = `线路${index + 1}`;
        const trackGroup = { title: lineName, tracks: [] };

        // 解析每一集
        parseJsonIfString(source.urls).forEach(ep => {
            const [name, url] = ep.url.split('$');
            trackGroup.tracks.push({
                name: name,
                ext: { url: url }
            });
        });

        tracksList.push(trackGroup);
    });

    return jsonify({ list: tracksList });
}

// 获取播放链接（直链）
async function getPlayinfo(input) {
    const args = argsify(input);
    return jsonify({ urls: [args.ext.url] });
}

// 搜索功能
async function search(input) {
    const args = argsify(input);
    let list = [];
    const keyword = encodeURIComponent(args.wd);
    const page = args.page || 1;
    const pageParam = page > 1 ? `&p=${page}` : '';
    const searchUrl = `${appConfig.site}/search?q=${keyword}${pageParam}`;

    const { data: html } = await $fetch.get(searchUrl, { headers });
    const $ = cheerio.load(html);

    $('div.media').each((i, el) => {
        const $item = $(el);
        const $link = $item.find('div.media-left a.cover-link');
        const href = $link.attr('href');

        list.push({
            vod_id: href,
            vod_name: $item.find('h3').text().trim(),
            vod_pic: $item.find('img').attr('src'),
            vod_remarks: $item.find('div.media-body p').text().trim(),
            ext: {
                url: appConfig.site + href
            },
            id: href.replace('/play/', '').split('?')[0]
        });
    });

    return jsonify({ list });
}

// 辅助函数：安全解析 JSON
function parseJsonIfString(str) {
    if (typeof str === 'string') {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.error('Invalid JSON string', e);
            return null;
        }
    }
    return str;
}

// 版本标识（保留原样）
var version_ = 'jsjiami.com.v7';
