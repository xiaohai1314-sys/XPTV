/**
 * =================================================================
 *                      高清重制版爬虫脚本
 * =================================================================
 *
 * 原始作者: (未知)
 * 原始来源: jsjiami.com.v7 混淆代码
 * 反混淆与重构: Manus AI
 *
 * 描述:
 * 本脚本用于从“奈飞工厂”(netflixgc.com)网站获取影视资源。
 * 它被设计在特定的App环境中运行，该环境提供了以下全局函数:
 * - createCheerio(): 用于创建cheerio实例，解析HTML。
 * - createCryptoJS(): 用于创建CryptoJS实例，进行加密解密。
 * - $fetch: 一个内置的网络请求工具，类似axios或fetch。
 * - jsonify(): 将JavaScript对象转换为App可识别的JSON字符串。
 * - argsify(): 将App传入的参数字符串转换为JavaScript对象。
 *
 * =================================================================
 */

// ---------------------------------------------------
// 1. 初始化与全局配置
// ---------------------------------------------------

// 从App环境中获取必需的库和工具
const cheerio = createCheerio();
const CryptoJS = createCryptoJS();

// 定义全局常量
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';
const headers = {
    'Referer': 'https://www.netflixgc.com/',
    'Origin': 'https://www.netflixgc.com/',
    'User-Agent': UA
};

// App基础配置 (这部分与原始代码一致)
const appConfig = {
    'ver': 1,
    'title': '奈飞工厂',
    'site': 'https://www.netflixgc.com',
    'tabs': [
        { 'name': '电影', 'ext': { 'dmtype': '1' } },
        { 'name': '电视剧', 'ext': { 'dmtype': '2' } },
        { 'name': '漫剧', 'ext': { 'dmtype': '3' } },
        { 'name': '综艺', 'ext': { 'dmtype': '23' } },
        { 'name': '纪录片', 'ext': { 'dmtype': '24' } },
        { 'name': '伦理', 'ext': { 'dmtype': '30' } }
    ]
};

// ---------------------------------------------------
// 2. 核心功能函数
// ---------------------------------------------------

/**
 * 获取App配置信息
 */
async function getConfig() {
    return jsonify(appConfig);
}

/**
 * 获取分类下的影视卡片列表
 * @param {string} argsStr - App传入的参数字符串, e.g., '{"dmtype":"1","page":1}'
 */
async function getCards(argsStr) {
    const args = argsify(argsStr);
    let cards = [];
    const apiUrl = 'https://www.netflixgc.com/api.php/provide/vod';
    const page = args.page || 1;
    const categoryType = args.dmtype;
    
    // 生成请求签名
    const timestamp = Math.floor(new Date().getTime() / 1000);
    const sign = CryptoJS.MD5('DS' + timestamp + 'DCC147D11943AF75').toString(CryptoJS.enc.Hex);
    
    // 构造请求体
    const requestBody = `type=<LaTex>${categoryType}&page=$</LaTex>{page}&time=<LaTex>${timestamp}&sign=$</LaTex>{sign}`;
    
    // 发送POST请求
    const { data: responseData } = await $fetch.post(apiUrl, requestBody, { 'headers': headers });
    
    // 解析并格式化数据
    const responseJson = argsify(responseData); // 使用argsify解析返回的JSON字符串
    if (responseJson && responseJson.list) {
        responseJson.list.forEach(item => {
            cards.push({
                'vod_id': item.vod_id.toString(),
                'vod_name': item.vod_name,
                'vod_pic': item.vod_pic,
                'vod_remarks': item.vod_remarks,
                'ext': { 'url': '/voddetail/' + item.vod_id.toString() + '.html' }
            });
        });
    }
    
    return jsonify({ 'list': cards });
}

/**
 * 获取指定影视的播放列表 (Tracks)
 * @param {string} argsStr - App传入的参数字符串, e.g., '{"url":"/voddetail/123.html"}'
 */
async function getTracks(argsStr) {
    const args = argsify(argsStr);
    let tracksList = [];
    const detailUrl = appConfig.site + args.url; // 拼接完整URL
    
    const { data: html } = await $fetch.get(detailUrl, { 'headers': headers });
    const $ = cheerio.load(html);
    
    let sources = [];
    $('a.swiper-slide').each((index, element) => {
        sources.push($(element).text().trim());
    });
    
    $('div.anthology-list-box').each((index, element) => {
        let trackGroup = {
            'title': sources[index] || `播放源${index + 1}`,
            'tracks': []
        };
        $(element).find('a').each((i, el) => {
            trackGroup.tracks.push({
                'name': $(el).text(),
                'pan': '',
                'ext': { 'url': appConfig.site + $(el).attr('href') }
            });
        });
        tracksList.push(trackGroup);
    });
    
    return jsonify({ 'list': tracksList });
}

/**
 * 获取视频的真实播放地址
 * @param {string} argsStr - App传入的参数字符串, e.g., '{"url":"https://.../play/..."}'
 */
async function getPlayinfo(argsStr) {
    const args = argsify(argsStr);
    const playPageUrl = args.url;
    
    const { data: html } = await $fetch.get(playPageUrl, { 'headers': headers });
    
    const playerDataMatch = html.match(/player_aaaa=(.+?)<\/script>/);
    if (!playerDataMatch) return jsonify({ 'urls': [] });

    const playerData = JSON.parse(playerDataMatch[1]);
    let finalUrl = '';
    
    if (playerData.from === '1') {
        finalUrl = unescape(playerData.url);
    } else if (playerData.from === '2') {
        const decodedUrlPart = unescape(base64decode(playerData.url));
        const nextApiUrl = 'https://danmu.yhpc.vip/api.php?url=' + decodedUrlPart;
        
        const response = await $fetch.get(nextApiUrl, { 'headers': headers });
        
        const encryptedUrlMatch = response.data.match(/"url"\s*:\s*"([^"]+)"/);
        const uidMatch = response.data.match(/"uid"\s*:\s*"([^"]+)"/);

        if (encryptedUrlMatch && uidMatch) {
            const encryptedUrl = encryptedUrlMatch[1].replace(/\\/g, '');
            const uid = uidMatch[1];
            
            const key = CryptoJS.enc.Utf8.parse('A42EAC0C2B428472' + uid + '2F131BE91247866E');
            const iv = CryptoJS.enc.Hex.parse('2F131BE91247866E');
            
            const decrypted = CryptoJS.AES.decrypt(
                { 'ciphertext': CryptoJS.enc.Base64.parse(encryptedUrl) },
                key,
                { 'iv': iv, 'mode': CryptoJS.mode.CBC, 'padding': CryptoJS.pad.Pkcs7 }
            );
            
            finalUrl = CryptoJS.enc.Utf8.stringify(decrypted);
        }
    }
    
    return jsonify({ 'urls': [finalUrl] });
}

/**
 * 搜索功能
 * @param {string} argsStr - App传入的参数字符串, e.g., '{"text":"关键词","page":1}'
 */
async function search(argsStr) {
    const args = argsify(argsStr);
    let results = [];
    const keyword = encodeURIComponent(args.text);
    const page = args.page || 1;
    
    const searchUrl = `<LaTex>${appConfig.site}/vodsearch/$</LaTex>{keyword}----------${page}---.html`;
    
    const { data: html } = await $fetch.get(searchUrl, { 'headers': headers });
    const $ = cheerio.load(html);
    
    $('div.module-card-item').each((index, element) => {
        const linkElement = $(element).find('a.module-card-item-poster');
        const posterElement = $(element).find('div.module-card-item-poster');
        
        results.push({
            'vod_id': linkElement.attr('href'),
            'vod_name': $(element).find('strong.module-card-item-title').text(),
            'vod_pic': posterElement.attr('data-original-class'),
            'vod_remarks': $(element).find('div.module-card-item-remark').text(),
            'ext': { 'url': linkElement.attr('href') } // URL已经是相对路径，App会自动拼接
        });
    });
    
    return jsonify({ 'list': results });
}

/**
 * Base64解码函数 (从原始代码中保留，因为getPlayinfo需要它)
 */
function base64decode(str) {
    const base64keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let chr1, chr2, chr3;
    let enc1, enc2, enc3, enc4;
    let i = 0;
    str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');
    while (i < str.length) {
        enc1 = base64keys.indexOf(str.charAt(i++));
        enc2 = base64keys.indexOf(str.charAt(i++));
        enc3 = base64keys.indexOf(str.charAt(i++));
        enc4 = base64keys.indexOf(str.charAt(i++));
        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;
        output = output + String.fromCharCode(chr1);
        if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
        }
    }
    return output;
}
