/**
 * Nullbr 影视库 - xptv 专用完美版（2025-11-17）
 * 专治 xptv 转圈不触发 detail 的顽疾
 */

const API_BASE_URL = 'http://192.168.1.7:3003';  // 改成你自己的后端IP
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data){return JSON.stringify(data)}
function log(msg){console.log("[Nullbr-xptv] "+msg)}

const CATEGORIES=[{name:"热门电影",ext:{id:"hot_movie"}},{name:"热门剧集",ext:{id:"hot_series"}},{name:"高分电影",ext:{id:"top_movie"}},{name:"高分剧集",ext:{id:"top_series"}}];

let END_LOCK={};

async function init(ext){END_LOCK={};return jsonify({})}
async function getConfig(){return jsonify({ver:60,title:"Nullbr影视库",site:API_BASE_URL,tabs:CATEGORIES})}
async function home(){return jsonify({class:CATEGORIES,filters:{}})}

// 分类 & 搜索（保持不变）
async function getCards(ext){
    let {id,page}=JSON.parse(ext.ext||ext);
    page=page||1;id=id||"hot_movie";
    let lockKey="cat_"+id;
    if(END_LOCK[lockKey]&&page>1)return jsonify({list:[],page,pagecount:page});
    if(page==1)delete END_LOCK[lockKey];
    let data=await request(API_BASE_URL+"/api/list?id="+id+"&page="+page);
    let cards=data.items.map(i=>({
        vod_id:i.media_type+"_"+i.tmdbid,
        vod_name:i.title,
        vod_pic:TMDB_IMAGE_BASE_URL+i.poster,
        vod_remarks:i.release_date?i.release_date.substr(0,4):""
    }));
    if(data.items.length<30)END_LOCK[lockKey]=true;
    return jsonify({list:cards,page:data.page,pagecount:END_LOCK[lockKey]?data.page:data.page+1,total:data.total_items});
}

async function search(ext){
    let {text:kw,page}=JSON.parse(ext.ext||ext);
    if(!kw)return jsonify({list:[]});
    page=page||1;
    let lockKey="s_"+kw;
    if(END_LOCK[lockKey]&&page>1)return jsonify({list:[],page,pagecount:page});
    if(page==1)delete END_LOCK[lockKey];
    let data=await request(API_BASE_URL+"/api/search?keyword="+encodeURIComponent(kw)+"&page="+page);
    let cards=data.items.map(i=>({
        vod_id:i.media_type+"_"+i.tmdbid,
        vod_name:i.title,
        vod_pic:TMDB_IMAGE_BASE_URL+i.poster,
        vod_remarks:i.release_date?i.release_date.substr(0,4):""
    }));
    if(data.items.length<30)END_LOCK[lockKey]=true;
    return jsonify({list:cards,page:data.page,pagecount:END_LOCK[lockKey]?data.page:data.page+1,total:data.total_results});
}

// ★★★★★ xptv 专用 detail（关键修复）★★★★★
async function detail(id){
    log("detail触发，id="+id);
    if(!id||!id.includes("_"))return jsonify({list:[]});
    let [type,tmdbid]=id.split("_");
    let url=API_BASE_URL+"/api/resource?type="+type+"&tmdbid="+tmdbid;
    log("请求资源："+url);
    let res=await request(url);                     // xptv 只能用 request
    if(typeof res=="string")res=JSON.parse(res);    // 强制转对象
    if(!res["115"]||!Array.isArray(res["115"]))return jsonify({list:[]});
    
    let list=res["115"].map(i=>({
        name:i.title+" ["+i.size+"]",
        url:i.share_link
    }));
    
    return jsonify({list:[{
        vod_name:"115网盘资源",
        vod_play_from:"115",
        vod_play_url:list.map(l=>l.name+"$"+l.url).join("#")
    }]});
}

async function play(flag,id,flags){
    return jsonify({parse:0,url:id});
}

// ★★★★★ xptv 专用 request（必须用这个，不能用 $fetch）★★★★★
async function request(url){
    try{
        let r=await req(url,{timeout:15000});
        let d=r.content;
        if(typeof d=="string")d=JSON.parse(d);
        return d;
    }catch(e){
        log("request错误："+e.message);
        return {};
    }
}
