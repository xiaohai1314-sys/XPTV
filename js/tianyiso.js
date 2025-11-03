/**
 * 天逸搜插件 - V1.1
 * [span_0](start_span)网站：https://tianyiso.com (天翼云盘搜索)[span_0](end_span)
 * [span_1](start_span)[span_2](start_span)功能：仅搜索功能，无分类浏览[span_1](end_span)[span_2](end_span)
 */

// --- 配置区 ---
[span_3](start_span)const SITE_URL = "https://tianyiso.com";[span_3](end_span)
// 更新为较新的 UA，提高通过网站检查的可能性
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
[span_4](start_span)const cheerio = createCheerio();[span_4](end_span)
[span_5](start_span)const DEBUG = true;[span_5](end_span)

// 排序选项
const SORT_OPTIONS = {
    [span_6](start_span)DEFAULT: 0,    // 默认排序[span_6](end_span)
    [span_7](start_span)TIME: 1,       // 时间排序[span_7](end_span)
    [span_8](start_span)EXACT: 2       // 完全匹配[span_8](end_span)
};
// 类型选项
const TYPE_OPTIONS = {
    [span_9](start_span)ALL: -1,       // 全部[span_9](end_span)
    [span_10](start_span)VIDEO: 1,      // 视频[span_10](end_span)
    [span_11](start_span)MUSIC: 2,      // 音乐[span_11](end_span)
    [span_12](start_span)IMAGE: 3,      // 图片[span_12](end_span)
    [span_13](start_span)DOC: 4,        // 文档[span_13](end_span)
    [span_14](start_span)ZIP: 5,        // 压缩包[span_14](end_span)
    [span_15](start_span)OTHER: 6,      // 其他[span_15](end_span)
    [span_16](start_span)FOLDER: 7      // 文件夹[span_16](end_span)
};

// --- 辅助函数 ---
function log(msg) { 
    [span_17](start_span)if (DEBUG) console.log(`[天逸搜插件] ${msg}`);[span_17](end_span)
}

function argsify(ext) { 
    return (typeof ext === 'string') ? [span_18](start_span)JSON.parse(ext) : (ext || {});[span_18](end_span)
}

function jsonify(data) { 
    [span_19](start_span)return JSON.stringify(data);[span_19](end_span)
}

function getCorrectUrl(path) {
    if (!path || path.startsWith('http')) return path || [span_20](start_span)'';[span_20](end_span)
    return `${SITE_URL}${path.startsWith('/') ? [span_21](start_span)'' : '/'}${path}`;[span_21](end_span)
}

// --- 插件入口函数 ---

/**
 * 初始化配置
 */
async function getConfig() {
    [span_22](start_span)log("==== 插件初始化 V1.0 ====");[span_22](end_span)
    return jsonify({
        [span_23](start_span)ver: 1.0,[span_23](end_span)
        [span_24](start_span)title: '天逸搜',[span_24](end_span)
        [span_25](start_span)site: SITE_URL,[span_25](end_span)
        [span_26](start_span)cookie: '',[span_26](end_span)
        [span_27](start_span)tabs: [], // 无分类，仅搜索[span_27](end_span)
    });
}

/**
 * 搜索功能
 * [span_28](start_span)@param {Object} ext - 扩展参数 {text: 搜索词, page: 页码, sort: 排序, type: 类型}[span_28](end_span)
 */
async function search(ext) {
    [span_29](start_span)ext = argsify(ext);[span_29](end_span)
    const searchText = ext.text || [span_30](start_span)'';[span_30](end_span)
    [span_31](start_span)const page = parseInt(ext.page || 1, 10);[span_31](end_span)
    [span_32](start_span)const sort = parseInt(ext.sort || SORT_OPTIONS.DEFAULT, 10);[span_32](end_span)
    [span_33](start_span)const type = parseInt(ext.type || TYPE_OPTIONS.ALL, 10);[span_33](end_span)

    [span_34](start_span)log(`[search] 搜索: "${searchText}" | 页码: ${page} | 排序: ${sort} | 类型: ${type}`);[span_34](end_span)
    if (!searchText) {
        [span_35](start_span)log('[search] 搜索词为空');[span_35](end_span)
        [span_36](start_span)return jsonify({ list: [] });[span_36](end_span)
    }

    // 构建搜索URL
    [span_37](start_span)const searchUrl = `${SITE_URL}/search?k=${encodeURIComponent(searchText)}&page=${page}&s=${sort}&t=${type}`;[span_37](end_span)
    [span_38](start_span)log(`[search] 请求URL: ${searchUrl}`);[span_38](end_span)
    try {
        const { data } = await $fetch.get(searchUrl, { 
            headers: { 'User-Agent': UA } 
        [span_39](start_span)});[span_39](end_span)
        [span_40](start_span)log(`[search] 获取到HTML数据，长度: ${data.length}`);[span_40](end_span)
        [span_41](start_span)const $ = cheerio.load(data);[span_41](end_span)
        const cards = [];
        [span_42](start_span)// 从HTML文档分析，搜索结果在 <van-row> 标签中，每个结果包含 <a> 标签[span_42](end_span)
        [span_43](start_span)// 结构: <van-row><a href="/s/xxx"><van-col><van-card>...</van-card></van-col></a></van-row>[span_43](end_span)
        
        [span_44](start_span)$('a[href^="/s/"]').each((index, element) => {[span_44](end_span)
            const link = $(element);
            const href = link.attr('href');
            
            if (!href) return;

         
            [span_45](start_span)// 提取资源ID[span_45](end_span)
            [span_46](start_span)const resourceId = href.replace('/s/', '');[span_46](end_span)
            
            // 提取标题 - 在 template#title 里的 div 中
            let title = '';
            [span_47](start_span)const titleDiv = link.find('div[style*="font-size:medium"]');[span_47](end_span)
            if (titleDiv.length > 0) {
   
                [span_48](start_span)// 获取文本内容，移除 span 标签[span_48](end_span)
                [span_49](start_span)title = titleDiv.text().trim();[span_49](end_span)
            }
            
            if (!title) {
                [span_50](start_span)log(`[search] 第 ${index + 1} 个结果标题为空，跳过`);[span_50](end_span)
       
                [span_51](start_span)return;[span_51](end_span)
            }

            // 提取底部信息
            let remarks = '';
            [span_52](start_span)const bottomDiv = link.find('div[style*="padding-bottom"]');[span_52](end_span)
            if (bottomDiv.length > 0) {
                [span_53](start_span)remarks = bottomDiv.text().trim();[span_53](end_span)
            }
            
            // 提取缩略图
            [span_54](start_span)const thumbImg = link.find('img');[span_54](end_span)
            [span_55](start_span)let thumb = '/img/folder.png';[span_55](end_span)
            if (thumbImg.length > 0) {
                thumb = thumbImg.attr('src') || [span_56](start_span)'/img/folder.png';[span_56](end_span)
            }

            [span_57](start_span)log(`[search] 解析第 ${index + 1} 个结果: ${title}`);[span_57](end_span)
            cards.push({
                [span_58](start_span)vod_id: resourceId,[span_58](end_span)
                [span_59](start_span)vod_name: title,[span_59](end_span)
                [span_60](start_span)vod_pic: getCorrectUrl(thumb),[span_60](end_span)
                [span_61](start_span)vod_remarks: remarks,[span_61](end_span)
                ext: { 
              
                    [span_62](start_span)url: getCorrectUrl(href),[span_62](end_span)
                    [span_63](start_span)resourceId: resourceId[span_63](end_span)
                }
            [span_64](start_span)});[span_64](end_span)
        });

        [span_65](start_span)log(`[search] ✓ 成功提取 ${cards.length} 个结果`);[span_65](end_span)
        
        // 如果结果少于10个，说明可能是最后一页
        if (cards.length < 10) {
            [span_66](start_span)log(`[search] 结果数 < 10，可能是最后一页`);[span_66](end_span)
        }

        [span_67](start_span)return jsonify({ list: cards });[span_67](end_span)
    } catch (e) {
        [span_68](start_span)log(`[search] ❌ 发生异常: ${e.message}`);[span_68](end_span)
        [span_69](start_span)log(`[search] 错误堆栈: ${e.stack}`);[span_69](end_span)
        [span_70](start_span)return jsonify({ list: [] });[span_70](end_span)
    }
}

/**
 * 获取详情和播放链接
 * [span_71](start_span)@param {Object} ext - 扩展参数 {url: 详情页URL, resourceId: 资源ID}[span_71](end_span)
 */
async function getTracks(ext) {
    [span_72](start_span)ext = argsify(ext);[span_72](end_span)
    [span_73](start_span)const resourceId = ext.resourceId || ext.url?.split('/').pop();[span_73](end_span)
    
    if (!resourceId) {
        [span_74](start_span)log(`[getTracks] ❌ 资源ID为空`);[span_74](end_span)
        [span_75](start_span)return jsonify({ list: [] });[span_75](end_span)
    }

    [span_76](start_span)log(`[getTracks] 获取资源详情: ${resourceId}`);[span_76](end_span)
    try {
        // 访问详情页获取密码等信息
        [span_77](start_span)const detailUrl = `${SITE_URL}/s/${resourceId}`;[span_77](end_span)
        [span_78](start_span)log(`[getTracks] 访问详情页: ${detailUrl}`);[span_78](end_span)
        
        const { data } = await $fetch.get(detailUrl, { 
            headers: { 'User-Agent': UA } 
        [span_79](start_span)});[span_79](end_span)
        [span_80](start_span)const $ = cheerio.load(data);[span_80](end_span)

        // 提取资源名称
        const resourceName = $('h3[align="center"]').text().trim() || [span_81](start_span)'未知资源';[span_81](end_span)
        // 提取密码（如果有）
        let password = '';
        [span_82](start_span)const passwordCell = $('van-cell[title="密码"] b').text().trim();[span_82](end_span)
        if (passwordCell) {
            [span_83](start_span)password = passwordCell;[span_83](end_span)
            [span_84](start_span)log(`[getTracks] 发现密码: ${password}`);[span_84](end_span)
        }

        // 现在访问跳转链接获取真实网盘URL
        [span_85](start_span)const cvUrl = `${SITE_URL}/cv/${resourceId}`;[span_85](end_span)
        [span_86](start_span)log(`[getTracks] 访问跳转链接: ${cvUrl}`);[span_86](end_span)

        // 跟踪重定向获取最终URL
        const response = await $fetch.get(cvUrl, {
            [span_87](start_span)headers: { 'User-Agent': UA },[span_87](end_span)
            [span_88](start_span)redirect: 'follow'[span_88](end_span)
        });
        // 获取最终重定向后的URL
        [span_89](start_span)let finalUrl = cvUrl;[span_89](end_span)
        if (response.url) {
            [span_90](start_span)finalUrl = response.url;[span_90](end_span)
        }

        [span_91](start_span)log(`[getTracks] ✓ 获取到最终链接: ${finalUrl}`);[span_91](end_span)
        // 判断网盘类型
        [span_92](start_span)let panName = '天翼云盘';[span_92](end_span)
        if (finalUrl.includes('189.cn')) {
            [span_93](start_span)panName = '天翼云盘';[span_93](end_span)
        } else if (finalUrl.includes('quark')) {
            [span_94](start_span)panName = '夸克网盘';[span_94](end_span)
        } else if (finalUrl.includes('baidu')) {
            [span_95](start_span)panName = '百度网盘';[span_95](end_span)
        } else if (finalUrl.includes('aliyundrive')) {
            [span_96](start_span)panName = '阿里云盘';[span_96](end_span)
        }

        // 构建播放信息
        const trackName = password ?
            [span_97](start_span)`${panName} (密码: ${password})` : panName;[span_97](end_span)

        return jsonify({
            list: [{
                [span_98](start_span)title: resourceName,[span_98](end_span)
                tracks: [{
                    [span_99](start_span)name: trackName,[span_99](end_span)
                    [span_100](start_span)pan: finalUrl,[span_100](end_span)
     
                    [span_101](start_span)ext: { password: password }[span_101](end_span)
                }]
            }]
        });
    } catch (e) {
        [span_102](start_span)log(`[getTracks] ❌ 发生异常: ${e.message}`);[span_102](end_span)
        // 降级处理：返回手动访问链接
        return jsonify({
            list: [{
                [span_103](start_span)title: '获取失败',[span_103](end_span)
                tracks: [{
                    [span_104](start_span)name: '请手动访问',[span_104](end_span)
                    [span_105](start_span)pan: `${SITE_URL}/s/${resourceId}`,[span_105](end_span)
 
                    [span_106](start_span)ext: {}[span_106](end_span)
                }]
            }]
        [span_107](start_span)});[span_107](end_span)
    }
}

// --- 兼容接口 ---
async function init() { 
    [span_108](start_span)return getConfig();[span_108](end_span)
}

async function home() {
    [span_109](start_span)const c = await getConfig();[span_109](end_span)
    [span_110](start_span)const config = JSON.parse(c);[span_110](end_span)
    return jsonify({ 
        [span_111](start_span)class: config.tabs,[span_111](end_span)
        filters: {
            // 搜索过滤器
            sort: [
                [span_112](start_span){ name: '默认排序', value: '0' },[span_112](end_span)
                [span_113](start_span){ name: '时间排序', value: '1' },[span_113](end_span)
           
                [span_114](start_span){ name: '完全匹配', value: '2' }[span_114](end_span)
            ],
            type: [
                [span_115](start_span){ name: '全部类别', value: '-1' },[span_115](end_span)
                [span_116](start_span){ name: '视频', value: '1' },[span_116](end_span)
                [span_117](start_span){ name: '音乐', value: '2' },[span_117](end_span)
  
                [span_118](start_span){ name: '图片', value: '3' },[span_118](end_span)
                [span_119](start_span){ name: '文档', value: '4' },[span_119](end_span)
                [span_120](start_span){ name: '压缩包', value: '5' },[span_120](end_span)
                [span_121](start_span){ name: '其他', value: '6' },[span_121](end_span)
                [span_122](start_span){ name: '文件夹', value: '7' }[span_122](end_span)
            ]
        }
    [span_123](start_span)});[span_123](end_span)
}

async function category(tid, pg) {
    // 无分类功能，返回空
    [span_124](start_span)log('[category] 本插件无分类功能');[span_124](end_span)
    [span_125](start_span)return jsonify({ list: [] });[span_125](end_span)
}

async function detail(id) { 
    [span_126](start_span)log(`[detail] 详情ID: ${id}`);[span_126](end_span)
    [span_127](start_span)return getTracks({ resourceId: id });[span_127](end_span)
}

async function play(flag, id) { 
    [span_128](start_span)log(`[play] 直接播放: ${id}`);[span_128](end_span)
    return jsonify({ url: id }); 
}
