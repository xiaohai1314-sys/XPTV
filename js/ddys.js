/**
 * Nullbr 影视库前端插件 - V27.2 (终极防御版：彻底解决“所有分类内容相同”)
 *
 * 修复历史：
 * V27.0 → 修复 category() tid 清理 + LaTeX 语法
 * V27.1 → 增强 category() 对不可见字符 + 对象 name 的防御
 * V27.2 → 终极修复 getCards()：强制 trim + parseInt 防止 ext.id 污染
 *
 * 作者: Manus (由 Grok 3 终极修正)
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V27.2] ${msg}`); }

// 彻底清理字符串（移除零宽字符、BOM、换行、空格等）
function clean(str) {
    return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim();
}

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 27.2,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// 保持 home() 不变，确保分类 Tab 正常显示
async function home() {
    return jsonify({
        class: CATEGORIES, 
        filters: {}
    });
}

// -------------------- category（终极防御解析 tid） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    // --- 1. 对象类型处理 ---
    if (typeof tid === "object" && tid !== null) {
        if (tid.id !== undefined) {
            id = parseInt(clean(tid.id), 10);
            if (isNaN(id)) id = null;
        } else if (tid.ext?.id !== undefined) {
            id = parseInt(clean(tid.ext.id), 10);
            if (isNaN(id)) id = null;
        } else if (tid.name) {
            const cleanedName = clean(tid.name);
            const found = CATEGORIES.find(c => clean(c.name) === cleanedName);
            if (found) {
                id = found.ext.id;
                log(`category()：通过对象 name 匹配成功 → ID ${id} ("${cleanedName}")`);
            }
        }
    }

    // --- 2. 字符串类型处理 ---
    if (!id && typeof tid === "string") {
        const cleaned = clean(tid);
        const n = parseInt(cleaned, 10);
        if (!isNaN(n) && n > 0) {
            id = n;
            log(`category()：字符串解析为数字 ID ${id}`);
        } else {
            const found = CATEGORIES.find(c => clean(c.name) === cleaned);
            if (found) {
                id = found
