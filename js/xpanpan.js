import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://192.168.10.111:3000/api';

function log(msg) {
  console.log(`[网盘资源社插件] ${msg}`);
}

async function request(url) {
  log(`发起请求: ${url}`);
  try {
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000, // 15秒超时
    });

    if (response.status !== 200) {
      throw new Error(`HTTP错误! 状态: ${response.status}`);
    }

    const data = response.data;

    if (data.error) {
      throw new Error(`API返回错误: ${data.error}`);
    }
    
    log(`请求成功, 收到 ${data.list?.length || 0} 条数据`);
    return data;

  } catch (error) {
    log(`请求失败: ${error.message}`);
    return { error: true, message: error.message, list: [] };
  }
}

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  // 尝试调用后端健康检查接口，确认连通性
  await request(`${API_BASE_URL}/health`); 

  const appConfig = {
    ver: 1,
    title: '网盘资源社',
    site: API_BASE_URL, // 这里不再是原始网站，而是后端API地址
    cookie: '', // 移除手动Cookie，由后端处理
    tabs: [
      {
        name: '影视/剧集',
        ext: { id: 'forum-1.htm?page=' },
      },
      {
        name: '4K专区',
        ext: { id: 'forum-12.htm?page=' },
      },
      {
        name: '动漫区',
        ext: { id: 'forum-3.htm?page=' },
      },
    ],
  };
  return appConfig;
}

async function getCards(ext) {
  ext = argsify(ext); // 确保 ext 被正确解析
  const { page = 1, id } = ext;
  
  log(`获取分类数据: id=${id}, page=${page}`);
  
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_url || item.vod_id }, // 确保ext.url有值，优先使用vod_url，否则使用vod_id
  }));

  return { list: cards };
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext; // 这里的url是getCards返回的item.vod_url或vod_id
  if (!url) return { list: [] };

  log(`获取详情数据: url=${url}`);
  // 假设后端detail接口可以直接处理这个url作为id
  // 如果url是完整的，后端会解析；如果只是vod_id，后端也应该能处理
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  const tracks = [];
  if (data.list && data.list.length > 0) {
    // 假设后端返回的list中第一个元素就是详情数据，且包含play_url
    const detailItem = data.list[0];
    if (detailItem.vod_play_url) {
      // 假设vod_play_url是一个字符串，包含多个链接用$$$分隔
      const playUrls = detailItem.vod_play_url.split('$$$');
      playUrls.forEach(playUrl => {
        if (playUrl.trim()) {
          tracks.push({
            name: '网盘链接',
            pan: playUrl.trim(),
            ext: {},
          });
        }
      });
    }
  }

  return { list: [{ title: '资源列表', tracks }] };
}

async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { pan } = ext; // 这里的pan是getTracks返回的网盘链接
  log(`请求播放: url=${pan}`);
  return { urls: [pan] }; // 直接返回网盘链接让播放器处理
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';

  if (!text) return { list: [] };

  log(`执行搜索: keyword=${text}`);

  const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
  const data = await request(url);

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_url || item.vod_id },
  }));

  return { list: cards };
}

function argsify(ext) {
  return typeof ext === 'string' ? JSON.parse(ext) : ext;
}

function XPTVPluginSimulation() {
  const [config, setConfig] = useState(null);
  const [cards, setCards] = useState([]);
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    const initPlugin = async () => {
      const configData = await getConfig();
      setConfig(configData);
    };

    initPlugin();
  }, []);

  const handleTabClick = async (tab) => {
    const cardData = await getCards(tab.ext);
    setCards(cardData.list);
  };

  const handleCardClick = async (card) => {
    const trackData = await getTracks(card.ext);
    setTracks(trackData.list[0].tracks);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>XPTV Plugin Simulation</h1>
      {config && (
        <div>
          <h2>Tabs</h2>
          <ul>
            {config.tabs.map((tab, index) => (
              <li key={index} onClick={() => handleTabClick(tab)}>
                {tab.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cards.length > 0 && (
        <div>
          <h2>Cards</h2>
          <ul>
            {cards.map((card, index) => (
              <li key={index} onClick={() => handleCardClick(card)}>
                {card.vod_name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {tracks.length > 0 && (
        <div>
          <h2>Tracks</h2>
          <ul>
            {tracks.map((track, index) => (
              <li key={index}>{track.pan}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default XPTVPluginSimulation;


