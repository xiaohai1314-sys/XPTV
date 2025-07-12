// 观影网脚本 - TV端终极解决方案
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Apple; CPU OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko) TV Safari/604.1'

const appConfig = {
    ver: 50,
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        {
            name: '电影',
            ext: {
                id: 'mv?page=',
            },
        },
        {
            name: '剧集',
            ext: {
                id: 'tv?page=',
            },
        },
        {
            name: '动漫',
            ext: {
                id: 'ac?page=',
            },
        }
    ],
}

async function getConfig() {
    return jsonify(appConfig)
}

async function getCards(ext) {
    ext = argsify(ext)
    let cards = []
    let { page = 1, id } = ext
    const url = `${appConfig.site}${id}${page}`
    
    try {
        console.log(`[TV] 正在请求: ${url}`);
        
        // 添加详细的调试信息
        const startTime = Date.now();
        
        // 使用代理友好的配置
        const response = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                "Connection": "keep-alive",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "X-Requested-With": "XMLHttpRequest" // 模拟AJAX请求
            },
            timeout: 30000,
            followRedirects: true,
            retry: 2 // 失败重试2次
        });
        
        const endTime = Date.now();
        console.log(`[TV] 收到响应，耗时: ${endTime - startTime}ms`);
        
        // 检查响应状态
        if (response.status !== 200) {
            console.error(`[TV] 请求失败，状态码: ${response.status}`);
            return handleError(`网络请求失败，状态码: ${response.status}`);
        }
        
        const data = response.data;
        
        // 保存HTML用于调试
        try {
            $utils.writeFile("tv_debug.html", data
