/**
 * Nullbr V60.0 - xptv 最终救命版（2025-11-18）
 * 保证：分类标签在、列表有、点进去秒出115
 */

const API_BASE_URL = 'http://192.168.1.7:3003';   // ← 改成你的后端IP
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data){return JSON.stringify(data)}
function log(a){console.log("[Nullbr] "+a)}

const CATEGORIES=[
    {name:"热门电影",ext:{id:"hot_movie"}},
    {name:"热门剧集",ext:{id:"hot_series"}},
    {name:"高分电影",ext:{id:"top_movie"}},
    {name:"高分剧集",ext:{id:"top_series"}}
];

let END_LOCK={};

async function init(ext){END_LOCK={};return jsonify({})}
async function getConfig(){return jsonify({ver:60,title:"Nullbr影视库",site:API_BASE_URL,tabs:CATEGORIES})}
async function home(){return jsonify({class:CATEGORIES,filters:{}})}

// 关键：xptv 全部统一用 req()，不再碰 $fetch
async function getCards(ext){
    let {id,page}=typeof ext=="string"?JSON.parse(ext).ext||{}:ext.ext||{};
    page=page||1; id=id||"hot_movie";
    if(END_LOCK["cat_"+id] && page>1) return jsonify({list:[],page,pagecount:page});
    if(page==1) delete END_LOCK["cat_"+id];

    let data=await req(API_BASE_URL+"/api/list?id="+id+"&page="+page,{timeout:20000});
    data=typeof data.content=="string"?JSON.parse(data.content):data.content||data;

    let list=data.items.map(i=>({
        vod_id:i.media_type+"_"+i.tmdbid,
        vod_name:i.title,
        vod_pic:TMDB_IMAGE_BASE_URL+i.poster,
        vod_remarks:i.release_date?.substr(0,4)||""
    }));

    if(data.items.length<30) END_LOCK["cat_"+id]=true;

    return jsonify({
        list:list,
        page:data.page,
        pagecount:END_LOCK["cat_"+id]?data.page:data.page+1,
        total:data.total_items
    });
}

async function search(ext){
    let {text:kw,page}=typeof ext=="string"?JSON.parse(ext).ext||{}:ext.ext||{};
    if(!kw) return jsonify({list:[]});
    page=page||1;
    if(END_LOCK["s_"+kw] && page>1) return jsonify({list:[],page,pagecount:page});
    if(page==1) delete END_LOCK["s_"+kw];

    let data=await req(API_BASE_URL+"/api/search?keyword="+encodeURIComponent(kw)+"&page="+page,{timeout:20000});
    data=typeof data.content=="string"?JSON.parse(data.content):data.content||data;

    let list=data.items.map(i=>({
        vod_id:i.mediaType||i.media_type+"_"+i.tmdbid,
        vod_name:i.title,
        vod_pic:TMDB_IMAGE_BASE_URL+i.poster,
        vod_remarks:i.release_date?.substr(0,4)||""
    }));

    if(data.items.length<30) END_LOCK["s_"+kw]=true;

    return jsonify({
        list:list,
        page:data.page,
        pagecount:END_LOCK["s_"+kw]?data.page:data.page+1,
        total:data.total_results||data.total
    });
}

async function detail(id){
    if(!id||!id.includes("_")) return jsonify({list:[]});
    let [type,tmdbid]=id.split("_");
    let url=API_BASE_URL+"/api/resource?type="+type+"&tmdbid="+tmdbid;
    let r=await req(url,{timeout:25000});
    let data=typeof r.content=="string"?JSON.parse(r.content):r.content||r;

    if(!data["115"]||!Array.isArray(data["115"])) return jsonify({list:[]});

    let playList=data["115"].map(i=>i.title+" ["+i.size+"]$"+i.share_link).join("#");

    return jsonify({list:[{
        vod_name:"115网盘资源",
        vod_play_from:"115",
        vod_play_url:playList
    }]});
}

async function play(flag,id,flags){
    return jsonify({parse:0,url:id});
}
