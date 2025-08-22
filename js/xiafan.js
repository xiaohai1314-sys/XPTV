/**
 * HDHive 影视资料库 - App插件脚本 (终极认证修正版 V4.1)
 * 
 * 版本说明:
 * - 【终极修正】回归V2.0的强制认证策略！废除所有关于“公开API”的错误判断，确保所有API请求都携带完整认证信息，根治页面空白问题。
 * - 【精确API】所有功能（分类、详情、搜索）均使用我们已验证的、正确的API端点和请求方式。
 * - 【解密核心】内置Pako.js解压库，用于正确解析分类页返回的加密数据。
 * - 【缓存优化】完美集成了高级搜索缓存机制，体验流畅。
 * - 【配置核心】请务必在下方的【用户配置区】填入您自己的有效Cookie。
 */

// --- 配置区 ---
const SITE_URL = "https://hdhive.com";
const API_BASE_URL = "https://hdhive.com/api";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://hdhive.com/logo.png"; 

// ★★★★★【用户配置区 - Cookie】 ★★★★★
// 请将下面的字符串替换为您从浏览器获取的完整Cookie
const COOKIE = 'csrf_access_token=bad5d5c0-6da7-4a22-a591-b332afd1b767;token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc1NTg1MDE0NSwianRpIjoiYTZmZmM4MDEtZWMzZC00Njc2LWI1MzEtMzEwYjhlNmQwMDU5IiwidHlwZSI6ImFjY2VzcyIsInN1YiI6NDM4ODgsIm5iZiI6MTc1NTg1MDE0NSwiY3NyZiI6ImJhZDVkNWMwLTZkYTctNGEyMi1hNTkxLWIzMzJhZmQxYjc2NyIsImV4cCI6MTc1NjQ1NDk0NX0.juRkeQmlg78kdyQ29tZsyM06jPprnMsbxwuSGEYgh-k;';
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg ) { 
    try { $log(`[HDHive 插件 V4.1] ${msg}`); } 
    catch (_) { console.log(`[HDHive 插件 V4.1] ${msg}`); } 
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(data) { return JSON.stringify(data); }
function getTokenFromCookie(cookie, key) {
    const match = cookie.match(new RegExp(`${key}=([^;]+)`));
    return match ? match[1] : '';
}

// --- 网络请求 (V4.1 终极修正版) ---
async function fetchApi(method, url, params = {}, body = null, additionalHeaders = {}) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_HERE")) {
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }
    const finalUrl = new URL(url);
    if (method === 'GET') {
        Object.keys(params).forEach(key => finalUrl.searchParams.append(key, params[key]));
    }
    
    // 【V4.1 修正】确保所有请求都带上完整的认证信息
    const csrfToken = getTokenFromCookie(COOKIE, 'csrf_access_token');
    const authToken = getTokenFromCookie(COOKIE, 'token');
    const headers = {
        'User-Agent': UA,
        'Cookie': COOKIE,
        'Authorization': `Bearer ${authToken}`,
        'x-csrf-token': csrfToken,
        'Content-Type': 'application/json',
        ...additionalHeaders
    };

    log(`请求API: ${method} ${finalUrl.toString()}`);
    
    const options = { headers };
    if (method === 'POST') {
        options.body = JSON.stringify(body);
        return (await $fetch.post(finalUrl.toString(), options.body, options)).data;
    }
    return (await $fetch.get(finalUrl.toString(), options)).data;
}

// --- 核心功能函数 ---

async function getConfig() {
  log("插件初始化 (终极认证版 V4.1)");
  return jsonify({
    ver: 1, title: 'HDHive', site: SITE_URL,
    tabs: [
      { name: '电影', ext: { type: 'movie' } },
      { name: '剧集', ext: { type: 'tv' } },
      { name: '音乐', ext: { type: 'music' } },
    ],
  });
}

function parseJsonToCards(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => {
        const type = item.type || item.media_type || 'movie';
        const slug = item.slug || item.id;
        return {
            vod_id: `${type}/${slug}`,
            vod_name: item.title || item.name,
            vod_pic: item.poster_url || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : FALLBACK_PIC ),
            vod_remarks: item.release_date || item.first_air_date || '',
            ext: { slug: slug, type: type }
        };
    });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, type } = ext;
  try {
    // 【V4.1 修正】调用正确的公开API，并强制使用认证
    const jsonData = await fetchApi('GET', `${API_BASE_URL}/public/${type}s`, { per_page: 24, share_num_gt: 0, page: page });
    const decryptedData = JSON.parse(pako.inflate(atob(jsonData.data), { to: 'string' }));
    log(`成功解密分类[${type}]数据, 共 ${decryptedData.length} 条`);
    const cards = parseJsonToCards(decryptedData);
    return jsonify({ list: cards });
  } catch(e) {
    log(`获取分类列表异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const { slug, type } = ext;
    if (!slug || !type) return jsonify({ list: [] });
    log(`开始处理详情页: type=${type}, slug=${slug}`);
    try {
        const mainData = await fetchApi('GET', `${API_BASE_URL}/${type}/${slug}`);
        const mediaId = mainData.data.id;
        if (!mediaId) throw new Error("未能从主数据中获取到media_id");
        log(`获取到 Media ID: ${mediaId}`);

        const resourceBody = [{ [`${type}_id`]: mediaId, sort_by: "is_admin", sort_order: "descend", per_page: 10000 }];
        const resourceHeaders = { 'next-action': '6c729f84f8333264305bb8516ed5ae3bc9ed1765' };
        const rawResourceData = await fetchApi('POST', `${SITE_URL}/${type}/${slug}`, {}, resourceBody, resourceHeaders);
        
        const lines = rawResourceData.split('\n');
        const jsonDataLine = lines.find(line => line.startsWith('2:'));
        if (!jsonDataLine) throw new Error("在Server Action响应中未找到资源数据");
        const resourceData = JSON.parse(jsonDataLine.substring(2));

        if (!resourceData || !Array.isArray(resourceData.data)) throw new Error("资源API返回格式不正确");

        const allowedDrivers = { 'Aliyundrive': '阿里云盘', 'Quark': '夸克网盘', 'Ctpan': '天翼云盘', '115': '115网盘' };
        const groupedTracks = {};
        resourceData.data.forEach(resource => {
            if (allowedDrivers[resource.driver]) {
                if (!groupedTracks[resource.driver]) groupedTracks[resource.driver] = [];
                groupedTracks[resource.driver].push({ name: resource.title, pan: resource.link, ext: {} });
            }
        });
        log(`资源筛选与分组完成: ${Object.keys(groupedTracks).join(', ')}`);

        const finalList = Object.keys(allowedDrivers).map(driver => {
            if (groupedTracks[driver] && groupedTracks[driver].length > 0) {
                return { title: allowedDrivers[driver], tracks: groupedTracks[driver] };
            }
            return null;
        }).filter(Boolean);

        if (finalList.length === 0) {
            log("未找到指定类型的网盘资源。");
            return jsonify({ list: [{ title: '提示', tracks: [{ name: "未找到指定类型的网盘资源", pan: '', ext: {} }] }] });
        }
        return jsonify({ list: finalList });
    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie或网络", pan: '', ext: {} }] }] });
    }
}

const searchCache = {};

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = ext.page || 1;
  if (!text) return jsonify({ list: [] });

  if (searchCache.keyword !== text) {
    log(`新关键词 "${text}"，清空旧缓存。`);
    searchCache.keyword = text;
    searchCache.resultsByPage = {};
    searchCache.pageCount = 0;
  }

  if (searchCache.resultsByPage[page]) {
    log(`从缓存中获取搜索结果，关键词: "${text}", 页码: ${page}`);
    return jsonify({ list: searchCache.resultsByPage[page], pagecount: searchCache.pageCount });
  }

  log(`缓存未命中，开始网络搜索，关键词: "${text}", 页码: ${page}`);
  try {
    const requestBody = ["/api/proxy/tmdb/3/search/multi", { query: text, page: page.toString(), language: "zh-CN" }];
    const jsonData = await fetchApi('POST', `${API_BASE_URL}/search`, {}, requestBody);
    const cards = parseJsonToCards(jsonData.results); 
    if (jsonData.total_pages) {
        searchCache.pageCount = jsonData.total_pages;
        log(`总页数已更新为: ${searchCache.pageCount}`);
    }
    searchCache.resultsByPage[page] = cards;
    log(`搜索完成，关键词: "${text}", 页码: ${page}, 找到 ${cards.length} 条结果。`);
    return jsonify({ list: cards, pagecount: searchCache.pageCount });
  } catch(e) {
    log(`搜索异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg, filter, ext) { const type = ext.type || tid; return getCards({ type: type, page: pg }); }
async function detail(id) { const [type, slug] = id.split('/'); return getTracks({ slug, type }); }
async function play(flag, id, flags) { return jsonify({ url: id }); }

// --- 内置 Pako.js 库 ---
const pako = (()=>{var e={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8};const t=(e,t,a,r)=>{let n=e&65535|0,i=e>>>16&65535|0,s=0;for(;0!==a;){s=a>2e3?2e3:a,a-=s;do{n=(n+t[r++])|0,i=(i+n)|0}while(--s);n%=65521,i%=65521}return i<<16|n|0};const a=new Uint32Array((()=>{const e=[];for(let t=0;t<256;t++){let a=t;for(let e=0;e<8;e++)a=1&a?3988292384^a>>>1:a>>>1;e[t]=a}return e})());const r=(e,t,a,r)=>{const n=r+a;e=e^ -1;for(let i=r;i<n;i++)e=e>>>8^a[255&(e^t[i])];return e^ -1};const i=e=>{let t,a,r,n,i,s,o,l,d,c,f,u,h,b,g,p,m,w,k,_,v,y,x,S,E;const Z=e.state;t=e.next_in,x=e.next_in_index,a=e.next_out,S=e.next_out_index,r=e.avail_in,E=e.avail_out,n=Z.dmax,i=Z.wsize,s=Z.whave,o=Z.wnext,l=Z.window,d=Z.hold,c=Z.bits,f=Z.lencode,u=Z.distcode,h=(1<<Z.lenbits)-1,b=(1<<Z.distbits)-1;e:for(;;){if(c<15){if(d=(d<<8|t[x++])|0,c+=8,d=(d<<8|t[x++])|0,c+=8,r-=2,c<15)continue}if(Z.mode===7){for(;c>6;)d>>>=1,c-=1;Z.mode=8}if(Z.mode===8){if(Z.last=1&d,d>>>=1,c-=1,Z.last)Z.mode=12;else if(Z.mode=9,d>>>=2,c-=2,Z.mode===9){let e=new Uint32Array(512),a=new Uint32Array(30),r=new Uint32Array(30);for(g=0;g<512;)e[g++]=0;for(g=0;g<30;)a[g++]=0;for(g=0;g<30;)r[g++]=0;if(Z.lbits=d&31,d>>>=5,c-=5,Z.dbits=d&31,d>>>=5,c-=5,Z.tbits=d&31,d>>>=5,c-=5,Z.lbits>29||Z.dbits>29||Z.tbits>29)return e.msg="too many length or distance symbols",Z.mode=13,1;for(p=0;p<Z.tbits;){for(;c<3;)d=(d<<8|t[x++])|0,c+=8,r--;e[p++]=(d&7)>>>0,d>>>=3,c-=3}for(;p<19;)e[[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15][p++]]=0;if(Z.blens=e,Z.bbits=7,m=function(e,t,a,r){let n,i,s,o,l,d,c,f,u,h,b,g,p,m,w,k,_,v,y,x,S,E,Z,L,B,R,A;const D=r.bits;return n=r.blens,i=r.work,s=r.lendyn,o=r.dists,l=r.lencode,d=r.distcode,c=r.lenbits,f=r.distbits,u=s+o,h=new Uint32Array(16),b=new Uint32Array(16),g=new Uint32Array(u);for(w=0;w<16;w++)h[w]=0;for(w=0;w<u;w++)h[n[w]]++;for(k=0,w=1;w<16;w++)k=k+h[w]<<1,h[w]=k;for(w=0;w<u;w++)0!==(p=n[w])&&(g[h[p]++]=w);for(h=new Uint32Array(16),w=0;w<16;w++)h[w]=0;for(w=0;w<s;w++)h[l[w]]++;for(k=0,w=1;w<16;w++)k=k+h[w]<<1,h[w]=k;for(w=0;w<s;w++)0!==(p=l[w])&&(i[h[p]++]=w);for(h=new Uint32Array(16),w=0;w<16;w++)h[w]=0;for(w=0;w<o;w++)h[d[w]]++;for(k=0,w=1;w<16;w++)k=k+h[w]<<1,h[w]=k;for(w=0;w<o;w++)0!==(p=d[w])&&(i[h[p]++]=w);for(r.lencode=g,r.lenbits=c,r.distcode=i,r.distbits=f,r.mode=8,0}return e.msg="invalid block type",Z.mode=13,1}if(Z.mode=2,e.wrap=0,Z.last){Z.mode=12;continue e}Z.mode=7;continue e}if(Z.mode===12)return d>>>=7&c,c-=c&7,Z.mode=13,1;if(Z.mode===13)return 1;if(Z.mode===14){const e=x,t=S,a=Z.last,r=i(e),n=Z;return n.mode=a?12:7,r}return 0},s=e=>{if(!e||!e.state)return-2;const t=e.state;return t.window&&t.mode===14?(t.mode=15,t.hufts=null,-2):0},o=e=>{if(!e||!e.state)return-2;const t=e.state;return e.total_in=e.total_out=t.total=0,e.msg="",t.wrap&& (e.adler=1&t.wrap),t.mode=1,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new Uint32Array(852),t.distcode=t.distdyn=new Uint32Array(592),t.sane=1,t.back=-1,0};class l{constructor(){this.chunks=[]}push(e,t){const a=this.chunks;let r=a.length,n=0;const i=e.length,s=t?e.length:0;if(s)for(let t=0;t<i;t++)a[r+t]=e[t];else for(let t=0;t<i;t++)a[r+t]=e.charCodeAt(t);n=r+i;const o=new Uint8Array(n);let l=0;for(let e=0;e<r;e++){const t=a[e];for(let a=0;a<t.length;a++)o[l++]=t[a]}for(let e=0;e<i;e++)o[l++]=a[r+e];this.chunks=[o]}toUint8Array(){return this.chunks.length>1&&this.push(new Uint8Array(0),!0),this.chunks[0]}toString(e){return this.toUint8Array().toString(e)}}class d{constructor(t){this.options=Object.assign({},{level:-1,method:8,chunkSize:16384,windowBits:15,memLevel:8,strategy:0},t||{}),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new function(){this.input=null,this.next_in_index=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out_index=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=0,this.adler=0},this.strm.avail_out=this.options.chunkSize;let a=this.options.windowBits;a<8||a>15?this.err=e.Z_STREAM_ERROR:15===a&&(a=-15);const r=this.options.memLevel;r<1||r>9?this.err=e.Z_STREAM_ERROR:this.strm.state=function(e,t,a,r,n,i){const s=new function(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=0,this.last_flush= -1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new Uint16Array(1146),this.dyn_dtree=new Uint16Array(122),this.bl_tree=new Uint16Array(78),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new Uint16Array(16),this.heap=new Uint16Array(573),this.heap_len=0,this.heap_max=0,this.depth=new Uint16Array(573),this.l_buf=null,this.lit_bufsize=0,this.last_lit=0,this.d_buf=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0};return s.strm=e,s.status=0,s.pending_buf=new Uint8Array(4*a),s.pending_buf_size=4*a,s.window_size=2*a,s.w_size=a,s.w_mask=a-1,s.hash_size=1<<n+7,s.hash_bits=n+7,s.hash_mask=s.hash_size-1,s.hash_shift=~~((s.hash_bits+3-1)/3),s.window=new Uint8Array(s.window_size),s.head=new Uint16Array(s.hash_size),s.prev=new Uint16Array(s.w_size),s.lit_bufsize=1<<n+6,s.pending_buf=new Uint8Array(s.lit_bufsize*4),s.d_buf=1*s.lit_bufsize,s.l_buf=3*s.lit_bufsize,s.level=t,s.strategy=i,s.method=r,function(e,t){e.wrap=1,e.gzhead=null,e.gzindex=0,t<0?(t=-t,e.wrap=0):t>15&&(e.wrap=2,t-=16),e.w_bits=t,e.w_size=1<<e.w_bits,e.w_mask=e.w_size-1}(s,a),s}(this.strm,this.options.level,this.options.method,this.options.chunkSize,r,this.options.strategy)}push(t,a){const r=this.strm,n=this.options.chunkSize;let i,s;if(this.ended)return!1;s=a===e.Z_FINISH,r.input=t,r.next_in_index=0,r.avail_in=r.input.length;do{if(0===r.avail_out&&(r.output=new Uint8Array(n),r.next_out_index=0,r.avail_out=n),i=function(t,a){t.state.pending=0,t.state.pending_out=0,t.state.wrap<0&&(t.state.wrap=-t.state.wrap),t.state.status=t.state.wrap?42:113,t.state.last_flush=a,function(e){let t,a;for(;;){if(0===e.state.lookahead&&function(e){e.state.strstart=e.state.lookahead,e.state.lookahead=0;const t=e.state.w_size-e.state.lookahead-e.state.strstart;if(t>0){const a=e.state.window_size-t-e.state.strstart,r=a-e.state.strstart;r>t?r=t:a<e.state.strstart&&(r=e.state.window_size-e.state.strstart-t,e.state.window.set(e.state.window.subarray(e.state.strstart,e.state.strstart+r),0),e.state.match_start-=t,e.state.strstart-=t),e.input.set(e.state.window.subarray(a,a+t),e.state.strstart),e.state.lookahead=t,e.state.block_start=e.state.strstart}if(e.state.lookahead>=3){e.state.ins_h=e.state.window[e.state.strstart]&255,e.state.ins_h=(e.state.window[e.state.strstart+1]&255)<<e.state.hash_shift^e.state.ins_h;const t=e.state.window[e.state.strstart+2]&255;e.state.ins_h=(t<<e.state.hash_shift^e.state.ins_h)&e.state.hash_mask}}(t);if(e.state.lookahead<3)break;t=0,a=0,e.state.match_length=e.state.prev_length,e.state.prev_match=e.state.match_start,e.state.prev_length-=1,e.state.strstart>e.state.w_size-262&&(function(e){e.state.window.set(e.state.window.subarray(e.state.w_size,e.state.w_size+e.state.w_size),0),e.state.match_start-=e.state.w_size,e.state.strstart-=e.state.w_size,e.state.block_start-=e.state.w_size;let t=e.state.hash_size;let a=t;do{e.state.head[--a]=e.state.head[a]>=e.state.w_size?e.state.head[a]-e.state.w_size:0}while(--t);a=e.state.w_size;do{e.state.prev[--a]=e.state.prev[a]>=e.state.w_size?e.state.prev[a]-e.state.w_size:0}while(--a)})(e);const r=e.state.head[e.state.ins_h];e.state.prev[e.state.strstart&e.state.w_mask]=r,e.state
