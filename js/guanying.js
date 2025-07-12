// 观影网脚本 - 2025-07-12 终极修复版
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko) Mobile/15E148'

const appConfig = {
    ver: 5, // 更新版本号
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
        console.log(`正在请求: ${url}`);
        
        // 尝试使用更高级的请求头
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                "Connection": "keep-alive",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache"
            },
            timeout: 15000
        });
        
        console.log(`收到响应，长度: ${data.length} 字符`);
        
        // 检测DNS劫持或错误页面
        if (data.includes('p.error') || data.includes('DNS劫持')) {
            return handleError("检测到DNS劫持或错误页面");
        }
        
        const $ = cheerio.load(data);
        
        // 方法1: 尝试从HTML元素中提取数据
        const cardsFromHTML = parseCardsFromHTML($);
        if (cardsFromHTML.length > 0) {
            console.log(`从HTML元素找到 ${cardsFromHTML.length} 个卡片`);
            return jsonify({ list: cardsFromHTML });
        }
        
        // 方法2: 尝试从脚本中提取JSON数据
        const cardsFromScript = parseCardsFromScript($);
        if (cardsFromScript.length > 0) {
            console.log(`从脚本找到 ${cardsFromScript.length} 个卡片`);
            return jsonify({ list: cardsFromScript });
        }
        
        // 方法3: 尝试使用备用选择器
        const cardsFromBackup = parseCardsFromBackup($);
        if (cardsFromBackup.length > 0) {
            console.log(`从备用选择器找到 ${cardsFromBackup.length} 个卡片`);
            return jsonify({ list: cardsFromBackup });
        }
        
        // 作为最后手段，尝试使用浏览器视图
        return handleErrorWithBrowserView("无法解析页面数据", url);
    } catch (error) {
        return handleError("网络请求失败: " + error.message);
    }
}

// 解析方法1: 从HTML元素中提取数据
function parseCardsFromHTML($) {
    const cards = [];
    
    // 尝试从.v5d类中提取
    $('.v5d').each((index, element) => {
        try {
            const $el = $(element);
            const name = $el.find('b').text().trim() || '未知标题';
            const imgUrl = normalizeImageUrl($el.find('img').attr('src') || '');
            const info = $el.find('p').text().trim() || '暂无信息';
            const path = $el.find('a').attr('href') || '';
            
            if (path) {
                cards.push({
                    vod_id: path,
                    vod_name: name,
                    vod_pic: imgUrl,
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}/res/downurl${path}`,
                    },
                });
            }
        } catch (e) {
            console.error("解析单个卡片失败:", e);
        }
    });
    
    // 如果找到卡片则返回
    if (cards.length > 0) return cards;
    
    // 尝试其他可能的容器
    $('.item, .card, .movie-item').each((index, element) => {
        try {
            const $el = $(element);
            const name = $el.find('.title, .name, h2, h3').text().trim() || '未知标题';
            const imgUrl = normalizeImageUrl($el.find('img').attr('src') || '');
            const info = $el.find('.info, .meta, .desc').text().trim() || '暂无信息';
            const path = $el.find('a').attr('href') || '';
            
            if (path) {
                cards.push({
                    vod_id: path,
                    vod_name: name,
                    vod_pic: imgUrl,
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}/res/downurl${path}`,
                    },
                });
            }
        } catch (e) {
            console.error("解析单个卡片失败:", e);
        }
    });
    
    return cards;
}

// 解析方法2: 从脚本中提取JSON数据
function parseCardsFromScript($) {
    const cards = [];
    
    // 尝试找到包含数据的script标签
    $('script').each((i, el) => {
        try {
            const scriptContent = $(el).html();
            if (!scriptContent) return;
            
            // 尝试匹配JSON数据
            const jsonMatch = scriptContent.match(/_obj\s*=\s*({[\s\S]*?});/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    // 尝试直接解析
                    const jsonData = JSON.parse(jsonMatch[1]);
                    processJsonData(jsonData, cards);
                } catch (e) {
                    console.log("直接解析失败，尝试修复JSON:", e.message);
                    
                    // 如果解析失败，尝试修复JSON
                    try {
                        const fixedJson = jsonMatch[1]
                            .replace(/'/g, '"')          // 单引号转双引号
                            .replace(/(\w+):/g, '"$1":') // 为键添加引号
                            .replace(/,\s*}/g, '}')      // 修复多余逗号
                            .replace(/,\s*]/g, ']')      // 修复多余逗号
                            .replace(/undefined/g, 'null'); // 替换undefined
                        
                        const jsonData = JSON.parse(fixedJson);
                        processJsonData(jsonData, cards);
                    } catch (e2) {
                        console.error("JSON修复失败:", e2);
                    }
                }
            }
        } catch (e) {
            console.error("解析脚本失败:", e);
        }
    });
    
    return cards;
}

function processJsonData(jsonData, cards) {
    if (jsonData.inlist && jsonData.inlist.i) {
        const inlistData = jsonData.inlist;
        inlistData.i.forEach((item, index) => {
            cards.push({
                vod_id: item,
                vod_name: inlistData.t[index] || "未知标题",
                vod_pic: `https://s.tutu.pm/img/${jsonData.ty}/${item}.webp`,
                vod_remarks: inlistData.g[index] || "未知信息",
                ext: {
                    url: `${appConfig.site}res/downurl/${jsonData.ty}/${item}`,
                },
            });
        });
    }
}

// 解析方法3: 备用选择器
function parseCardsFromBackup($) {
    const cards = [];
    
    // 尝试所有链接容器
    $('a').each((index, element) => {
        try {
            const $el = $(element);
            const $parent = $el.parent();
            
            // 检查是否可能是媒体项
            if ($el.find('img').length > 0 && $el.attr('href') && $el.attr('href').includes('/res/downurl/')) {
                const name = $el.attr('title') || $el.text().trim() || '未知标题';
                const imgUrl = normalizeImageUrl($el.find('img').attr('src') || '');
                const info = $parent.find('p').text().trim() || $parent.text().trim() || '暂无信息';
                const path = $el.attr('href') || '';
                
                if (path) {
                    cards.push({
                        vod_id: path,
                        vod_name: name,
                        vod_pic: imgUrl,
                        vod_remarks: info,
                        ext: {
                            url: `${appConfig.site}${path}`,
                        },
                    });
                }
            }
        } catch (e) {
            console.error("解析备用卡片失败:", e);
        }
    });
    
    return cards;
}

async function getTracks(ext) {
    ext = argsify(ext)
    let tracks = []
    let url = ext.url
    
    try {
        console.log(`正在获取资源: ${url}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                'User-Agent': UA,
                'Accept': 'application/json, text/plain, */*',
                'Referer': appConfig.site
            }
        });
        
        console.log(`收到资源响应: ${data.substring(0, 100)}...`);
        
        let respstr;
        try {
            respstr = JSON.parse(data);
        } catch (e) {
            // 尝试处理非标准JSON
            try {
                respstr = JSON.parse(data.replace(/[\r\n]/g, '').replace(/'/g, '"'));
            } catch (e2) {
                return handleError("解析资源数据失败");
            }
        }
        
        if (respstr.panlist && respstr.panlist.url) {
            respstr.panlist.url.forEach((item, index) => {
                // 尝试从名称中提取有用信息
                let name = respstr.panlist.name[index] || "资源";
                
                // 简化名称
                name = name
                    .replace(/【.*?】/g, '') // 移除括号内容
                    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ') // 保留中文、字母、数字
                    .replace(/\s+/g, ' ') // 合并空格
                    .trim();
                
                // 如果名称太长，截取前20个字符
                if (name.length > 20) {
                    name = name.substring(0, 20) + '...';
                }
                
                tracks.push({
                    name: name,
                    pan: item,
                    ext: { url: '' },
                })
            });
            
            console.log(`找到 ${tracks.length} 个资源`);
        } else if (respstr.file) {
            return handleError("需要验证，请前往主站完成验证");
        } else {
            return handleError("没有可用的网盘资源");
        }
        
        return jsonify({
            list: [{ title: '资源列表', tracks }]
        });
    } catch (error) {
        return handleError("获取资源失败: " + error.message);
    }
}

async function getPlayinfo(ext) {
    return jsonify({ urls: [ext.url] })
}

async function search(ext) {
    ext = argsify(ext)
    let cards = []
    
    let text = encodeURIComponent(ext.text)
    let page = ext.page || 1
    let url = `${appConfig.site}/s/1---${page}/${text}`
    
    try {
        console.log(`正在搜索: ${text}, 页码: ${page}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        
        const $ = cheerio.load(data);
        
        // 使用与getCards相同的解析逻辑
        const cards1 = parseCardsFromHTML($);
        const cards2 = parseCardsFromScript($);
        const cards3 = parseCardsFromBackup($);
        
        // 合并结果
        cards = [...cards1, ...cards2, ...cards3];
        
        console.log(`找到 ${cards.length} 个搜索结果`);
        
        return jsonify({ list: cards });
    } catch (error) {
        return handleError("搜索失败: " + error.message);
    }
}

// ========== 辅助函数 ==========
function handleError(message) {
    console.error(message);
    try {
        $utils.toastError(message);
    } catch (e) {
        // Apple TV可能不支持toastError
    }
    return jsonify({ list: [], error: message });
}

function handleErrorWithBrowserView(message, url) {
    console.error(message);
    try {
        // 在支持浏览器视图的环境中打开页面
        if ($utils.openSafari) {
            $utils.openSafari(url, UA);
        }
        $utils.toastError(message + "，已打开浏览器视图");
    } catch (e) {
        console.error("无法打开浏览器视图:", e);
    }
    return jsonify({ list: [], error: message });
}

function normalizeImageUrl(url) {
    if (!url) return '';
    
    // 处理协议相对URL
    if (url.startsWith('//')) {
        url = 'https:' + url;
    }
    // 处理相对URL
    else if (!url.startsWith('http')) {
        url = appConfig.site + url.replace(/^\/+/, '');
    }
    
    // 确保使用安全的图片协议
    return url.replace(/^http:/, 'https:');
}
