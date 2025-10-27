// 配置你的后端服务地址
const BACKEND_URL = "http://192.168.10.106:3000";  // 替换为你的服务器地址

// ★ 首页分类
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    
    try {
        const url = `${BACKEND_URL}/api/category/${encodeURIComponent(categoryName)}/${page}`;
        const response = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const data = JSON.parse(response.data);
        return jsonify(data);
    } catch (e) {
        log(`[getCards] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★ 搜索
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    
    if (!text) return jsonify({ list: [] });
    
    try {
        const url = `${BACKEND_URL}/api/search/${encodeURIComponent(text)}/0/${page}`;
        const response = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const data = JSON.parse(response.data);
        return jsonify(data);
    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★ 获取网盘链接 (关键！)
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    
    if (!url) return jsonify({ list: [] });
    
    try {
        // 【关键】将URL参数转换为安全的格式
        const encodedId = encodeURIComponent(url);
        const apiUrl = `${BACKEND_URL}/api/tracks/${encodedId}`;
        
        log(`[getTracks] 请求: ${apiUrl}`);
        
        const response = await $fetch.get(apiUrl, { headers: { 'User-Agent': UA } });
        const data = JSON.parse(response.data);
        return jsonify(data);
    } catch (e) {
        log(`[getTracks] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}
