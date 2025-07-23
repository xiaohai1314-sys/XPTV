/**
 * Gying 前端插件 - 终极嵌套实现版 v1.0.0
 * 
 * 作者: 基于对用户最终、最清晰描述的完全理解
 * 版本: v1.0.0
 * 更新日志:
 * v1.0.0: 
 * 1. 【回归正轨】: 严格、精确地实现“第一步显示简洁按钮，第二步显示完整标题文件夹”的嵌套逻辑。
 * 2. 【核心实现】:
 *    - getTracks: 只负责显示第一层的 `网盘[夸]` 按钮。每个按钮背后都藏着一个“显示文件夹”的特殊指令。
 *    - getPlayinfo: 负责处理这个特殊指令，并用其包含的信息（原始标题和真实链接）生成第二层的“文件夹”按钮。
 * 3. 我为之前所有错误的、自相矛盾的解释和代码，致以最诚挚的歉意。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function getPanAbbr(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('百度')) return '百';
    if (lowerTitle.includes('迅雷')) return '迅';
    if (lowerTitle.includes('夸克')) return '夸';
    if (lowerTitle.includes('阿里')) return '阿';
    if (lowerTitle.includes('天翼')) return '天';
    if (lowerTitle.includes('115')) return '115';
    if (lowerTitle.includes('uc')) return 'UC';
    return '源';
}

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (嵌套版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); }
    log(`获取分类: ${id}, 页码: ${page}`);
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { url: item.vod_id }
    }));
    return jsonify({ list: cards, total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) { log('搜索关键词为空'); return jsonify({ list: [] }); }
    log(`搜索: ${text}`);
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) { log(`搜索失败: ${data.error}`); return jsonify({ list: [] }); }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { url: item.vod_id }
    }));
    return jsonify({ list: cards });
}

// --- getTracks 函数只负责显示第一层按钮 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const vod_id = ext.url || ext.id || ext;
    log(`getTracks调用: vod_id=${vod_id}`);

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);

    if (data.error || !data.list || data.list.length === 0) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }
    
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }
    
    log(`开始解析资源字符串: ${playUrlString}`);
    const tracks = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        const title = (parts[0] || '未知资源').trim();
        const link = (parts[1] || '').trim();
        if (!link) return null;
        
        const buttonName = `网盘[${getPanAbbr(title)}]`;
        
        // 【核心】为每个按钮创建一个特殊的“交互指令”
        const command = `custom:action=show_folder&title=${encodeURIComponent(title)}&link=${encodeURIComponent(link)}`;

        return { 
            name: buttonName,
            pan: command, // 点击按钮时，传递的是这个指令
        };
    }).filter(item => item !== null);

    if (tracks.length === 0) {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '解析后无有效资源', pan: '' }] }] });
    }

    log(`资源解析完成，共 ${tracks.length} 个按钮`);
    return jsonify({
        list: [
            {
                title: '云盘',
                tracks: tracks,
            },
        ],
    });
}

// --- getPlayinfo 函数负责处理指令，并显示第二层“文件夹” ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    // 判断是否是我们的特殊指令
    if (panUrl.startsWith('custom:')) {
        log(`处理交互指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        
        const action = params.get('action');

        // 如果是“显示文件夹”的指令
        if (action === 'show_folder') {
            const folderTitle = decodeURIComponent(params.get('title'));
            const realLink = decodeURIComponent(params.get('link'));
            log(`准备显示文件夹: ${folderTitle}`);

            // 【核心】返回一个新的列表，里面只有一个按钮，这个按钮就是“文件夹”
            return jsonify({
                list: [
                    {
                        title: `文件夹[${getPanAbbr(folderTitle)}]`,
                        tracks: [
                            {
                                name: folderTitle, // “文件夹”的名字就是完整的原始标题
                                pan: realLink,     // “文件夹”包裹着真实的链接
                            }
                        ]
                    }
                ]
            });
        }
    }

    // 如果不是特殊指令，那就是最终的播放请求
    log(`准备播放: ${panUrl}`);
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 (终极嵌套实现版)');
