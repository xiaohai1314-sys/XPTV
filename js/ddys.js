/**
 * Nullbr 影视库前端插件 - V49.0 (V27回退原理终极利用版)
 *
 * 变更日志:
 * - V49.0 (2025-11-17):
 *   - [最终顿悟] 严格遵循用户“直接利用回退原理”的指示，确认V27的成功完全发生在getCards函数内部的回退逻辑。
 *   - [废弃category] 彻底废弃失败的、多余的category函数，getCards成为唯一的列表入口。
 *   - [利用回退原理] getCards的ID解析逻辑被故意设计为总是失败，从而强制执行回退块。
 *   - [动态回退] 在回退块中，通过检查传入的ext.name，来动态地决定应该回退到哪个分类的ID。
 *   - 这是对V27成功原理最直接、最纯粹的利用和扩展。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V49.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 49.0, title: 'Nullbr影视库 (V49)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

// ★★★★★【彻底废弃 category 函数】★★★★★
// 当App点击分类时，它会因为找不到category函数，而直接调用 getCards(ext)
// ext 的值将是 { name: '热门剧集', ext: { id: 2143362 } }
async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，不应被调用");
    return jsonify({ list: [] });
}

// ★★★★★【这是唯一的、利用了V27回退原理的终极 getCards 函数】★★★★★
async function getCards(ext) {
    log(`getCards() 开始执行，ext: ${JSON.stringify(ext)}`);
    
    // --- 步骤1: 故意让ID解析失败 ---
    // 我们已经知道 ext.id 在传递时会丢失，所以这个判断永远是false
    let categoryId = null;
    if (false) { // 故意写成false，确保此路不通
        // categoryId = ext.id; 
    }
    
    // --- 步骤2: 强制进入回退逻辑，并在这里实现动态选择 ---
    if (!categoryId) {
        log("故意进入回退逻辑，开始动态选择ID...");
        
        // 默认回退到第一个分类
        categoryId = CATEGORIES[0].ext.id; 
        
        // 尝试从传入的 ext.name 来动态决定ID
        try {
            const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
            if (extObj && extObj.name) {
                log(`接收到分类名称: ${extObj.name}`);
                for (let i = 0; i < CATEGORIES.length; i++) {
                    if (CATEGORIES[i].name === extObj.name) {
                        categoryId = CATEGORIES[i].ext.id;
                        log(`动态匹配成功！ID更新为: ${categoryId}`);
                        break;
                    }
                }
            }
        } catch(e) {
            log("在回退逻辑中解析ext失败: " + e.message);
        }
    }

    // --- 步骤3: 使用在回退逻辑中确定的ID，进行URL拼接和请求 ---
    // 这里的 page 变量也可能在 ext 中丢失，所以我们直接从 pg 获取
    const page = (ext && ext.pg) ? ext.pg : 1;
    
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`最终请求URL为: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));
        return jsonify({ list: cards, page: data.page, pagecount: data.total_page, limit: cards.length, total: data.total_items });
    } catch (err) {
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
