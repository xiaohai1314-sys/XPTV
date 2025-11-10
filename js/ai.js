// Netflix视频网站解析器
// 原始网站: https://www.netflixgc.com

const cheerio = createCheerio();
const CryptoJS = createCryptoJS();

const UA = ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36’;
const headers = {
‘Referer’: ‘https://www.netflixgc.com/’,
‘Origin’: ‘https://www.netflixgc.com’,
‘User-Agent’: UA
};

const appConfig = {
ver: 1,
title: ‘Netflix影视’,
site: ‘https://www.netflixgc.com’,
tabs: [
{ name: ‘电影’, ext: { dmtype: ‘1’ } },
{ name: ‘电视剧’, ext: { dmtype: ‘2’ } },
{ name: ‘漫剧’, ext: { dmtype: ‘3’ } },
{ name: ‘综艺’, ext: { dmtype: ‘23’ } },
{ name: ‘纪录片’, ext: { dmtype: ‘24’ } },
{ name: ‘伦理’, ext: { dmtype: ‘30’ } }
]
};

// 获取配置
async function getConfig() {
return jsonify(appConfig);
}

// 获取视频列表
async function getCards(args) {
args = argsify(args);

let results = [];
const apiUrl = ‘https://www.netflixgc.com/api.php/provide/vod/’;
const page = args.page || 1;
const dmtype = args.dmtype;

// 生成加密签名
const timestamp = Math.floor(new Date().getTime() / 1000);
const signStr = ‘DS’ + timestamp + ‘DCC147D11943AF75’;
const sign = CryptoJS.MD5(signStr).toString(CryptoJS.enc.Hex);

// 构建请求参数
const params = `type=${dmtype}&page=${page}&time=${timestamp}&key=${sign}`;

const { data } = await $fetch.get(apiUrl, params, { headers });
const videoList = argsify(data).list;

// 处理每个视频项
videoList.forEach((item) => {
results.push({
vod_id: item.vod_id.toString(),
vod_name: item.vod_name,
vod_pic: item.vod_pic,
vod_remarks: item.vod_remarks,
ext: {
url: ‘https://www.netflixgc.com/voddetail/’ + item.vod_id.toString() + ‘.html’
}
});
});

return jsonify({ list: results });
}

// 获取视频播放列表
async function getTracks(args) {
args = argsify(args);

let trackList = [];
const detailUrl = args.url;

const { data } = await $fetch.get(detailUrl, { headers });
const $ = cheerio.load(data);

// 获取播放源标题
let sourceTitles = [];
$(‘a.swiper-slide’).each((i, elem) => {
sourceTitles.push(
$(elem).children().children().children().end().text().trim()
);
});

// 获取每个播放源的剧集列表
$(‘div.anthology-list-box’).each((i, elem) => {
let trackGroup = {
title: sourceTitles[i],
tracks: []
};

```
$(elem).find('a').each((j, episode) => {
  trackGroup.tracks.push({
    name: $(episode).text(),
    pan: '',
    ext: {
      url: appConfig.site + $(episode).children(':first').attr('href')
    }
  });
});

trackList.push(trackGroup);
```

});

return jsonify({ list: trackList });
}

// 获取播放地址
async function getPlayinfo(args) {
args = argsify(args);

let playUrl = args.url;

// 第一步：获取播放页面
const { data } = await $fetch.get(playUrl, { headers });

// 提取播放器配置
const playerConfig = JSON.parse(
data.match(/player_aaaa=(.+?)</script>/)[1]
);

let finalUrl;

// 根据加密类型解密
if (playerConfig.encrypt === ‘1’) {
// 类型1：直接unescape
finalUrl = unescape(playerConfig.url);
} else if (playerConfig.encrypt === ‘2’) {
// 类型2：base64解码后再获取真实地址
finalUrl = unescape(base64decode(playerConfig.url));
playUrl = ‘https://www.netflixgc.com’ + finalUrl;

```
// 第二步：获取加密的播放地址
const response = await $fetch.get(playUrl, { headers });

// 提取加密的URL和UID
let encryptedUrl = response.data.match(/"url"\s*:\s*"([^"]+)"/)[1]
  .replace(/\\/g, '');
const uid = response.data.match(/"uid"\s*:\s*"([^"]+)"/)[1];

// AES解密
const key = CryptoJS.enc.Utf8.parse('DS' + uid + 'DCC147D11943AF75');
const iv = CryptoJS.enc.Utf8.parse('2F131BE91247866E');

const decrypted = CryptoJS.AES.decrypt(
  { ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl) },
  key,
  {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  }
);

finalUrl = CryptoJS.enc.Utf8.stringify(decrypted);
```

}

return jsonify({ urls: [finalUrl] });
}

// 搜索功能
async function search(args) {
args = argsify(args);

let results = [];
const keyword = encodeURIComponent(args.text);
const page = args.page || 1;

const searchUrl = appConfig.site + ‘/vodsearch/’ + keyword + ‘–––––’ + page + ‘—.html’;

const { data } = await $fetch.get(searchUrl, { headers });
const $ = cheerio.load(data);

$(‘li.search-list’).each((i, elem) => {
results.push({
vod_id: $(elem).find(‘a.public-list-exp’).children(’:first’).attr(‘href’),
vod_name: $(elem).find(‘a.thumb-txt’).text(),
vod_pic: $(elem).find(‘a.public-list-exp’).children(’:first’)
.find(‘img’).children(’:first’).attr(‘data-src’),
vod_remarks: $(elem).find(‘span.public-list-prb’).text(),
ext: {
url: appConfig.site + $(elem).find(‘a.public-list-exp’)
.children(’:first’).attr(‘href’)
}
});
});

return jsonify({ list: results });
}

// Base64解码辅助函数
function base64decode(input) {
const base64Chars = ‘ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/’;
const lookup = new Array(128).fill(-1);

// 构建查找表
for (let i = 0; i < base64Chars.length; i++) {
lookup[base64Chars.charCodeAt(i)] = i;
}
lookup[’-’.charCodeAt(0)] = 62;
lookup[’_’.charCodeAt(0)] = 63;

let output = ‘’;
let buffer = 0;
let bits = 0;

for (let i = 0; i < input.length; i++) {
const c = input.charCodeAt(i);
const value = lookup[c];

```
if (value === -1) continue;

buffer = (buffer << 6) | value;
bits += 6;

if (bits >= 8) {
  bits -= 8;
  output += String.fromCharCode((buffer >> bits) & 0xFF);
  buffer &= (1 << bits) - 1;
}
```

}

return output;
}

// 导出函数
export { getConfig, getCards, getTracks, getPlayinfo, search };
