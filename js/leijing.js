// ==UserScript==
// @name         雷鲸资源站 - 完整修复版
// @description  支持分类、搜索、详情、跳转，修复天翼云盘第三段跳转问题
// @version      2025.07.28
// ==/UserScript==

const site = 'https://www.leijing.xyz';

export default {
  // 分类结构：保持 tabs/ext 格式不变
  tabs: [
    { name: '电影', type: '1' },
    { name: '剧集', type: '2' },
    { name: '动漫', type: '3' },
    { name: '综艺', type: '4' },
  ],
  ext: async ({ type, page }) => {
    const res = await $fetch(`${site}/thread?topicId=${type}&page=${page}`);
    const $ = createCheerio(res);
    const list = [];

    $('.post-list .post-item').each((i, item) => {
      const a = $(item).find('.post-title a');
      const url = a.attr('href');
      const title = a.text().trim();
      const img = $(item).find('.post-img img').attr('src');
      if (url && title) {
        list.push({
          id: site + url,
          name: title,
          pic: img?.startsWith('http') ? img : site + img,
        });
      }
    });

    return list;
  },

  // 搜索接口：保留原样
  search: async (key, page) => {
    const res = await $fetch(`${site}/search?keyword=${encodeURIComponent(key)}&page=${page}`);
    const $ = createCheerio(res);
    const list = [];

    $('.post-list .post-item').each((i, item) => {
      const a = $(item).find('.post-title a');
      const url = a.attr('href');
      const title = a.text().trim();
      const img = $(item).find('.post-img img').attr('src');
      if (url && title) {
        list.push({
          id: site + url,
          name: title,
          pic: img?.startsWith('http') ? img : site + img,
        });
      }
    });

    return list;
  },

  // ✅ 详情页：包含三段天翼云盘链接提取逻辑，已修复第三段跳转
  detail: async ({ url, id, name }) => {
    const html = await $fetch(url);
    const $ = createCheerio(html);
    const title = $('h1').text().trim();
    const tracks = [];
    const unique = new Set();

    // 第一部分：attachlist 区块
    $('.attachlist a[href*="cloud.189.cn"]').each((_, el) => {
      const pan = $(el).attr('href');
      if (!pan || unique.has(pan)) return;
      const text = $(el).parent().text();
      const codeMatch = /(?:提取码|访问码|密码)[:：\s]*([a-zA-Z0-9]{4,6})/.exec(text);
      tracks.push({
        name: $(el).text().trim() || title,
        pan,
        type: 'jump',
        ext: { accessCode: codeMatch ? codeMatch[1] : '' }
      });
      unique.add(pan);
    });

    // 第二部分：quote 区块
    $('.quote').each((_, q) => {
      const text = $(q).text();
      const regex = /https?:\/\/cloud\.189\.cn\/(?:t|web\/share\?code)=([a-zA-Z0-9]+).*?(?:提取码|密码|访问码)[:：]?\s*([a-zA-Z0-9]{4,6})?/ig;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const pan = `https://cloud.189.cn/t/${match[1]}`;
        const code = match[2] || '';
        if (unique.has(pan)) continue;
        tracks.push({
          name: `天翼云盘资源`,
          pan,
          type: 'jump',
          ext: { accessCode: code }
        });
        unique.add(pan);
      }
    });

    // ✅ 第三部分：正文 .topicContent 中的裸链接（已修复跳转问题）
    const contentHtml = $('.topicContent').html() || '';
    const $inner = createCheerio(contentHtml);

    $inner('body').contents().each((_, el) => {
      const nodeText = $inner(el).text();
      const naked = /https?:\/\/cloud\.189\.cn\/(?:t|web\/share\?code)=([a-zA-Z0-9]+).*?[（(]?(?:提取码|访问码|密码)?[:：\s]*([a-zA-Z0-9]{4,6})[）)]?/ig;
      let match;
      while ((match = naked.exec(nodeText)) !== null) {
        const url = `https://cloud.189.cn/t/${match[1]}`;
        const code = match[2];
        if (unique.has(url)) continue;
        tracks.push({
          name: `天翼云盘资源（正文提取）`,
          pan: url,
          type: 'jump',
          ext: { accessCode: code }
        });
        unique.add(url);
      }
    });

    return {
      id,
      name,
      tracks
    };
  },

  // 播放接口：走跳转逻辑
  play: async ({ pan, ext }) => {
    return {
      type: 'jump',
      url: pan,
      ext
    };
  }
};
