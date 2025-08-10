/**
 * XPTV App 插件前端代码 (v11.2 - 前后端联动联调版)
 * 
 * 功能:
 * - 核心修改: 在 getTracks 函数中，增加了一行日志，用于打印从后端接收到的最原始的 vod_play_url 数据包。
 * - 目的: 与后端的 [后端成果] 日志配合，形成完整的、端到端的调试链，清晰地展示数据流转和加工过程。
 */

// ... (除了 getTracks，其他代码与 v11.1 完全相同) ...

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  if (data.error || !data.list || data.list.length === 0) {
    return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '获取资源失败或帖子无内容', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  const detailItem = data.list[0];

  // ★★★★★ 【v11.2 新增调试代码】 ★★★★★
  log(`[前端收货] 从后端收到原始 vod_play_url: ${detailItem.vod_play_url}`);
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★

  if (detailItem.vod_play_url && detailItem.vod_play_url.trim() !== '' && detailItem.vod_play_url !== '暂无有效网盘链接') {
    const playUrlPackages = detailItem.vod_play_url.split('$$$');
    
    playUrlPackages.forEach((pkg) => {
      if (pkg.trim()) {
        const parts = pkg.split('$');
        if (parts.length < 2) return;

        const fileName = parts[0];
        const dataPacket = parts[1];

        const linkParts = dataPacket.split('|');
        const pureLink = linkParts[0] || '';
        const accessCode = linkParts[1] || '';

        let finalPan = pureLink;
        if (accessCode) {
            const separator = pureLink.includes('?') ? '&' : '?';
            finalPan = `${pureLink}${separator}pwd=${accessCode}`;
        }

        const trackObject = {
          name: fileName,
          pan: finalPan,
          ext: { pwd: '' },
        };

        log(`[前端加工] 准备推送给App的最终数据: ${JSON.stringify(trackObject)}`);

        tracks.push(trackObject);
      }
    });
  }

  if (tracks.length === 0) {
    tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} });
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

// ... (其他函数不变) ...
