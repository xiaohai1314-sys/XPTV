/**
 * reboys.cn 前端插件 - V45.0 (Base64链接ID最终正确版)
 *
 * 版本说明:
 * - 【V45.0 拨乱反正】: 确认了“转圈”是由于V44的全局缓存方案在App环境中失效。本方案回归无状态、最可靠的ID传递模式。
 * - 【Base64链接ID架构】:
 *    1. `search`: 获取数据后，将【只包含links的精简对象】序列化，并进行【Base64编码】，生成一个安全、简短的字符串作为 vod_id。
 *    2. `detail`: 接收到Base64的 vod_id，先【解码】再【解析】，拿到 links 数组，然后包装成按钮列表JSON返回。
 *    3. `play`: 接收按钮对应的【纯链接】并返回。
 * - 【集大成者】: 本方案结合了“ID传递”的可靠性、“Base64”的安全性、“精简对象”的高效性，并遵循了“三步流程”，是解决所有已知问题的最终形态。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const DEBUG = true;

// --- 辅助函数 ---
function log(msg ) { try { $log(`[reboys V45] ${msg}`); } catch (_) { if (DEBUG) console.log(msg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(obj) { return JSON.stringify(obj); }

// --- Base64 Polyfill (确保 btoa 和 atob 在所有环境中可用) ---
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function btoa(input = '') {
    let str = input; let output = '';
    for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || (map = '=', i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) { throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."); }
        block = block << 8 | charCode;
    } return output;
}
function atob(input = '') {
    let str = input.replace(/=+$/, ''); let output = '';
    if (str.length % 4 == 1) { throw new Error("'atob' failed: The string to be decoded is not correctly encoded."); }
    for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    } return output;
}


// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V45.0 (Base64链接ID最终正确版) ====");
    return jsonify({ ver: 1, title: 'reboys搜(V45)', site: '', tabs: [] });
}

async function home() { return jsonify({ class: [] }); }
async function category(tid, pg) { return jsonify({ list: [] }); }

// ★★★ 第1步：search函数，将精简links对象Base64编码后作为 vod_id ★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });

    log(`[search] 调用后端/search, 关键词: "${keyword}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);

        if (response.code !== 0) throw new Error(response.message);
        
        const listWithSafeID = response.list.map(item => {
            // 1. 创建只包含链接的精简对象，用"l"作键名，缩短长度
            const linkData = { l: item.ext.links || [] };
            // 2. 序列化并进行Base64编码，生成最安全的ID
            item.vod_id = btoa(jsonify(linkData));
            // 3. 保持 vod_name 等字段不变，确保列表能显示
            return item;
        });
        
        log(`[search] ✅ 获取 ${listWithSafeID.length} 条数据，并将链接信息安全编码到 vod_id 中。`);
        return jsonify({ list: listWithSafeID });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★ 第2步：detail函数，解码 vod_id，返回按钮列表JSON ★★★
async function detail(id) {
    // id 是经过Base64编码的字符串
    if (!id) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无效的ID', pan: '' }] }] });
    }
    log(`[detail] 接收到Base64 ID: ${id.substring(0, 50)}...`);
    
    try {
        // 1. Base64解码 -> JSON解析
        const decodedJson = atob(id);
        const linkData = argsify(decodedJson);
        const links = linkData.l || [];

        if (!Array.isArray(links)) throw new Error("解码后的数据格式不正确");

        log(`[detail] ✅ 解码成功，找到 ${links.length} 个链接，正在包装成按钮列表...`);

        if (links.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: '未找到有效链接', pan: '' }] }] });
        }

        // 2. 模仿“夸父”的 getTracks，包装成按钮列表
        const tracks = links.map((linkInfo, index) => {
            const url = linkInfo.url;
            const password = linkInfo.password;
            let panType = '网盘';
            if (linkInfo.type === 'quark') panType = '夸克';
            else if (linkInfo.type === 'aliyun') panType = '阿里';
            else if (linkInfo.type === 'baidu') panType = '百度';
            
            const buttonName = `${panType} ${index + 1}`;
            const fullLinkWithPass = password ? `${url}（码：${password}）` : url;

            return { 
                name: buttonName, 
                pan: url, // ★ 关键: pan 字段里是【纯链接】，用于传递给 play 函数
                ext: { full: fullLinkWithPass } 
            };
        });

        return jsonify({ list: [{ title: '云盘', tracks: tracks }] });

    } catch (e) {
        log(`[detail] 异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `ID解析失败: ${e.message}`, pan: '' }] }] });
    }
}

// ★★★ 第3步：play函数，接收【纯链接】，返回最终指令 ★★★
async function play(flag, id) {
    // 这里的 id 是用户点击按钮后，App从按钮的 "pan" 字段里取出的【纯链接】
    log(`[play] 接收到最终播放/下载链接: ${id}`);
    
    return jsonify({
        parse: 0,
        url: id,
        header: {}
    });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }

log('==== 插件加载完成 V45.0 (Base64链接ID最终正确版) ====');
