/**
 * =================================================================
 * 诊断脚本 V2 - 专门用于捕获搜索结果页的HTML源码
 * 版本: 100 (诊断版)
 *
 * 使用方法:
 * 1. 使用此脚本替换现有脚本。
 * 2. 在App中执行一次搜索。
 * 3. 脚本会返回一个特殊结果，请将其中的“简介”或“备注”内容完整复制并发给我。
 * =================================================================
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// 我们只保留 search 函数用于诊断，其他函数都返回空，避免干扰。
const appConfig = {
  ver: 100,
  title: '雷鲸 (诊断模式)',
  site: 'https://www.leijing.xyz',
  tabs: [{ name: '诊断', ext: { id: '' } }],
};

async function getConfig( ) { return jsonify(appConfig); }
async function getCards(ext) { return jsonify({ list: [] }); }
async function getTracks(ext) { return jsonify({ list: [] }); }
async function getPlayinfo(ext) { return jsonify({ 'urls': [] }); }

/**
 * 核心诊断函数
 * 它会捕获搜索结果页的HTML并将其作为结果返回。
 */
async function search(ext) {
  ext = argsify(ext);
  let text = encodeURIComponent(ext.text);
  let page = ext.page || 1;
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`;

  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });

    // 创建一个包含完整HTML的诊断卡片
    const diagnosticCard = {
      vod_id: 'diagnostic_data_1',
      vod_name: `诊断结果：请复制简介/备注`,
      vod_pic: '',
      // 将HTML源码放入备注/简介字段，这是我们唯一需要的数据
      vod_remarks: `[HTML源码开始] ${data} [HTML源码结束]`,
      ext: { url: '' },
    };

    return jsonify({ list: [diagnosticCard] });

  } catch (e) {
    // 如果请求失败，返回错误信息
    const errorCard = {
      vod_id: 'diagnostic_error_1',
      vod_name: `诊断时发生网络错误`,
      vod_pic: '',
      vod_remarks: `错误详情: ${e.toString()}`,
      ext: { url: '' },
    };
    return jsonify({ list: [errorCard] });
  }
}
