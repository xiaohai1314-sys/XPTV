/**
 * 天逸搜插件 - V1.1
 * 网站：https://tianyiso.com (天翼云盘搜索)
 * 功能：仅搜索功能，无分类浏览
 */

// --- 配置区 ---
const SITE_URL = "https://tianyiso.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const DEBUG = true;

// 排序选项
const SORT_OPTIONS = {
    DEFAULT: 0,    // 默认排序
    TIME: 1,       // 时间排序
    EXACT: 2       // 完全匹配
};

// 类型选项
const TYPE_OPTIONS = {
    ALL: -1,       // 全部
    VIDEO: 1,      // 视频
    MUSIC: 2,      // 音乐
    IMAGE: 3,      // 图片
    DOC: 4,        // 文档
    ZIP: 5,        // 压缩包
    OTHER: 6,      // 其他
    FOLDER: 7      // 文件夹
};

// --- 辅助函数 ---
function log(msg) { 
    if (DEBUG) console.log(`[天逸搜插件] ${msg}`); 
}

function argsify(ext) { 
    return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); 
}

function jsonify(data) { 
    return JSON.stringify(data); 
}

function getCorrectUrl(path) {
    if (!path || path.startsWith('http')) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- 插件入口函数 ---

/**
 * 初始化配置
 */
async function getConfig() {
    log("==== 插件初始化 V1.0 ====");
    return jsonify({
        ver: 1.0,
        title: '天逸搜',
        site: SITE_URL,
        cookie: '',
        tabs: [], // 无分类，仅搜索
    });
}

/**
 * 搜索功能
 * @param {Object} ext - 扩展参数 {text: 搜索词, page: 页码, sort: 排序, type: 类型}
 */
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);
    const sort = parseInt(ext.sort || SORT_OPTIONS.DEFAULT, 10);
    const type = parseInt(ext.type || TYPE_OPTIONS.ALL, 10);

    log(`[search] 搜索: "${searchText}" | 页码: ${page} | 排序: ${sort} | 类型: ${type}`);

    if (!searchText) {
        log('[search] 搜索词为空');
        return jsonify({ list: [] });
    }

    // 构建搜索URL
    const searchUrl = `${SITE_URL}/search?k=${encodeURIComponent(searchText)}&page=${page}&s=${sort}&t=${type}`;
    log(`[search] 请求URL: ${searchUrl}`);

    try {
        const { data } = await $fetch.get(searchUrl, { 
            headers: { 'User-Agent': UA } 
        });
        
        log(`[search] 获取到HTML数据，长度: ${data.length}`);
        const $ = cheerio.load(data);
        const cards = [];

        // 从HTML文档分析，搜索结果在 <van-row> 标签中，每个结果包含 <a> 标签
        // 结构: <van-row><a href="/s/xxx"><van-col><van-card>...</van-card></van-col></a></van-row>
        
        $('a[href^="/s/"]').each((index, element) => {
            const link = $(element);
            const href = link.attr('href');
            
            if (!href) return;

            // 提取资源ID
            const resourceId = href.replace('/s/', '');
            
            // 提取标题 - 在 template#title 里的 div 中
            let title = '';
            const titleDiv = link.find('div[style*="font-size:medium"]');
            if (titleDiv.length > 0) {
                // 获取文本内容，移除 span 标签
                title = titleDiv.text().trim();
            }
            
            if (!title) {
                log(`[search] 第 ${index + 1} 个结果标题为空，跳过`);
                return;
            }

            // 提取底部信息
            let remarks = '';
            const bottomDiv = link.find('div[style*="padding-bottom"]');
            if (bottomDiv.length > 0) {
                remarks = bottomDiv.text().trim();
            }
            
            // 提取缩略图
            const thumbImg = link.find('img');
            let thumb = '/img/folder.png';
            if (thumbImg.length > 0) {
                thumb = thumbImg.attr('src') || '/img/folder.png';
            }

            log(`[search] 解析第 ${index + 1} 个结果: ${title}`);

            cards.push({
                vod_id: resourceId,
                vod_name: title,
                vod_pic: getCorrectUrl(thumb),
                vod_remarks: remarks,
                ext: { 
                    url: getCorrectUrl(href),
                    resourceId: resourceId
                }
            });
        });

        log(`[search] ✓ 成功提取 ${cards.length} 个结果`);
        
        // 如果结果少于10个，说明可能是最后一页
        if (cards.length < 10) {
            log(`[search] 结果数 < 10，可能是最后一页`);
        }

        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 发生异常: ${e.message}`);
        log(`[search] 错误堆栈: ${e.stack}`);
        return jsonify({ list: [] });
    }
}

/**
 * 获取详情和播放链接
 * @param {Object} ext - 扩展参数 {url: 详情页URL, resourceId: 资源ID}
 */
async function getTracks(ext) {
    ext = argsify(ext);
    const resourceId = ext.resourceId || ext.url?.split('/').pop();
    
    if (!resourceId) {
        log(`[getTracks] ❌ 资源ID为空`);
        return jsonify({ list: [] });
    }

    log(`[getTracks] 获取资源详情: ${resourceId}`);

    try {
        // 访问详情页获取密码等信息
        const detailUrl = `${SITE_URL}/s/${resourceId}`;
        log(`[getTracks] 访问详情页: ${detailUrl}`);
        
        const { data } = await $fetch.get(detailUrl, { 
            headers: { 'User-Agent': UA } 
        });
        const $ = cheerio.load(data);

        // 提取资源名称
        const resourceName = $('h3[align="center"]').text().trim() || '未知资源';
        
        // 提取密码（如果有）
        let password = '';
        const passwordCell = $('van-cell[title="密码"] b').text().trim();
        if (passwordCell) {
            password = passwordCell;
            log(`[getTracks] 发现密码: ${password}`);
        }

        // 现在访问跳转链接获取真实网盘URL
        const cvUrl = `${SITE_URL}/cv/${resourceId}`;
        log(`[getTracks] 访问跳转链接: ${cvUrl}`);

        // 跟踪重定向获取最终URL
        const response = await $fetch.get(cvUrl, {
            headers: { 'User-Agent': UA },
            redirect: 'follow'
        });

        // 获取最终重定向后的URL
        let finalUrl = cvUrl;
        if (response.url) {
            finalUrl = response.url;
        }

        log(`[getTracks] ✓ 获取到最终链接: ${finalUrl}`);

        // 判断网盘类型
        let panName = '天翼云盘';
        if (finalUrl.includes('189.cn')) {
            panName = '天翼云盘';
        } else if (finalUrl.includes('quark')) {
            panName = '夸克网盘';
        } else if (finalUrl.includes('baidu')) {
            panName = '百度网盘';
        } else if (finalUrl.includes('aliyundrive')) {
            panName = '阿里云盘';
        }

        // 构建播放信息
        const trackName = password ? `${panName} (密码: ${password})` : panName;

        return jsonify({
            list: [{
                title: resourceName,
                tracks: [{
                    name: trackName,
                    pan: finalUrl,
                    ext: { password: password }
                }]
            }]
        });

    } catch (e) {
        log(`[getTracks] ❌ 发生异常: ${e.message}`);
        
        // 降级处理：返回手动访问链接
        return jsonify({
            list: [{
                title: '获取失败',
                tracks: [{
                    name: '请手动访问',
                    pan: `${SITE_URL}/s/${resourceId}`,
                    ext: {}
                }]
            }]
        });
    }
}

// --- 兼容接口 ---
async function init() { 
    return getConfig(); 
}

async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ 
        class: config.tabs, 
        filters: {
            // 搜索过滤器
            sort: [
                { name: '默认排序', value: '0' },
                { name: '时间排序', value: '1' },
                { name: '完全匹配', value: '2' }
            ],
            type: [
                { name: '全部类别', value: '-1' },
                { name: '视频', value: '1' },
                { name: '音乐', value: '2' },
                { name: '图片', value: '3' },
                { name: '文档', value: '4' },
                { name: '压缩包', value: '5' },
                { name: '其他', value: '6' },
                { name: '文件夹', value: '7' }
            ]
        }
    });
}

async function category(tid, pg) {
    // 无分类功能，返回空
    log('[category] 本插件无分类功能');
    return jsonify({ list: [] });
}

async function detail(id) { 
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ resourceId: id }); 
}

async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}
