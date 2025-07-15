/**
 * 网盘资源社 - 前端插件 (XPTV App 极简测试版)
 */

function log(message) {
  try { $log(`[网盘资源社极简测试] ${message}`); } catch (_) { console.log(`[网盘资源社极简测试] ${message}`); }
}

export default {
  async init() {
    log("插件初始化成功！");
    return jsonify({});
  },

  async home() {
    log("获取首页分类数据 (硬编码)");
    const homeData = {
      class: [
        { name: '测试分类1', ext: { id: 'test1' } },
        { name: '测试分类2', ext: { id: 'test2' } },
      ],
      filters: {}
    };
    return jsonify(homeData);
  },

  // 其他函数暂时不实现，只测试 init 和 home
  async category(tid, pg, filter, extend) { return jsonify({ list: [] }); },
  async detail(id) { return jsonify({ list: [] }); },
  async search(wd) { return jsonify({ list: [] }); },
  async play(flag, id) { return jsonify({ parse: 0, url: id }); },
};

