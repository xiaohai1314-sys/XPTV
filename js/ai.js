// ======== 适配 TVBox / 猫影视 的完整版本 ========
// 直接粘贴到 .js 规则文件即可运行

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const headers = {
    'Referer': 'https://www.netflixgc.com/',
    'Origin': 'https://www.netflixgc.com',
    'User-Agent': UA
};

const appConfig = {
    ver: 1,
    title: 'NetflixGC',
    site: 'https://www.netflixgc.com',
    tabs: [
        { name: '电影', ext: { dmtype: '1' } },
        { name: '电视剧', ext: { dmtype: '2' } },
        { name: '漫剧', ext: { dmtype: '3' } },
        { name: '综艺', ext: { dmtype: '23' } },
        { name: '纪录片', ext: { dmtype: '24' } },
        { name: '伦理', ext: { dmtype: '30' } }
    ]
};

// ---------- 必备工具函数（TVBox 已内置） ----------
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(obj) { return obj; }
function base64decode(str) { return CryptoJS.enc.Base64.parse(str).toString(CryptoJS.enc.Utf8); }

// ---------- 1. 获取配置 ----------
function getConfig() {
    return jsonify(appConfig);
}

// ---------- 2. 首页列表 ----------
async function getCards(param) {
    param = argsify(param);
    let list = [];
    let page = param.page || 1;
    let dmtype = param.dmtype || '1';
    let timestamp = Math.floor(Date.now() / 1000);
    let sign = CryptoJS.MD5(`DS${timestamp}DCC147D11943AF75`).toString();

    let url = `https://www.netflixgc.com/api.php?v1.vod_list?type=${dmtype}&page=${page}&time=${timestamp}&sign=${sign}`;
    let res = await $fetch.get(url, { headers });

    for (let item of res.list) {
        list.push({
            vod_id: item.vod_id + '',
            vod_name: item.vod_name,
            vod_pic: item.vod_pic,
            vod_remarks: item.vod_remarks,
            ext: { url: `https://www.netflixgc.com/voddetail/${item.vod_id}` }
        });
    }
    return jsonify({ list });
}

// ---------- 3. 选集 ----------
async function getTracks(param) {
    param = argsify(param);
    let url = param.url;
    let html = await $fetch.get(url, { headers });
    let $ = cheerio.load(html);

    let titles = [];
    $('a.swiper-slide').each((i, el) => titles.push($(el).text().trim()));

    let tracks = [];
    $('div.anthology-list-box').each((idx, box) => {
        let title = titles[idx] || `线路${idx + 1}`;
        let eps = [];
        $(box).find('li a').each((i, a) => {
            let href = $(a).attr('href');
            eps.push({
                name: $(a).text().trim(),
                pan: '',
                ext: { url: 'https://www.netflixgc.com' + href }
            });
        });
        tracks.push({ title, tracks: eps });
    });
    return jsonify({ list: tracks });
}

// ---------- 4. 播放地址 ----------
async function getPlayinfo(param) {
    param = argsify(param);
    let url = param.url;
    let html = await $fetch.get(url, { headers });

    let match = html.match(/player_aaaa=(.+?)<\/script>/);
    if (!match) return jsonify({ urls: [] });

    let player = JSON.parse(match[1]);
    let playUrl = '';

    if (player.type === '1') {
        playUrl = unescape(player.url);
    } else if (player.type === '2') {
        let raw = unescape(atob(player.url));
        let secUrl = 'https://www.netflixgc.com' + raw;
        let secHtml = await $fetch.get(secUrl, { headers });

        let urlMatch = secHtml.match(/"url"\s*:\s*"([^"]+)"/);
        let uidMatch = secHtml.match(/"uid"\s*:\s*"([^"]+)"/);
        if (!urlMatch || !uidMatch) return jsonify({ urls: [] });

        let encUrl = urlMatch[1].replace(/\\/g, '');
        let uid = uidMatch[1];

        let key = CryptoJS.enc.Utf8.parse(`2F131BE91247866E${uid}`);
        let iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

        let decrypted = CryptoJS.AES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(encUrl) },
            key,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );
        playUrl = decrypted.toString(CryptoJS.enc.Utf8);
    }

    return jsonify({ urls: [playUrl] });
}

// ---------- 5. 搜索 ----------
async function search(param) {
    param = argsify(param);
    let wd = encodeURIComponent(param.text);
    let page = param.page || 1;
    let url = `${appConfig.site}/vodsearch/${wd}----------${page}---.html`;

    let html = await $fetch.get(url, { headers });
    let $ = cheerio.load(html);

    let list = [];
    $('div.module-search-item').each((i, el) => {
        let a = $(el).find('a.module-card-item');
        let img = $(el).find('img');
        let remark = $(el).find('div.module-item-note');
        let href = a.attr('href');
        let id = href.match(/\/voddetail\/(\d+)/);
        if (!id) return;

        list.push({
            vod_id: id[1],
            vod_name: a.attr('title'),
            vod_pic: img.attr('data-original') || img.attr('src'),
            vod_remarks: remark.text().trim(),
            ext: { url: appConfig.site + href }
        });
    });
    return jsonify({ list });
}

// ======== 导出函数（TVBox 必须）========
var export_funcs = {
    getConfig,
    getCards,
    getTracks,
    getPlayinfo,
    search
};
