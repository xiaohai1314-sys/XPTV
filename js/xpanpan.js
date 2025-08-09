/**
 * XPTV App 插件前端代码 (v9.0 - 终极模拟与调试版)
 *
 * 功能:
 * - 完全模拟“海绵小站”参考案例的【前端】职责。
 * - 旨在修复所有已知问题，并保留详细的调试日志。
 *
 * v9.0 版本关键修复:
 * 1. 【职责明确】前端负责解析后端发来的 `文件名$链接文本` 数据包。
 * 2. 【智能解析】使用强大的正则表达式，从“链接文本”中精准分离出“纯净链接”和“访问码”。
 * 3. 【精准赋值】将“纯净链接”放入 `pan` 字段，将“访问码”放入 `ext.pwd` 字段，完美适配App机制。
 * 4. 【显示纯净】按钮名称只使用“文件名”，不再显示任何 `[码:...]` 字样。
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
 * 获取详情和播放链接 - 【v9.0 核心修复】
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
    const dataPackages = detailItem.vod_play_url.split('$$$');
    
    dataPackages.forEach((pkg) => {
      if (!pkg.trim()) return;

      const parts = pkg.split('$');
      if (parts.length < 2) return;

      const fileName = parts[0];
      const linkText = parts[1];
      
      log(`[前端解析] 收到数据包 -> 文件名: "${fileName}", 链接文本: "${linkText.replace(/\n/g, ' ')}"`);

      let pureLink = '';
      let accessCode = '';

      // 终极正则表达式，能处理两种情况
      // 1. https://.../?pwd=xxxx
      // 2. https://... 提取码: yyyy
      const linkMatch = linkText.match(/(https?:\/\/[a-zA-Z0-9./?=&_#-]+ )/);
      if (!linkMatch) {
          log(`[前端解析] 错误: 在链接文本中未找到任何URL。`);
          return;
      }
      const fullLink = linkMatch[0];

      const pwdMatch = fullLink.match(/[?&]pwd=([a-zA-Z0-9]+)/);
      const codeMatch = linkText.match(/(?:提取码|访问码|密码)\s*[：:]?\s*([a-zA-Z0-9]{4,})/i);

      if (pwdMatch && pwdMatch[1]) {
          // 情况1：链接自带pwd参数
          pureLink = fullLink.split('?')[0];
          accessCode = pwdMatch[1];
          log(`[前端解析] 模式1 (成品链接) -> 纯净链接: "${pureLink}", 访问码: "${accessCode}"`);
      } else if (codeMatch && codeMatch[1]) {
          // 情况2：链接和提取码文本分离
          pureLink = fullLink;
          accessCode = codeMatch[1];
          log(`[前端解析] 模式2 (分离链接) -> 纯净链接: "${pureLink}", 访问码: "${accessCode}"`);
      } else {
          // 情况3：无访问码
          pureLink = fullLink;
          accessCode = '';
          log(`[前端解析] 模式3 (无码链接) -> 纯净链接: "${pureLink}"`);
      }

      tracks.push({
        name: fileName,
        pan: pureLink,
        ext: { pwd: accessCode },
      });
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

log('网盘资源社插件加载完成 (v9.0 - 终极模拟与调试版)');
