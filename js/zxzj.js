/**
 * 脚本名称: 爱看机器人 (ikanbot) 视频信息抓取器
 * 功能: 从 v.ikanbot.com 网站抓取电影和剧集信息，包括列表、详情和播放地址。
 * 作者: (原始作者未知, 由 Manus 反混淆和注释)
 * 版本: 1.0
 */

// =================================================================================
// 1. 全局配置 (Global Configuration)
// =================================================================================

// 模拟浏览器的 User-Agent，避免被服务器识别为爬虫
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// HTTP 请求头，包含 Referer 和 Origin，模拟真实的用户访问来源
const headers = {
    'Referer': 'https://v.ikanbot.com/',
    'Origin': 'https://v.ikanbot.com',
    'User-Agent': UA
};

// 应用的基本配置信息
const appConfig = {
    'ver': 1,
    'title': '爱看机器人',
    'site': 'https://v.ikanbot.com',
    'tabs': [
        {
            'name': '电影',
            'ext': { 'url': 'https://v.ikanbot.com/hot/index-movie-%E7%83%AD%E9%97%A8-p-{page}.html' }
        },
        {
            'name': '剧集',
            'ext': { 'url': 'https://v.ikanbot.com/hot/index-tv-%E7%83%AD%E9%97%A8-p-{page}.html' }
        }
    ]
};

// 依赖项 (假设在环境中已提供)
// const cheerio = createCheerio(); // 用于解析 HTML
// const $fetch = ...;             // HTTP 请求客户端
// const jsonify = (data) => JSON.stringify(data); // 将对象转为 JSON 字符串
// const argsify = (jsonString) => JSON.parse(jsonString); // 将 JSON 字符串转为对象

// =================================================================================
// 2. 核心功能函数 (Core Functions)
// =================================================================================

/**
 * 获取应用配置
 * @returns {string} - JSON 格式的应用配置
 */
async function getConfig() {
    return jsonify(appConfig);
}

/**
 * 获取分类下的视频卡片列表 (电影或剧集)
 * @param {string} args - JSON 字符串，包含 'url' 和 'page'
 * @returns {string} - JSON 格式的视频列表
 */
async function getCards(args) {
    const { url, page = 1 } = argsify(args);
    let targetUrl = url;

    // 根据页码调整 URL
    if (page === 1) {
        targetUrl = url.replace('-p-{page}', '');
    } else {
        targetUrl = url.replace('{page}', page);
    }

    // 发起 HTTP 请求获取页面 HTML
    const { data: html } = await $fetch.get(targetUrl, { headers });
    const $ = cheerio.load(html);
    const videoList = [];

    // 使用 Cheerio 解析 HTML，提取视频信息
    $('div.media').each((index, element) => {
        const <LaTex>$element = $</LaTex>(element);
        videoList.push({
            'vod_id': $element.find('a.cover-link').attr('href'),
            'vod_name': $element.find('p').text(),
            'vod_pic': appConfig.site + $element.find('img.lazyload').attr('data-src'),
            'vod_remarks': '',
            'ext': {
                'url': appConfig.site + $element.find('a.cover-link').attr('href'),
                'id': $element.find('a.cover-link').attr('href').replace('/play/', '').replace('.html', '')
            }
        });
    });

    return jsonify({ 'list': videoList });
}

/**
 * 获取视频的播放列表 (Tracks)
 * @param {string} args - JSON 字符串，包含视频详情页的 'url' 和 'id'
 * @returns {string} - JSON 格式的播放列表
 */
async function getTracks(args) {
    const { url, id } = argsify(args);
    const playList = [];

    // 1. 访问视频详情页，获取加密播放列表所需参数
    const { data: html } = await $fetch.get(url, { headers });
    const $ = cheerio.load(html);

    const currentId = $('#current_id').val(); // 视频ID
    const currentKey = $('#current_key').val(); // 解密密钥的一部分
    const mtype = $('#mtype').val(); // 媒体类型

    if (!currentId || !currentKey) return;

    // 2. 解密算法，从 currentKey 中提取真正的密钥
    const keyLength = currentId.length;
    const keySuffix = currentId.substring(keyLength - 4, keyLength);
    let decodedParts = [];

    let tempKey = currentKey;
    for (let i = 0; i < keySuffix.length; i++) {
        const digit = parseInt(keySuffix[i]);
        const startIndex = (digit % 3) + 1;
        decodedParts[i] = tempKey.substring(startIndex, startIndex + 8);
        tempKey = tempKey.substring(startIndex + 8);
    }
    const finalKey = decodedParts.join('');

    // 3. 构建请求播放列表的 API URL
    const apiUrl = `/api/get_player_list?id=<LaTex>${id}&mtype=$</LaTex>{mtype}&key=${finalKey}`;
    const fullApiUrl = appConfig.site + apiUrl;

    // 4. 请求 API 获取播放列表数据
    const { data: apiResponse } = await $fetch.get(fullApiUrl, { headers });
    const playData = parseJsonIfString(apiResponse).data.pl;
    const sources = [];

    // 5. 解析播放列表数据
    playData.forEach((source, index) => {
        sources.push(`线路${index + 1}`);
        const trackGroup = {
            'title': sources[index],
            'tracks': []
        };
        parseJsonIfString(source.v).forEach((episode) => {
            trackGroup.tracks.push({
                'name': episode.url.split('$')[0],
                'ext': { 'url': episode.url.split('$')[1] }
            });
        });
        playList.push(trackGroup);
    });

    return jsonify({ 'list': playList });
}

/**
 * 获取最终的播放信息 (m3u8 地址)
 * @param {string} args - JSON 字符串，包含播放页的 'url'
 * @returns {string} - JSON 格式的播放信息
 */
async function getPlayinfo(args) {
    const { url } = argsify(args);
    return jsonify({ 'urls': [url] });
}

/**
 * 搜索视频
 * @param {string} args - JSON 字符串，包含搜索关键词 'wd'
 * @returns {string} - JSON 格式的搜索结果列表
 */
async function search(args) {
    const { wd } = argsify(args);
    const searchResults = [];
    const encodedKeyword = encodeURIComponent(wd);

    // 构建搜索 URL
    const searchUrl = `<LaTex>${appConfig.site}/search?q=$</LaTex>{encodedKeyword}`;

    // 获取搜索结果页面
    const { data: html } = await $fetch.get(searchUrl, { headers });
    const $ = cheerio.load(html);

    // 解析搜索结果
    $('div.media').each((index, element) => {
        const <LaTex>$element = $</LaTex>(element);
        searchResults.push({
            'vod_id': $element.find('div.media-left a.cover-link').attr('href'),
            'vod_name': $element.find('h5.title a').text(),
            'vod_pic': $element.find('img.lazyload').attr('data-src'),
            'vod_remarks': $element.find('p.other-info').text(),
            'ext': {
                'url': appConfig.site + $element.find('div.media-left a.cover-link').attr('href'),
                'id': $element.find('div.media-left a.cover-link').attr('href').replace('/play/', '').replace('.html', '')
            }
        });
    });

    return jsonify({ 'list': searchResults });
}

/**
 * 辅助函数：如果输入是字符串，则解析为 JSON
 * @param {any} data
 * @returns {object | any}
 */
function parseJsonIfString(data) {
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Invalid JSON string', e);
            return null;
        }
    }
    return data;
}
