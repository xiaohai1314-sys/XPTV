// ✅ NetflixGC 插件脚本（最终修正版）
// 支持分类、搜索、详情、播放、解密。结构完全兼容原混淆版。
// 作者：ChatGPT 优化去混淆版（签名/路径修复）

const cheerio = typeof createCheerio === 'function' ? createCheerio() : null;
const CryptoJS = typeof createCryptoJS === 'function' ? createCryptoJS() : (typeof CryptoJS !== 'undefined' ? CryptoJS : null);

// 平台兼容兜底
if (typeof argsify !== 'function') {
  globalThis.argsify = function (x) {
    if (!x) return {};
    if (typeof x === 'string') return { url: x };
    return x;
  };
}
if (typeof jsonify !== 'function') {
  globalThis.jsonify = function (x) {
    return x;
  };
}

// 基本配置
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const headers = {
  'Referer': 'https://www.netflixgc.com/',
  'Origin': 'https://www.netflixgc.com',
  'User-Agent': UA
};

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

// ================== 接口函数 ==================

// 获取分类配置
async function getConfig() {
  return jsonify(appConfig);
}

// ✅ 修正版：能正常加载分类列表
async function getCards(params) {
  params = argsify(params);
  try {
    const type = params.dmtype || '';
    const page = params.page || 1;
    const timestamp = Math.floor(Date.now() / 1000);

    // 签名算法：MD5("DS" + timestamp + "DCC147D11943AF75")
    const md5input = 'DS' + timestamp + 'DCC147D11943AF75';
    const sign = CryptoJS.MD5(md5input).toString(CryptoJS.enc.Hex);

    // 参数拼接
    const body = `type=${type}&page=${page}&time=${timestamp}&key=${sign}`;
    const url = appConfig.site + '/api.php/provide/vod/';

    // ✅ 必须指定表单格式 Content-Type
    const { data } = await $fetch.post(url, body, {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const list = [];
    const json = argsify(data);
    if (json && Array.isArray(json.list)) {
      json.list.forEach(item => {
        list.push({
          vod_id: item.vod_id.toString(),
          vod_name: item.vod_name,
          vod_pic: item.vod_pic,
          vod_remarks: item.vod_remarks,
          ext: { url: appConfig.site + '/voddetail/' + item.vod_id }
        });
      });
    }

    return jsonify({ list });
  } catch (e) {
    return jsonify({ list: [] });
  }
}

// 详情页分集
async function getTracks(params) {
  params = argsify(params);
  const url = params.url;
  if (!url) return jsonify({ list: [] });

  try {
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);

    const groupTitles = [];
    $('a.swiper-slide').each((i, el) => {
      groupTitles.push($(el).text().trim());
    });

    const groups = [];
    $('.anthology-list').each((i, groupEl) => {
      const title = groupTitles[i] || ('线路' + (i + 1));
      const tracks = [];
      $(groupEl).find('div.anthology-list-box').each((j, itemEl) => {
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

// 播放页解析（含 AES 解密）
async function getPlayinfo(params) {
  params = argsify(params);
  let url = params.url;
  if (!url) return jsonify({ urls: [] });

  try {
    const { data } = await $fetch.get(url, { headers });
    const match = data.match(/player_aaaa=(.+?)<\/script>/);
    if (!match || !match[1]) return jsonify({ urls: [] });

    const playerObj = JSON.parse(match[1]);
    let playUrl = '';

    if (playerObj.type == '1') {
      playUrl = unescape(playerObj.url || '');
    } else if (playerObj.type == '2') {
      const decodedPath = unescape(base64decode(playerObj.url || ''));
      const jsonUrl = decodedPath.startsWith('http') ? decodedPath : (appConfig.site + decodedPath);
      const resp = await $fetch.get(jsonUrl, { headers });
      const htmlText = resp.data || '';

      const fileUrlMatch = htmlText.match(/"url"\s*:\s*"([^"]+)"/);
      const uidMatch = htmlText.match(/"uid"\s*:\s*"([^"]+)"/);
      if (!fileUrlMatch || !uidMatch) return jsonify({ urls: [] });

      const fileUrlBase64 = fileUrlMatch[1].replace(/\\/g, '');
      const uid = uidMatch[1];
      const key = CryptoJS.enc.Utf8.parse('2F131BE91247866E' + uid + 'f2');
      const iv = CryptoJS.enc.Utf8.parse('2F131BE91247866E');

      const cipherParams = { ciphertext: CryptoJS.enc.Base64.parse(fileUrlBase64) };
      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      playUrl = CryptoJS.enc.Utf8.stringify(decrypted);
    }

    return jsonify({ urls: [playUrl] });
  } catch (e) {
    return jsonify({ urls: [] });
  }
}

// 搜索功能
async function search(params) {
  params = argsify(params);
  const keyword = encodeURIComponent(params.text || '');
  const page = params.page || 1;

  try {
    const url = `${appConfig.site}/vodsearch/${keyword}----------${page}---.html`;
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);

    const list = [];
    $('.module-item').each((i, el) => {
      const $el = $(el);
      const coverA = $el.find('.module-item-cover a').first();
      const picImg = $el.find('.module-item-pic img').first();

      const href = coverA.attr('href') || '';
      const title = $el.find('.module-item-pic').attr('alt') ||
                    coverA.attr('title') ||
                    $el.find('.module-info-title').text().trim();
      const pic = picImg.attr('data-src') || picImg.attr('src') || '';
      const remark = $el.find('.module-item-text').text().trim();

      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remark,
        ext: { url: href.startsWith('http') ? href : (appConfig.site + href) }
      });
    });

    return jsonify({ list });
  } catch (e) {
    return jsonify({ list: [] });
  }
}

// Base64 解码函数
function base64decode(input) {
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
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

// 导出函数供平台调用
globalThis.getConfig = getConfig;
globalThis.getCards = getCards;
globalThis.getTracks = getTracks;
globalThis.getPlayinfo = getPlayinfo;
globalThis.search = search;

var version_ = 'jsjiami.com.v7';
