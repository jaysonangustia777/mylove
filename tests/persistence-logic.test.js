// Logic test of the cloud-persistence block with an in-memory fake Supabase (database + storage). No UI is involved.
const fs=require('fs'),vm=require('vm');
const block=fs.readFileSync('../cloud-block.reference.js','utf8');
function makeCloud(){ // shared "server"
  return {docs:{},files:{},fail:false};
}
function makeDevice(server,uid,seedLocal){
  const ls={}; if(seedLocal) ls.k=JSON.stringify(seedLocal);
  const els={};
  const $=id=>els[id]||(els[id]={style:{},textContent:'',value:''});
  const doc=p=>({
    get:async()=>{ if(server.fail)throw new Error('network down'); const d=server.docs[p]; return d?{exists:true,data:JSON.parse(JSON.stringify(d))}:{exists:false,data:null}; },
    set:async d=>{ if(server.fail)throw new Error('network down'); if(!p.startsWith('prefs/'+uid+':'))throw new Error('RLS blocked'); server.docs[p]=JSON.parse(JSON.stringify(d)); }
  });
  const FC_STORE={
    upload:async(path,blob)=>{ if(server.fail)throw new Error('network down'); if(!path.startsWith(uid+'/'))throw new Error('storage RLS blocked'); server.files[path]=blob; },
    download:async path=>{ if(server.fail)throw new Error('network down'); if(!(path in server.files))throw new Error('missing'); return 'data:image/jpeg;base64,'+Buffer.from(String(path)).toString('base64'); },
    remove:async ps=>{ ps.forEach(p=>delete server.files[p]); }
  };
  const ctx={window:{FC_CLOUD:true},document:{addEventListener(){},createElement:()=>({style:{}}),body:{appendChild(){}},hidden:false,documentElement:{classList:{toggle(){}}}},
    localStorage:{getItem:k=>ls.k??null,setItem:(k,v)=>{ls.k=v},removeItem:()=>{delete ls.k}},
    atob:s=>Buffer.from(s,'base64').toString('binary'),Blob:class{constructor(a,o){this.a=a;this.type=o&&o.type}},Uint8Array,
    setTimeout:(f)=>0,clearTimeout(){},Math,JSON,Date,Object,String,Array,console,
    $,now:()=>Date.now(),KEY:'k',db:{doc},myId:uid,FC_STORE,
    S:ls.k?JSON.parse(ls.k):{me:'You',members:[]},
    lsSave:null,applyTheme(){},applyPal(){},applyStyle(){},applyItems(){},fill(){},render(){},kidsBuild(){},grpUi(){},showTab(){},location:{reload(){ctx.reloaded=true}}};
  ctx.lsSave=function(){ls.k=JSON.stringify(ctx.S);return true};
  vm.createContext(ctx);
  vm.runInContext(block+';this.CL=CL;this.cloudLoad=cloudLoad;this.cloudPush=cloudPush;',ctx);
  ctx._ls=ls;
  return ctx;
}
const PNG='data:image/jpeg;base64,'+Buffer.from('fakejpegbytes').toString('base64');
let pass=0,fail=0; const ok=(n,c)=>{ (c?pass++:fail++); console.log((c?'PASS ':'FAIL ')+n); };
(async()=>{
  const server=makeCloud();
  // Device 1 (phone): first run, user sets theme, text size style, name, photo, adds a family member with a photo
  let d1=makeDevice(server,'userA',null);
  await d1.cloudLoad(); ok('first load with nothing saved becomes ready',d1.CL.ready===true);
  Object.assign(d1.S,{theme:'dark',pal:'Ocean',me:'Jayson',meP:'0813168640',meImg:PNG,ts2:{small:{size:22}},_ts:1000});
  d1.S.members=[{id:'m1',n:'Mom',p:'081',s:'Safe',t:1,img:PNG}];
  await d1.cloudPush();
  ok('settings saved to cloud',server.docs['prefs/userA:settings']&&server.docs['prefs/userA:settings'].theme==='dark'&&server.docs['prefs/userA:settings'].ts2.small.size===22);
  ok('family member saved to cloud',server.docs['prefs/userA:family'].members.length===1&&server.docs['prefs/userA:family'].members[0].n==='Mom');
  ok('photos stored as storage paths, not image data',server.docs['prefs/userA:photos'].me.path==='userA/me.jpg'&&!JSON.stringify(server.docs).includes('data:image'));
  ok('photo files exist in storage',('userA/me.jpg' in server.files)&&('userA/m-m1.jpg' in server.files));
  // Device 2 (new phone or cleared storage): empty local state, same user
  let d2=makeDevice(server,'userA',null);
  await d2.cloudLoad();
  ok('new device restores theme and palette',d2.S.theme==='dark'&&d2.S.pal==='Ocean');
  ok('new device restores text size style',d2.S.ts2&&d2.S.ts2.small.size===22);
  ok('new device restores profile name and phone',d2.S.me==='Jayson'&&d2.S.meP==='0813168640');
  ok('new device restores profile photo',typeof d2.S.meImg==='string'&&d2.S.meImg.indexOf('data:image/')===0);
  ok('new device restores family member and its photo',d2.S.members.length===1&&d2.S.members[0].n==='Mom'&&d2.S.members[0].img.indexOf('data:image/')===0);
  // Defaults must not overwrite saved data: a fresh device finishing load then pushing keeps cloud values
  await d2.cloudPush();
  ok('pushing after load does not wipe saved values',server.docs['prefs/userA:settings'].theme==='dark'&&server.docs['prefs/userA:family'].members.length===1);
  // Another user must not overwrite or read user A
  let d3=makeDevice(server,'userB',null);
  await d3.cloudLoad();
  ok('second user starts with their own empty settings',d3.S.theme===undefined&&d3.S.members.length===0);
  d3.S.theme='light';d3.S._ts=5000; await d3.cloudPush();
  ok('second user saves only to their own rows',server.docs['prefs/userB:settings'].theme==='light'&&server.docs['prefs/userA:settings'].theme==='dark');
  // Same browser, different account: local copy of user A must not leak into user B
  let d4=makeDevice(server,'userB',Object.assign({},d1.S,{_owner:'userA'}));
  await d4.cloudLoad();
  ok('different account on same browser discards the other user\'s local copy',d4.reloaded===true);
  // Network failure on load: do not overwrite cloud with defaults
  server.fail=true;
  let d5=makeDevice(server,'userA',{me:'You',members:[],_ts:0});
  await d5.cloudLoad();
  ok('failed load stays not-ready (cannot overwrite cloud)',d5.CL.ready===false&&d5.CL.failed===true);
  await d5.cloudPush(); server.fail=false;
  ok('nothing is pushed while not ready',server.docs['prefs/userA:settings'].theme==='dark');
  // Save failure shows an error and keeps trying
  let d6=makeDevice(server,'userA',null); await d6.cloudLoad(); server.fail=true; d6.S._ts=9999; d6.S.theme='light';
  await d6.cloudPush(); ok('failed save is reported, cloud copy untouched',server.docs['prefs/userA:settings'].theme==='dark'); server.fail=false;
  await d6.cloudPush(); ok('save succeeds after the connection returns',server.docs['prefs/userA:settings'].theme==='light');
  // Removing a photo removes its stored file
  delete d6.S.meImg; await d6.cloudPush(); ok('removed photo is deleted from storage',!('userA/me.jpg' in server.files));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('HARNESS ERROR',e);process.exit(2)});
