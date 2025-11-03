/**
 * 天逸搜插件 - V1.1
 * 网站：https://tianyiso.com (天翼云盘搜索)
 * 功能：仅搜索功能，无分类浏览
 */

// --- 配置区 ---
const SITE_URL = "https://tianyiso.com";
[span_0](start_span)// 更改 User-Agent[span_0](end_span)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const DEBUG = true;

// 排序选项
const SORT_OPTIONS = {
    [span_1](start_span)DEFAULT: 0,    // 默认排序[span_1](end_span)
    [span_2](start_span)TIME: 1,       // 时间排序[span_2](end_span)
    [span_3](start_span)EXACT: 2       // 完全匹配[span_3](end_span)
};
// 类型选项
const TYPE_OPTIONS = {
    [span_4](start_span)ALL: -1,       // 全部[span_4](end_span)
    [span_5](start_span)VIDEO: 1,      // 视频[span_5](end_span)
    [span_6](start_span)MUSIC: 2,      // 音乐[span_6](end_span)
    [span_7](start_span)IMAGE: 3,      // 图片[span_7](end_span)
    [span_8](start_span)DOC: 4,        // 文档[span_8](end_span)
    [span_9](start_span)ZIP: 5,        // 压缩包[span_9](end_span)
    [span_10](start_span)OTHER: 6,      // 其他[span_10](end_span)
    [span_11](start_span)FOLDER: 7      // 文件夹[span_11](end_span)
};

// --- 辅助函数 ---
function log(msg) { 
    [span_12](start_span)if (DEBUG) console.log(`[天逸搜插件] ${msg}`);[span_12](end_span)
}

function argsify(ext) { 
    return (typeof ext === 'string') ? [span_13](start_span)JSON.parse(ext) : (ext || {});[span_13](end_span)
}

function jsonify(data) { 
    [span_14](start_span)return JSON.stringify(data);[span_14](end_span)
}

function getCorrectUrl(path) {
    if (!path || path.startsWith('http')) return path || [span_15](start_span)'';[span_15](end_span)
    return `${SITE_URL}${path.startsWith('/') ? [span_16](start_span)'' : '/'}${path}`;[span_16](end_span)
}

// --- 插件入口函数 ---

/**
 * 初始化配置
 */
async function getConfig() {
    [span_17](start_span)log("==== 插件初始化 V1.0 ====");[span_17](end_span)
    return jsonify({
        ver: 1.0,
        title: '天逸搜',
        site: SITE_URL,
        cookie: '',
        [span_18](start_span)tabs: [], // 无分类，仅搜索[span_18](end_span)
    });
}

/**
 * 搜索功能
 * @param {Object} ext - 扩展参数 {text: 搜索词, page: 页码, sort: 排序, type: 类型}
 */
async function search(ext) {
    [span_19](start_span)ext = argsify(ext);[span_19](end_span)
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);
    [span_20](start_span)const sort = parseInt(ext.sort || SORT_OPTIONS.DEFAULT, 10);[span_20](end_span)
    [span_21](start_span)const type = parseInt(ext.type || TYPE_OPTIONS.ALL, 10);[span_21](end_span)

    [span_22](start_span)log(`[search] 搜索: "${searchText}" | 页码: ${page} | 排序: ${sort} | 类型: ${type}`);[span_22](end_span)
    if (!searchText) {
        [span_23](start_span)log('[search] 搜索词为空');[span_23](end_span)
        return jsonify({ list: [] });
    }

    // 构建搜索URL
    const searchUrl = `${SITE_URL}/search?k=${encodeURIComponent(searchText)}&page=${page}&s=${sort}&t=${type}`;
    [span_24](start_span)log(`[search] 请求URL: ${searchUrl}`);[span_24](end_span)
    
    // 【修复点 2：增加超时设置，防止无限转圈】
    try {
        const { data } = await $fetch.get(searchUrl, { 
            headers: { 'User-Agent': UA },
            timeout: 5000 // 5秒超时
        });
        [span_25](start_span)log(`[search] 获取到HTML数据，长度: ${data.length}`);[span_25](end_span)
        const $ = cheerio.load(data);
        const cards = [];
        [span_26](start_span)// 从HTML文档分析，搜索结果在 <van-row> 标签中，每个结果包含 <a> 标签[span_26](end_span)
        [span_27](start_span)// 结构: <van-row><a href="/s/xxx"><van-col><van-card>...</van-card></van-col></a></van-row>[span_27](end_span)
        
        [span_28](start_span)$('a[href^="/s/"]').each((index, element) => {[span_28](end_span)
            const link = $(element);
            const href = link.attr('href');
            
            if (!href) return;

         
            [span_29](start_span)// 提取资源ID[span_29](end_span)
            [span_30](start_span)const resourceId = href.replace('/s/', '');[span_30](end_span)
            
            // 提取标题 - 在 template#title 里的 div 中
            let title = '';
            [span_31](start_span)const titleDiv = link.find('div[style*="font-size:medium"]');[span_31](end_span)
            if (titleDiv.length > 0) {
   
                [span_32](start_span)// 获取文本内容，移除 span 标签[span_32](end_span)
                [span_33](start_span)title = titleDiv.text().trim();[span_33](end_span)
            }
            
            if (!title) {
                [span_34](start_span)log(`[search] 第 ${index + 1} 个结果标题为空，跳过`);[span_34](end_span)
       
                return;
            }

            // 提取底部信息
            let remarks = '';
            [span_35](start_span)const bottomDiv = link.find('div[style*="padding-bottom"]');[span_35](end_span)
            if (bottomDiv.length > 0) {
                [span_36](start_span)remarks = bottomDiv.text().trim();[span_36](end_span)
            }
            
            [span_37](start_span)// 提取缩略图[span_37](end_span)
            [span_38](start_span)const thumbImg = link.find('img');[span_38](end_span)
            [span_39](start_span)let thumb = '/img/folder.png';[span_39](end_span)
            if (thumbImg.length > 0) {
                thumb = thumbImg.attr('src') || [span_40](start_span)'/img/folder.png';[span_40](end_span)
            }

            [span_41](start_span)log(`[search] 解析第 ${index + 1} 个结果: ${title}`);[span_41](end_span)
            cards.push({
                vod_id: resourceId,
                vod_name: title,
                vod_pic: getCorrectUrl(thumb),
                vod_remarks: remarks,
                ext: { 
              
                    [span_42](start_span)url: getCorrectUrl(href),[span_42](end_span)
                    resourceId: resourceId
                }
            [span_43](start_span)});[span_43](end_span)
        });

        [span_44](start_span)log(`[search] ✓ 成功提取 ${cards.length} 个结果`);[span_44](end_span)
        
        // 如果结果少于10个，说明可能是最后一页
        if (cards.length < 10) {
            [span_45](start_span)log(`[search] 结果数 < 10，可能是最后一页`);[span_45](end_span)
        }

        [span_46](start_span)return jsonify({ list: cards });[span_46](end_span)
    } catch (e) {
        [span_47](start_span)log(`[search] ❌ 发生异常: ${e.message}`);[span_47](end_span)
        [span_48](start_span)log(`[search] 错误堆栈: ${e.stack}`);[span_48](end_span)
        [span_49](start_span)return jsonify({ list: [] });[span_49](end_span)
    }
}

/**
 * 获取详情和播放链接
 * @param {Object} ext - 扩展参数 {url: 详情页URL, resourceId: 资源ID}
 */
async function getTracks(ext) {
    [span_50](start_span)ext = argsify(ext);[span_50](end_span)
    [span_51](start_span)const resourceId = ext.resourceId || ext.url?.split('/').pop();[span_51](end_span)
    
    if (!resourceId) {
        [span_52](start_span)log(`[getTracks] ❌ 资源ID为空`);[span_52](end_span)
        return jsonify({ list: [] });
    }

    [span_53](start_span)log(`[getTracks] 获取资源详情: ${resourceId}`);[span_53](end_span)
    try {
        // 访问详情页获取密码等信息
        [span_54](start_span)const detailUrl = `${SITE_URL}/s/${resourceId}`;[span_54](end_span)
        [span_55](start_span)log(`[getTracks] 访问详情页: ${detailUrl}`);[span_55](end_span)
        
        const { data } = await $fetch.get(detailUrl, { 
            headers: { 'User-Agent': UA } 
        [span_56](start_span)});[span_56](end_span)
        [span_57](start_span)const $ = cheerio.load(data);[span_57](end_span)

        // 提取资源名称
        const resourceName = $('h3[align="center"]').text().trim() || [span_58](start_span)'未知资源';[span_58](end_span)
        // 提取密码（如果有）
        let password = '';
        [span_59](start_span)const passwordCell = $('van-cell[title="密码"] b').text().trim();[span_59](end_span)
        if (passwordCell) {
            [span_60](start_span)password = passwordCell;[span_60](end_span)
            [span_61](start_span)log(`[getTracks] 发现密码: ${password}`);[span_61](end_span)
        }

        // 现在访问跳转链接获取真实网盘URL
        [span_62](start_span)const cvUrl = `${SITE_URL}/cv/${resourceId}`;[span_62](end_span)
        [span_63](start_span)log(`[getTracks] 访问跳转链接: ${cvUrl}`);[span_63](end_span)

        // 跟踪重定向获取最终URL
        const response = await $fetch.get(cvUrl, {
            headers: { 'User-Agent': UA },
            [span_64](start_span)redirect: 'follow'[span_64](end_span)
        });
        [span_65](start_span)// 获取最终重定向后的URL[span_65](end_span)
        [span_66](start_span)let finalUrl = cvUrl;[span_66](end_span)
        if (response.url) {
            [span_67](start_span)finalUrl = response.url;[span_67](end_span)
        }

        [span_68](start_span)log(`[getTracks] ✓ 获取到最终链接: ${finalUrl}`);[span_68](end_span)
        // 判断网盘类型
        [span_69](start_span)let panName = '天翼云盘';[span_69](end_span)
        if (finalUrl.includes('189.cn')) {
            [span_70](start_span)panName = '天翼云盘';[span_70](end_span)
        } else if (finalUrl.includes('quark')) {
            [span_71](start_span)panName = '夸克网盘';[span_71](end_span)
        } else if (finalUrl.includes('baidu')) {
            [span_72](start_span)panName = '百度网盘';[span_72](end_span)
        } else if (finalUrl.includes('aliyundrive')) {
            [span_73](start_span)panName = '阿里云盘';[span_73](end_span)
        }

        // 构建播放信息
        const trackName = password ?
            [span_74](start_span)`${panName} (密码: ${password})` : panName;[span_74](end_span)

        return jsonify({
            list: [{
                title: resourceName,
                tracks: [{
                    name: trackName,
                    pan: finalUrl,
     
                    [span_75](start_span)ext: { password: password }[span_75](end_span)
                }]
            }]
        [span_76](start_span)});[span_76](end_span)
    } catch (e) {
        [span_77](start_span)log(`[getTracks] ❌ 发生异常: ${e.message}`);[span_77](end_span)
        // 降级处理：返回手动访问链接
        return jsonify({
            list: [{
                title: '获取失败',
                tracks: [{
                    name: '请手动访问',
                    pan: `${SITE_URL}/s/${resourceId}`,
 
                    [span_78](start_span)ext: {}[span_78](end_span)
                }]
            }]
        [span_79](start_span)});[span_79](end_span)
    }
}

// --- 兼容接口 ---
async function init() { 
    [span_80](start_span)return getConfig();[span_80](end_span)
}

async function home() {
    const c = await getConfig();
    [span_81](start_span)const config = JSON.parse(c);[span_81](end_span)
    return jsonify({ 
        [span_82](start_span)class: config.tabs,[span_82](end_span)
        filters: {
            // 搜索过滤器
            sort: [
                [span_83](start_span){ name: '默认排序', value: '0' },[span_83](end_span)
                [span_84](start_span){ name: '时间排序', value: '1' },[span_84](end_span)
           
                [span_85](start_span){ name: '完全匹配', value: '2' }[span_85](end_span)
            ],
            type: [
                [span_86](start_span){ name: '全部类别', value: '-1' },[span_86](end_span)
                [span_87](start_span){ name: '视频', value: '1' },[span_87](end_span)
                [span_88](start_span){ name: '音乐', value: '2' },[span_88](end_span)
  
                [span_89](start_span){ name: '图片', value: '3' },[span_89](end_span)
                [span_90](start_span){ name: '文档', value: '4' },[span_90](end_span)
                [span_91](start_span){ name: '压缩包', value: '5' },[span_91](end_span)
                [span_92](start_span){ name: '其他', value: '6' },[span_92](end_span)
                [span_93](start_span){ name: '文件夹', value: '7' }[span_93](end_span)
            ]
        }
    [span_94](start_span)});[span_94](end_span)
}

async function category(tid, pg) {
    // 无分类功能，返回空
    [span_95](start_span)log('[category] 本插件无分类功能');[span_95](end_span)
    [span_96](start_span)return jsonify({ list: [] });[span_96](end_span)
}

async function detail(id) { 
    [span_97](start_span)log(`[detail] 详情ID: ${id}`);[span_97](end_span)
    [span_98](start_span)return getTracks({ resourceId: id });[span_98](end_span)
}

async function play(flag, id) { 
    [span_99](start_span)log(`[play] 直接播放: ${id}`);[span_99](end_span)
    [span_100](start_span)return jsonify({ url: id });[span_100](end_span)
}
