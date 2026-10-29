/* ---- Cloud persistence (Supabase). Active only when the page is hosted outside Claude (window.FC_CLOUD). ---- */
var CL={on:!!window.FC_CLOUD,ready:false,loading:false,failed:false,timer:null,rt:null,pushed:{},up:{},prev:[]};
function rid(){return Math.random().toString(36).slice(2,10)}
function chip(msg,kind){var c=$("syncChip");
  if(!c){c=document.createElement("div");c.id="syncChip";c.style.cssText="display:none;position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:10px;z-index:120;padding:6px 12px;border-radius:99px;font:600 12px system-ui,sans-serif;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);max-width:80vw";document.body.appendChild(c)}
  c.textContent=msg;c.style.background=kind==="err"?"#e5395b":kind==="ok"?"#16a34a":"#5b5bd6";c.style.display=msg?"block":"none";
  clearTimeout(chip.t);if(kind==="ok")chip.t=setTimeout(function(){c.style.display="none"},2500)}
function hashS(u){var h=0,st=Math.max(1,(u.length/997)|0);for(var i=0;i<u.length;i+=st)h=(h*31+u.charCodeAt(i))|0;return u.length+":"+h}
function dataToBlob(u){var p=u.split(","),mt=(p[0].match(/:(.*?);/)||[])[1]||"image/jpeg",bin=atob(p[1]),a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:mt})}
async function putPhoto(path,u){var h=hashS(u);if(CL.up[path]===h)return {path:path,h:h};await FC_STORE.upload(path,dataToBlob(u));CL.up[path]=h;return {path:path,h:h}}
async function dl(ref){var u=await FC_STORE.download(ref.path);CL.up[ref.path]=ref.h;return u}
async function getP(k){var r=await db.doc("prefs/"+myId+":"+k).get();return r&&r.exists?r.data:null}
function grpSettings(){return {theme:S.theme,pal:S.pal,ts2:S.ts2,ts3:S.ts3,kids:S.kids,title:S.title,sub:S.sub,coverFit:S.coverFit,coverPos:S.coverPos,me:S.me,meP:S.meP,meStatus:S.meStatus,phOv:S.phOv,leftGroup:S.leftGroup}}
async function syncPhotos(){var out={me:null,covers:[],mem:{}},used=[];
  if(S.meImg&&S.meImg.indexOf("data:image/")===0){out.me=await putPhoto(myId+"/me.jpg",S.meImg);used.push(out.me.path)}
  var cv=S.covers||(S.cover?[S.cover]:[]);
  for(var i=0;i<cv.length;i++){if(String(cv[i]).indexOf("data:image/")!==0)continue;var c=await putPhoto(myId+"/cover-"+i+".jpg",cv[i]);out.covers.push(c);used.push(c.path)}
  for(var j=0;j<S.members.length;j++){var m=S.members[j];if(m.img&&String(m.img).indexOf("data:image/")===0){var r=await putPhoto(myId+"/m-"+m.id+".jpg",m.img);out.mem[m.id]=r;used.push(r.path)}}
  out.used=used;return out}
async function cloudPush(){
  if(!CL.on||!CL.ready||!db||!myId)return;
  try{
    chip("Saving…","");
    var fixed=false;S.members.forEach(function(m){if(!m.id){m.id=rid();fixed=true}});if(fixed)lsSave();
    var ts=S._ts||now(),ph=await syncPhotos();
    var docs={settings:grpSettings(),
      family:{members:S.members.map(function(m){return {id:m.id,n:m.n,p:m.p||"",s:m.s||"Safe",t:m.t||0,loc:m.loc||null,img:ph.mem[m.id]||null}})},
      photos:{me:ph.me,covers:ph.covers}};
    for(var k in docs){var j=JSON.stringify(docs[k]);if(CL.pushed[k]===j)continue;docs[k]._ts=ts;await db.doc("prefs/"+myId+":"+k).set(docs[k]);CL.pushed[k]=j}
    var gone=CL.prev.filter(function(p){return ph.used.indexOf(p)<0});
    if(gone.length){try{await FC_STORE.remove(gone)}catch(e){}}
    CL.prev=ph.used;S._cts=ts;lsSave();chip("Saved to cloud ✓","ok");
  }catch(e){chip("Couldn’t save to cloud: "+((e&&e.message)||e)+". Will retry.","err");clearTimeout(CL.timer);CL.timer=setTimeout(cloudPush,10000)}}
function cloudSave(){if(!CL||!CL.on||!CL.ready)return;clearTimeout(CL.timer);CL.timer=setTimeout(cloudPush,1500)}
function applyAll(){document.documentElement.classList.toggle("kids",!!S.kids);applyTheme();applyPal();applyStyle();applyItems();fill();render();kidsBuild();grpUi();showTab(S.tab||"home")}
async function cloudLoad(){
  if(!CL.on||!db||!myId)return;
  if(S._owner&&S._owner!==myId){try{localStorage.removeItem(KEY)}catch(e){}location.reload();return}
  CL.loading=true;chip("Loading your saved settings…","");
  try{
    var rs=await getP("settings"),rf=await getP("family"),rp=await getP("photos");
    var rts=Math.max(rs?rs._ts||0:0,rf?rf._ts||0:0,rp?rp._ts||0:0);
    S._owner=myId;
    CL.prev=[];if(rp){if(rp.me)CL.prev.push(rp.me.path);(rp.covers||[]).forEach(function(c){CL.prev.push(c.path)})}
    if(rf)(rf.members||[]).forEach(function(m){if(m.img)CL.prev.push(m.img.path)});
    if(rts&&rts>=(S._ts||0)){
      CL.photoErr=false;
      if(rs){["theme","pal","ts2","ts3","kids","title","sub","coverFit","coverPos","me","meP","meStatus","phOv","leftGroup"].forEach(function(k){if(rs[k]===undefined||rs[k]===null)delete S[k];else S[k]=rs[k]})}
      if(rf&&rf.members){
        S.members=rf.members.map(function(m){return {id:m.id||rid(),n:m.n,p:m.p||"",s:m.s||"Safe",t:m.t||now(),req:false,loc:m.loc||null,_ref:m.img||null}});
        for(var i=0;i<S.members.length;i++){var m2=S.members[i];if(m2._ref){try{m2.img=await dl(m2._ref)}catch(e){CL.photoErr=true}}delete m2._ref}}
      if(rp){delete S.cover;delete S.meImg;delete S.covers;
        if(rp.me){try{S.meImg=await dl(rp.me)}catch(e){CL.photoErr=true}}
        var cvs=[];for(var j=0;j<(rp.covers||[]).length;j++){try{cvs.push(await dl(rp.covers[j]))}catch(e){CL.photoErr=true}}if(cvs.length)S.covers=cvs}
      S._cts=rts;S._ts=rts;lsSave();applyAll();
      if(CL.photoErr)chip("Loaded, but some photos could not be loaded.","err");else chip("Your saved settings are loaded ✓","ok");
    }else{chip("","")}
    CL.ready=true;CL.loading=false;CL.failed=false;
    var so=$("signOutBtn");if(so)so.style.display="inline-flex";
    if(!rts||rts<(S._ts||0))cloudSave();
  }catch(e){
    CL.loading=false;CL.ready=false;CL.failed=true;
    chip("Couldn’t load your saved settings ("+((e&&e.message)||e)+"). Showing this device’s copy. Changes will sync when the connection works.","err");
    clearTimeout(CL.rt);CL.rt=setTimeout(cloudLoad,15000)}}
document.addEventListener("visibilitychange",function(){if(CL.on&&CL.failed&&!document.hidden)cloudLoad()});
