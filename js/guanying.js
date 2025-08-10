/**
 * 观影网脚本 - v9.0 (最终修复版)
 *
 * --- 版本说明 ---
 * 1.  此版本基于被验证部分功能可用的 v5.0 版本。
 * 2.  【最终修正】: 严格遵循“隔离化修改”原则，仅重构 getTracks 函数，确保其他功能 (分类、搜索) 不受影响。
 * 3.  【getTracks 修正】: 不再调用通用的 buildHeaders，而是为 API 请求单独构造请求头，使用固定的首页 Referer，解决了网盘提取失败的核心问题。
 * 4.  【getTracks 增强】: 融入了经过验证的、来自 v19.0 的 JSON 解析和错误处理逻辑，使网盘提取功能更健壮。
 * 5.  这是一个为观影网深度定制的、逻辑严谨的最终稳定版本。
 */

// ================== 配置区 (来自 v5.0) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// 请将此处替换为您自己获取的、长期有效的Cookie
const FULL_COOKIE = '_ok4_=Kx0heu4m9F05IybrnY0Su5Z/+8XD070kFSNNc3U60CbfDnwycM43lOWI53CID8HrUOTbfs6rVPpr9Ci4din5LbRuo71yd0W3vDWdqke6DiMGdVql+SH+NRXbsNuEFThm; 5839_4093_114.234.50.248=1; 5838_4094_114.234.50.248=1; PHPSESSID=98sro02gntq5qqis734ik8hi07; 5838_4089_114.234.50.248=1; 5839_4088_114.234.50.248=1; 5838_4102_114.234.50.248=1; 5839_4078_114.234.50.248=1; beitouviews_5838=KX9OmCyAYuTWNn4uQ6ANjK8Ce5oqXXfdJv39G1aCFkEVfokPEar8iT%252BYb%252FXVqMhcoweHKTc1d3GfGMwcl3Bb20WdH%252BAbiNkWGuCP6uSyD8aXTerq%252FkCJrzOl2a%252BtaLp7Qei9n2CVUmn2h05gnPG3fLQe7VN4VqFdLvL94VQULPYJ9DQFB%252BLPCWNFk%252FbovqSDuKAFGSMqFcVEz%252B3US9vlTdHoY9SVGvD44KoHt9MdhZixDtltrq89XMBWJ%252F7zo0OlIGqRguGnxsrs%252BPcMwG4CF7OHrmEY6jLDGQBMOsyrFLmjNMVv5HCIA5FYzggeUgXbA4Oym5UEqlG3Mzzp%252FKX5TA%253D%253D; 5838_4079_114.234.50.248=1; richviews_5839=BmcIxW4naNjRymCJYBQYN0Ghx8wFCcEInp8uCmSDRs2CN3NGVYl78JaG9aBsqYBXDg8bpCsD6P6E38lTcqYNoqpaomm5j4Hn%252BTjYsoX%252FuJcyhWEzD5qow4%252FDljjWTB7d5LmF3bvdmNrdBeS6zu2ULvyZKVpnUYBDFkBRP%252BcT%252Fi59jNaKP8vOGYmgKkqO1u2gIo6313AcXvR6YgQBkaN294r%252Bl83pOhnbLjVg6Wp7hZHtNRE2kzyFVC7zJI0bdlrEbl78A7XbrR9oD2Lff45d8%252Fr25nuJZ1yJ6bxQ5Qxq4gpLnIcVtNwsEs%252FgGZfG6fJ72oML%252BV79W3FbK1k%252FbHGSuQ%253D%253D; 5839_4101_114.234.50.248=1';

const appConfig = {
    ver: 9.0, // 版本号更新为最终修复版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 (来自 v5.0 ) ==================
function log(msg) { try { $log(`[观影网 v9.0] ${msg}`); } catch (_) { console.log(`[观影网 v9.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 【保持不变】这个函数继续为 getCards 和 search 服务
function buildHeaders(referer) {
    return {
        'User-Agent': UA,
        'Cookie': FULL_COOKIE,
        'Referer': referer,
    };
}

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【业务逻辑函数】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

/**
 * 【保持不变】获取分类页面的卡片列表 (来自 v5.0)
 */
async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    const headers = buildHeaders(appConfig.site); // 使用通用请求头

    try {
        const { data: htmlText } = await $fetch.get(url, { headers });
        const inlistMatch = htmlText.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) {
            throw new Error("未能从HTML响应中匹配到 '_obj.inlist' 数据块。");
        }
        const inlistData = JSON.parse(inlistMatch[1]);
        if (!inlistData || !inlistData.i) {
            return jsonify({ list: [] });
        }
        const cards = inlistData.i.map((item, index) => {
            const detailApiUrl = `/res/downurl/${inlistData.ty}/${item}`;
            return {
                vod_id: detailApiUrl,
                vod_name: inlistData.t[index],
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl },
            };
        } );
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

/**
 * 【最终修正】获取播放轨道列表
 */
async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.url}`;
    log(`请求详情API: ${url}`);

    // 关键修正：为API请求单独构造请求头，使用固定的首页Referer
    const apiHeaders = {
        'User-Agent': UA,
        'Cookie': FULL_COOKIE,
        'Referer': appConfig.site, // 使用固定的首页 Referer
    };

    try {
        const { data } = await $fetch.get(url, { headers: apiHeaders });
        const respstr = JSON.parse(data);
        let tracks = [];

        // 增强：融入v19.0的健壮解析和错误处理逻辑
        if (respstr.hasOwnProperty('panlist')) {
            const panTypes = {
                '夸克': /quark/i,
                'UC': /uc/i,
                '天翼': /189/i,
                '阿里': /ali/i,
                '115': /115/i,
            };

            const groupedTracks = {};

            respstr.panlist.url.forEach((item, index) => {
                const name = respstr.panlist.name[index] || '未知链接';
                const panUrl = item;
                const panPwd = respstr.panlist.p[index] || null;

                for (const typeName in panTypes) {
                    if (panTypes[typeName].test(panUrl)) {
                        if (!groupedTracks[typeName]) {
                            groupedTracks[typeName] = [];
                        }
                        groupedTracks[typeName].push({
                            name: name,
                            pan: panUrl,
                            pwd: panPwd,
                            ext: { url: '' }
                        });
                        return; // 匹配到一个就跳出内层循环
                    }
                }
            });

            // 将分组后的轨道添加到最终列表中
            for (const typeName in groupedTracks) {
                tracks.push({
                    title: typeName,
                    tracks: groupedTracks[typeName],
                });
            }

        } else if (respstr.hasOwnProperty('file')) {
            $utils.toastError('网盘验证掉签，请前往主站完成验证', 4000);
        } else {
            $utils.toastError('没有找到符合条件的网盘资源', 4000);
        }

        return jsonify({ list: tracks });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`请求资源失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

/**
 * 【保持不变】执行搜索 (来自 v5.0)
 */
async function search(ext) {
    ext = argsify(ext);
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索: ${url}`);
    const headers = buildHeaders(url); // 使用通用请求头

    try {
        const { data } = await $fetch.get(url, { headers });
        const $ = cheerio.load(data);
        let cards = [];
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const name = $element.find('b').text().trim();
            const imgUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
            const additionalInfo = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;
            const match = path.match(/\/([a-z]+)\/(\d+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `/res/downurl/${type}/${vodId}`;
            let finalImgUrl = imgUrl || '';
            if (finalImgUrl.endsWith('.webp')) {
                finalImgUrl = finalImgUrl.replace('.webp', '/220.webp');
            }
            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: finalImgUrl,
                vod_remarks: additionalInfo,
                ext: { url: detailApiUrl },
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 【保持不变】获取播放链接 (来自 v5.0)
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    const password = ext.pwd;
    let finalUrl = panLink;
    if (password) {
        finalUrl += `\n提取码: ${password}`;
    }
    return jsonify({ urls: [finalUrl] });
}
