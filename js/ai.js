// 完整去混淆版脚本（可直接复制到你 App 的插件系统）
// 说明：保留 $fetch、createCheerio、createCryptoJS 等平台函数调用。
// 作者：ChatGPT（已翻译 & 增加中文注释）

// --- 环境/依赖准备（平台通常会提供这些） ---
const cheerio = typeof createCheerio === 'function' ? createCheerio() : null;
const CryptoJS = typeof createCryptoJS === 'function' ? createCryptoJS() : (typeof CryptoJS !== 'undefined' ? CryptoJS : null);

// 如果平台没有提供 argsify/jsonify，提供最小兼容实现
if (typeof argsify !== 'function') {
  // 将传入可能的 args 标准化为对象
  globalThis.argsify = function (x) {
    if (!x) return {};
    if (typeof x === 'string') return { url: x };
    return x;
  };
}
if (typeof jsonify !== 'function') {
  // 直接返回对象（平台通常会序列化）
  globalThis.jsonify = function (x) {
    return x;
  };
}

// User-Agent & headers（与原脚本相近）
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const headers = {
  'Referer': 'https://www.netflixgc.com/',
  'Origin': 'https://www.netflixgc.com',
  'User-Agent': UA
};

// 应用配置（保持与原脚本兼容的字段）
const appConfig = {
  ver: 1,
  title: '奈飞影视',
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

// ------------------ 导出 / 平台调用接口 ------------------

// getConfig：返回配置信息（分类等）
async function getConfig() {
  return jsonify(appConfig);
}

/**
 * getCards(params)
 * 功能：按分类、页码获取影片列表
 * params 常见字段： { dmtype: '1', page: 1 }
 */
async function getCards(params) {
  params = argsify(params);
  try {
    const type = params.dmtype || '';
    const page = params.page || 1;

    // 时间戳 + 签名逻辑（与原脚本保持一致）
    const timestamp = Math.floor(new Date().getTime() / 1000);
    // 签名规则：MD5("DS" + timestamp + "DCC147D11943AF75")
    const md5input = 'DS' + timestamp + 'DCC147D11943AF75';
    const sign = CryptoJS.MD5(md5input).toString();

    // 构造请求 body（原脚本用 form 字符串）
    const body = 'type=' + type + '&page=' + page + '&time=' + timestamp + '&key=' + sign;

    // 请求（平台提供的 $fetch）
    const url = appConfig.site + '/api.php/provide/vod'; // 原站点 API 路径（保持原样）
    const { data } = await $fetch.post(url, body, { headers });

    // 解析返回数据（兼容原脚本 argsify）
    const resultList = [];
    const json = argsify(data);
    if (json && Array.isArray(json.list)) {
      json.list.forEach(item => {
        resultList.push({
          vod_id: item.vod_id.toString(),
          vod_name: item.vod_name,
          vod_pic: item.vod_pic,
          vod_remarks: item.vod_remarks,
          ext: {
            // 详情页在原脚本为 /detail/<id>
            url: appConfig.site + '/voddetail/' + item.vod_id
          }
        });
      });
    }

    return jsonify({ list: resultList });
  } catch (e) {
    // 出错时返回空列表（平台会展示错误日志）
    return jsonify({ list: [] });
  }
}

/**
 * getTracks(params)
 * 功能：从详情页解析剧集（播放线路 / 分集）
 * params: { url: 'https://....' }
 */
async function getTracks(params) {
  params = argsify(params);
  const url = params.url;
  if (!url) return jsonify({ list: [] });

  try {
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);

    // 先读取左侧或上方的线路/分组标题（原脚本用 a.swiper-slide）
    const groupTitles = [];
    $('a.swiper-slide').each((i, el) => {
      groupTitles.push($(el).text().trim());
    });

    // 主体：遍历分组（示例选择 .anthology-list，内部为 .anthology-list-box）
    const groups = [];
    $('.anthology-list').each((i, groupEl) => {
      const title = groupTitles[i] || ('线路' + (i + 1));
      const tracks = [];
      $(groupEl).find('div.anthology-list-box').each((j, itemEl) => {
        // item 可能包含 a 标签，取 href 与文本
        const $item = $(itemEl);
        const a = $item.find('a').first();
        const name = $item.text().trim() || a.text().trim();
        const href = a.attr('href') || '';
        tracks.push({
          name: name,
          pan: '',
          ext: {
            url: href ? (href.startsWith('http') ? href : (appConfig.site + href)) : ''
          }
        });
      });
      groups.push({ title, tracks });
    });

    return jsonify({ list: groups });
  } catch (e) {
    return jsonify({ list: [] });
  }
}

/**
 * getPlayinfo(params)
 * 功能：解析播放页拿到真实播放地址（包含 base64 & AES 解密流程）
 * params: { url: '播放页 URL' }
 */
async function getPlayinfo(params) {
  params = argsify(params);
  let url = params.url;
  if (!url) return jsonify({ urls: [] });

  try {
    // 请求播放页，提取 player_aaaa=...</script> 里的 JSON 字符串
    const { data } = await $fetch.get(url, { headers });
    // 用正则找出 player_aaaa=...</script>
    const match = data.match(/player_aaaa=(.+?)<\/script>/);
    if (!match || !match[1]) return jsonify({ urls: [] });

    const playerJsonStr = match[1];
    let playerObj;
    try {
      playerObj = JSON.parse(playerJsonStr);
    } catch (e) {
      // 解析失败返回空
      return jsonify({ urls: [] });
    }

    let playUrl = '';

    // type == '1'：直接 unescape(url)
    if (playerObj.type == '1') {
      playUrl = unescape(playerObj.url || '');
    } else if (playerObj.type == '2') {
      // type == '2'：先 base64decode -> unescape -> 请求得到加密字段 -> AES 解密
      // base64decode + unescape
      const decodedPath = unescape(base64decode(playerObj.url || ''));
      // 原脚本在此将 path 拼回站点
      const jsonUrl = (decodedPath.startsWith('http') ? decodedPath : (appConfig.site + decodedPath));
      // 请求该 URL 获取包含 "url" 与 "uid" 的响应
      const resp = await $fetch.get(jsonUrl, { headers });
      const htmlText = resp.data || '';

      // 从响应中解析 fileUrl 与 uid
      // fileUrl 可能被转义，形如: "url":"BASE64_ENCRYPTED_TEXT"
      const fileUrlMatch = htmlText.match(/"url"\s*:\s*"([^"]+)"/);
      const uidMatch = htmlText.match(/"uid"\s*:\s*"([^"]+)"/);

      if (!fileUrlMatch || !uidMatch) return jsonify({ urls: [] });

      const fileUrlBase64 = fileUrlMatch[1].replace(/\\/g, '');
      const uid = uidMatch[1];

      // 构造 AES key 与 iv（与原脚本一致）
      // 注意：原脚本使用 CryptoJS.enc.Utf8.parse("2F131BE91247866E" + uid + "f2") 作为 key
      //       iv 使用 CryptoJS.enc.Utf8.parse("2F131BE91247866E")
      const keyStr = '2F131BE91247866E' + uid + 'f2';
      const ivStr = '2F131BE91247866E';

      const key = CryptoJS.enc.Utf8.parse(keyStr);
      const iv = CryptoJS.enc.Utf8.parse(ivStr);

      // 解密：先把 fileUrlBase64 当作 ciphertext 的 base64 字符串
      const cipherParams = {
        ciphertext: CryptoJS.enc.Base64.parse(fileUrlBase64)
      };

      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      playUrl = CryptoJS.enc.Utf8.stringify(decrypted);
      // playUrl 现在应该是最终可播放的 url
    }

    return jsonify({ urls: [playUrl] });
  } catch (e) {
    return jsonify({ urls: [] });
  }
}

/**
 * search(params)
 * 功能：关键词搜索
 * params: { text: '关键词', page: 1 }
 */
async function search(params) {
  params = argsify(params);
  const keyword = encodeURIComponent(params.text || '');
  const page = params.page || 1;

  try {
    const url = `${appConfig.site}/vodsearch/${keyword}----------${page}---.html`;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);

    const list = [];
    // 选择器基于原脚本解析逻辑，尝试兼容常见结构
    $('.module-item').each((i, el) => {
      const $el = $(el);
      const coverA = $el.find('.module-item-cover a').first();
      const picImg = $el.find('.module-item-pic img').first();

      const href = coverA.attr('href') || '';
      const title = $el.find('.module-item-pic').attr('alt') || coverA.attr('title') || $el.find('.module-info-title').text().trim();
      const pic = picImg.attr('data-src') || picImg.attr('src') || '';
      const remark = $el.find('.module-item-text').text().trim();

      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remark,
        ext: {
          url: href ? (href.startsWith('http') ? href : (appConfig.site + href)) : ''
        }
      });
    });

    return jsonify({ list });
  } catch (e) {
    return jsonify({ list: [] });
  }
}

// ------------------ 辅助函数 ------------------

/**
 * base64decode(str)
 * 说明：使用脚本内置实现以保证在任何 JS 运行环境下可用（避免依赖 atob）
 * 该实现基于原混淆脚本中的自定义 base64 解码逻辑（保留兼容性）
 */
function base64decode(input) {
  // 去除非 base64 字符
  input = (input || '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (!input) return '';

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  let i = 0;

  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    str += String.fromCharCode(chr1);
    if (enc3 !== 64 && enc3 !== -1) str += String.fromCharCode(chr2);
    if (enc4 !== 64 && enc4 !== -1) str += String.fromCharCode(chr3);
  }

  try {
    // 尝试按 URI 解码（原脚本会 decodeURIComponent）
    return decodeURIComponent(escape(str));
  } catch (err) {
    return str;
  }
}

// 方便调试：导出函数（某些环境需要挂到 global）
globalThis.getConfig = getConfig;
globalThis.getCards = getCards;
globalThis.getTracks = getTracks;
globalThis.getPlayinfo = getPlayinfo;
globalThis.search = search;

// 版本信息（保留原脚本中存在的标识）
var version_ = 'jsjiami.com.v7';
