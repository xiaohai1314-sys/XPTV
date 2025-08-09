/**
 * XPTV App 插件前端代码 (v7.0 - 修复与调试版)
 *
 * 功能:
 * - 与 v9.0 版本后端完美配合。
 *
 * v7.0 版本关键修复:
 * 1. 【解析强化】放弃使用 `new URL()`，改用更健壮的正则表达式从 pan 字段中提取访问码用于显示。
 *    这能避免因URL中存在不可见字符而导致的解析失败。
 * 2. 【逻辑简化】代码逻辑更清晰，完全信任后端返回的 pan 字段是最终可用的成品链接。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.4:3000/api'; // 请务必替换为你的后端服务实际地址
// --- 配置区 ---

// --- App环境函数 (无变化 ) ---
function log(msg) { try { $log(`[网盘资源社插件] ${msg}`); } catch (_) { console.log(`[网盘资源社插件] ${msg}`); } }
async function request(url) { log(`发起请求: ${url}`); try { const response = await $fetch.get(url, { headers: { 'Accept': 'application/json' }, timeout: 30000 }); if (response.status !== 200) throw new Error(`HTTP错误! 状态: ${response.status}`); const data = JSON.parse(response.data); if (data.error) throw new Error(`API返回错误: ${data.error}`); log(`请求成功, 收到 ${data.list?.length || 0} 条数据`); return data; } catch (error) { log(`请求失败: ${error.message}`); return { error: true, message: error.message, list: [] }; } }

// --- XPTV App 插件入口函数 (无变化) ---
async function getConfig() { log(`插件初始化，后端API地址: ${API_BASE_URL}`); const appConfig = { ver: 1, title: '网盘资源社', site: API_BASE_URL, cookie: '', tabs: [ { name: '影视/剧集', ext: { id: 'forum-1.htm' } }, { name: '4K专区', ext: { id: 'forum-12.htm' } }, { name: '动漫区', ext: { id: 'forum-3.htm' } }, { name: '教程/书籍', ext: { id: 'forum-8.htm' } }, { name: '综艺娱乐', ext: { id: 'forum-2.htm' } }, { name: '音乐MV', ext: { id: 'forum-4.htm' } } ], }; return jsonify(appConfig); }
async function getCards(ext) { ext = argsify(ext); const { page = 1, id } = ext; log(`获取分类数据: id=${id}, page=${page}`); const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`; const data = await request(url); if (data.error) { log(`获取分类数据失败: ${data.message}`); return jsonify({ list: [] }); } const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic || '', vod_remarks: item.vod_remarks || '', ext: { url: item.vod_id }, })); log(`成功处理 ${cards.length} 条分类数据`); return jsonify({ list: cards }); }

/**
 * 获取详情和播放链接 - 【v7.0 核心修复】
 */
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) {
    log('获取详情失败: 缺少URL参数');
    return jsonify({ list: [] });
  }

  log(`获取详情数据: url=${url}`);
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  if (data.error || !data.list || data.list.length === 0) {
    log(`获取详情数据失败或内容为空: ${data.message || '无有效列表'}`);
    return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '获取资源失败或帖子无内容', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  const detailItem = data.list[0];

  if (detailItem.vod_play_url && detailItem.vod_play_url.trim() !== '' && detailItem.vod_play_url !== '暂无有效网盘链接') {
    const playUrls = detailItem.vod_play_url.split('$$$');
    
    playUrls.forEach((fullUrl, index) => {
      if (fullUrl.trim()) {
        let panName = `网盘 ${index + 1}`;
        let passCode = '';

        // 【v7.0 修复】改用正则表达式提取访问码，更健壮
        const passMatch = fullUrl.match(/[?&]pwd=([a-zA-Z0-9]+)/);
        if (passMatch && passMatch[1]) {
            passCode = passMatch[1];
        }
        
        if (fullUrl.includes('quark.cn')) {
            panName = `夸克网盘 ${index + 1}`;
        } else if (fullUrl.includes('aliyundrive.com') || fullUrl.includes('alipan.com')) {
            panName = `阿里云盘 ${index + 1}`;
        } else if (fullUrl.includes('uc.cn')) {
            panName = `UC网盘 ${index + 1}`;
        }
        
        if (passCode) {
          panName += ` [码:${passCode}]`;
        }
        
        tracks.push({
          name: panName,
          pan: fullUrl,
          ext: {},
        });
        
        log(`添加网盘链接: ${panName}, URL: ${fullUrl}`);
      }
    });
  }

  if (tracks.length === 0) {
    tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} });
    log('该帖子不含有效链接或所有链接解析失败');
  }

  log(`成功处理 ${tracks.length} 个播放链接`);
  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function search(ext) { ext = argsify(ext); const text = ext.text || ''; if (!text) { log('搜索失败: 缺少关键词'); return jsonify({ list: [] }); } log(`执行搜索: keyword=${text}`); const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) { log(`搜索失败: ${data.message}`); return jsonify({ list: [] }); } const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic || '', vod_remarks: '', ext: { url: item.vod_id }, })); log(`搜索成功，找到 ${cards.length} 条结果`); return jsonify({ list: cards }); }

// --- 兼容旧版 XPTV App 接口 (无变化) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('网盘资源社插件加载完成 (v7.0 - 修复与调试版)');
