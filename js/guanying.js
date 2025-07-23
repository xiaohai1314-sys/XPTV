/**
 * Gying 前端插件 - 终极模仿版 v3.0.0
 * 
 * 作者: 基于用户反馈和参考代码的最终尝试
 * 版本: v3.0.0 (终极模仿版)
 * 更新日志:
 * v3.0.0: 
 * 1. 【像素级模仿】getTracks 永远返回和 SeedHub 一样结构的JSON，pan属性永远是链接（或占位符链接）。
 * 2. 【改变通信方式】放弃在 pan 中传递指令，改为在 ext 对象中隐藏和传递分步信息 (step, pan_type, resource_index)。
 * 3. 【重构 play 函数】play 函数现在是分步逻辑的核心控制器，负责解析 ext 指令并重新调用 getTracks。
 * 4. 这是基于所有已知信息的最优解，旨在解决APP对返回JSON结构过于挑剔的问题。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数与配置 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying观影 (四步版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) { return jsonify({ list: [] }); }
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) { return jsonify({ list: [], total: 0 }); }
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards, total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) { return jsonify({ list: [] }); }
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) { return jsonify({ list: [] }); }
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards });
}

// --- 【核心实现：v3.0 终极模仿版】 ---
async function getTracks(ext) {
    ext = argsify(ext);
    let vod_id = ext.url || ext.id || ext;
    if (typeof ext === 'string') { vod_id = ext; }

    const { step = 'step1', pan_type, resource_index } = ext;
    log(`getTracks: step=${step}, pan_type=${pan_type}, resource_index=${resource_index}`);

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);
    if (data.error || !data.list || data.list.length === 0) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }
    const fullResourceCache = playUrlString.split('#').map((item, index) => {
        const parts = item.split('$');
        if (!parts[0] || !parts[1]) return null;
        return { type: detectPanType(parts[0]), title: parts[0].trim(), link: parts[1].trim(), index: index };
    }).filter(Boolean);

    let tracks = [];
    let title = 'Gying';
    let next_ext = {}; // 这个对象将用来构建下一步的指令

    // 步骤1: 显示网盘分类
    if (step === 'step1') {
        title = '第一步：请选择网盘';
        const panTypeCounts = {};
        fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
        tracks = Object.keys(panTypeCounts).map(typeCode => {
            next_ext = { url: vod_id, step: 'step2', pan_type: typeCode };
            return {
                name: `[分类] ${PAN_TYPE_MAP[typeCode] || '未知'} (${panTypeCounts[typeCode]})`,
                // pan 是一个无意义的占位符，但 ext 包含了下一步的指令
                pan: `http://gying.org/step/2`, 
                ext: next_ext
            };
        } );
    }

    // 步骤2: 显示所选分类下的所有资源
    else if (step === 'step2') {
        title = `第二步：请选择资源 (${PAN_TYPE_MAP[pan_type]})`;
        const resourcesOfSelectedType = fullResourceCache.filter(r => r.type === pan_type);
        tracks = resourcesOfSelectedType.map(r => {
            const cleanTitle = r.title.replace(/【.*?】|\[.*?\]/g, '').trim();
            next_ext = { url: vod_id, step: 'step3', resource_index: r.index };
            return {
                name: `[资源] ${cleanTitle}`,
                pan: `http://gying.org/step/3`,
                ext: next_ext
            };
        } );
    }

    // 步骤3: 显示所选资源的文件夹
    else if (step === 'step3') {
        title = '第三步：请点击文件夹播放';
        const selectedResource = fullResourceCache.find(r => r.index == resource_index);
        if (selectedResource) {
            tracks.push({
                name: `[文件夹] ${selectedResource.title}`,
                pan: selectedResource.link, // pan里是最终的真实链接
                ext: { url: selectedResource.link } // ext 也带上，保持结构一致
            });
        }
    }

    // 统一返回APP能理解的简单结构
    return jsonify({
        list: [{
            title: title,
            tracks: tracks,
        }],
    });
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    log(`getPlayinfo called with ext: ${JSON.stringify(ext)}`);

    // 检查 ext 中是否有我们藏好的 step 指令
    if (ext.step) {
        log(`getPlayinfo: 收到分步指令，重新调用getTracks`);
        // 如果有，说明这是一个分步操作，需要重新调用 getTracks 来生成下一级界面
        return await getTracks(ext);
    }
    
    // 如果没有 step 指令，说明这是一个真实的播放请求
    log(`getPlayinfo: 收到真实播放链接: ${ext.pan || ext.url}`);
    const playUrl = ext.pan || ext.url;
    return jsonify({ urls: [{ name: '点击播放', url: playUrl }] });
}

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { 
    // 初始调用时，ext里没有step，getTracks会默认执行step1
    return await getTracks({ id: id }); 
}
async function play(ext) { 
    // play函数现在是分步逻辑的核心控制器
    return await getPlayinfo(ext); 
}

log('Gying前端插件加载完成 v3.0.0 (终极模仿版)');
