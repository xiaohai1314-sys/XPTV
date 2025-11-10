// ---------------------------------------------------
//
//      代码反混淆自: jsjiami.com.v7
//      主要功能: 一个用于影视网站的爬虫接口
//
// ---------------------------------------------------

// 全局配置
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';
const headers = {
    'Referer': 'https://www.netflixgc.com/',
    'Origin': 'https://www.netflixgc.com/',
    'User-Agent': UA
};

// App基础配置
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

/**
 * 获取App配置信息
 */
async function getConfig() {
    return JSON.stringify(appConfig);
}

/**
 * 获取分类下的影视卡片列表
 * @param {Object} args - 参数对象，包含 dmtype (分类ID) 和 page (页码)
 */
async function getCards(args) {
    let cards = [];
    const apiUrl = 'https://www.netflixgc.com/api.php/provide/vod';
    const page = args.page || 1;
    const categoryType = args.dmtype;
    
    // 生成请求所需的签名
    const timestamp = Math.floor(new Date().getTime() / 1000);
    const sign = CryptoJS.MD5('DS' + timestamp + 'DCC147D11943AF75').toString(CryptoJS.enc.Hex);
    
    // 构造请求体
    const requestBody = `type=<LaTex>${categoryType}&page=$</LaTex>{page}&time=<LaTex>${timestamp}&sign=$</LaTex>{sign}`;
    
    // 发送POST请求
    const { data: responseData } = await $fetch.post(apiUrl, requestBody, { 'headers': headers });
    
    // 解析返回的JSON数据并格式化
    JSON.parse(responseData).list.forEach(item => {
        cards.push({
            'vod_id': item.vod_id.toString(),
            'vod_name': item.vod_name,
            'vod_pic': item.vod_pic,
            'vod_remarks': item.vod_remarks,
            'ext': { 'url': '/voddetail/' + item.vod_id.toString() + '.html' }
        });
    });
    
    return JSON.stringify({ 'list': cards });
}

/**
 * 获取指定影视的播放列表 (Tracks)
 * @param {Object} args - 参数对象，包含 url (详情页URL)
 */
async function getTracks(args) {
    let tracksList = [];
    const detailUrl = args.url;
    
    // 获取详情页HTML
    const { data: html } = await $fetch.get(detailUrl, { 'headers': headers });
    const $ = cheerio.load(html);
    
    // 解析播放源名称
    let sources = [];
    $('a.swiper-slide').each((index, element) => {
        sources.push($(element).text().trim());
    });
    
    // 解析每个播放源下的剧集列表
    $('div.anthology-list-box').each((index, element) => {
        let trackGroup = {
            'title': sources[index],
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
    
    return JSON.stringify({ 'list': tracksList });
}

/**
 * 获取视频的真实播放地址
 * @param {Object} args - 参数对象，包含 url (播放页URL)
 */
async function getPlayinfo(args) {
    const playPageUrl = args.url;
    
    // 获取播放页HTML
    const { data: html } = await $fetch.get(playPageUrl, { 'headers': headers });
    
    // 从HTML中提取播放器配置信息 (一个JSON字符串)
    const playerData = JSON.parse(html.match(/player_aaaa=(.+?)<\/script>/)[1]);
    
    let finalUrl;
    
    // 根据 playerData.from 的不同值，采用不同的解密策略
    if (playerData.from === '1') {
        // 直接解码
        finalUrl = unescape(playerData.url);
    } else if (playerData.from === '2') {
        // 经过多次解密和请求
        let decodedUrlPart = unescape(base64decode(playerData.url));
        let nextApiUrl = 'https://danmu.yhpc.vip/api.php?url=' + decodedUrlPart;
        
        const response = await $fetch.get(nextApiUrl, { 'headers': headers });
        
        // 从返回的数据中提取加密的URL和UID
        let encryptedUrl = response.data.match(/"url"\s*:\s*"([^"]+)"/)[1].replace(/\\/g, '');
        const uid = response.data.match(/"uid"\s*:\s*"([^"]+)"/)[1];
        
        // 构造AES解密的Key和IV
        const key = CryptoJS.enc.Utf8.parse('A42EAC0C2B428472' + uid + '2F131BE91247866E');
        const iv = CryptoJS.enc.Hex.parse('2F131BE91247866E');
        
        // 使用AES解密
        const decrypted = CryptoJS.AES.decrypt(
            { 'ciphertext': CryptoJS.enc.Base64.parse(encryptedUrl) },
            key,
            { 'iv': iv, 'mode': CryptoJS.mode.CBC, 'padding': CryptoJS.pad.Pkcs7 }
        );
        
        // 将解密结果转换为UTF8字符串
        finalUrl = CryptoJS.enc.Utf8.stringify(decrypted);
    }
    
    return JSON.stringify({ 'urls': [finalUrl] });
}

/**
 * 搜索功能
 * @param {Object} args - 参数对象，包含 text (搜索关键词) 和 page (页码)
 */
async function search(args) {
    let results = [];
    const keyword = encodeURIComponent(args.text);
    const page = args.page || 1;
    
    // 构造搜索URL
    const searchUrl = `<LaTex>${appConfig.site}/vodsearch/$</LaTex>{keyword}----------${page}---.html`;
    
    // 获取搜索结果页HTML
    const { data: html } = await $fetch.get(searchUrl, { 'headers': headers });
    const $ = cheerio.load(html);
    
    // 解析页面上的搜索结果
    $('div.module-card-item').each((index, element) => {
        results.push({
            'vod_id': $(element).find('a.module-card-item-poster').attr('href'),
            'vod_name': $(element).find('strong.module-card-item-title').text(),
            'vod_pic': $(element).find('div.module-card-item-poster').attr('data-original-class'),
            'vod_remarks': $(element).find('div.module-card-item-remark').text(),
            'ext': { 'url': appConfig.site + $(element).find('a.module-card-item-poster').attr('href') }
        });
    });
    
    return JSON.stringify({ 'list': results });
}
