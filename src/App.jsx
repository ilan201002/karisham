import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xhouuigwhjwsmttdpudl.supabase.co";
const SUPABASE_KEY = "sb_publishable_jYGyXWsmisYcPjjVdWrOZw_ik7c3bRr";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE = 580;
const CR = 0.25;
const DAY_HEB = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
const MONTH_HEB = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

const ds = (d) => { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dy=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${dy}`; };
const TODAY = ds(new Date());
const fmt = (n) => `₪${Math.abs(Math.round(n)).toLocaleString("he-IL")}`;
const isTue = (d) => new Date(d+"T12:00:00").getDay()===2;
const dateObj = (d) => new Date(d+"T12:00:00");
const shift = (d,days) => { const o=dateObj(d); o.setDate(o.getDate()+days); return ds(o); };

function getWeekOf(dateStr) {
  const d=dateObj(dateStr), sun=new Date(d);
  sun.setDate(d.getDate()-d.getDay());
  return Array.from({length:7},(_,i)=>{ const nd=new Date(sun); nd.setDate(sun.getDate()+i); return ds(nd); });
}

function getMonthGrid(year,month) {
  const first=new Date(year,month,1), last=new Date(year,month+1,0), cells=[];
  for(let i=0;i<first.getDay();i++) cells.push(null);
  for(let d=1;d<=last.getDate();d++) cells.push(ds(new Date(year,month,d)));
  return cells;
}

const ST_ON = { pending:{l:"ממתין",i:"⏳",c:"#B45309"}, done:{l:"בוצע",i:"✅",c:"#0D6F4F"}, paid:{l:"שולם",i:"💰",c:"#1B4FD8"} };
const ST_REF = { pending:{l:"למנהל טלפון",i:"📞",c:"#B45309"}, confirmed:{l:"אושר",i:"✅",c:"#0D6F4F"}, paid:{l:"שולם",i:"💰",c:"#1B4FD8"} };

const C={
  bg:"#F4F6F9", white:"#FFFFFF", navy:"#0A1F44", blue:"#1B4FD8",
  border:"#E2E8F0", muted:"#8896A4", sub:"#64748B",
  green:"#0D6F4F", greenBg:"#ECFDF5", greenBdr:"#A7F3D0",
  amber:"#B45309", amberBg:"#FFFBEB", amberBdr:"#FDE68A",
  red:"#B91C1C", purple:"#6D28D9", purpleBg:"#FAF5FF", purpleBdr:"#DDD6FE",
  sh:"0 1px 3px rgba(10,31,68,0.08)", shMd:"0 4px 12px rgba(10,31,68,0.12)",
};

const card=(ex={})=>({background:C.white,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12,boxShadow:C.sh,...ex});
const INP={background:C.white,border:`1.5px solid ${C.border}`,borderRadius:10,color:C.navy,fontSize:15,padding:"12px 14px",width:"100%",boxSizing:"border-box",fontFamily:"inherit"};
const LBL={fontSize:11,color:C.muted,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:8,display:"block"};
const BTNP={background:C.blue,color:"#fff",border:"none",borderRadius:12,padding:"14px 20px",fontSize:15,fontWeight:700,cursor:"pointer",width:"100%"};
const BTNS={background:C.white,color:C.sub,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"14px 20px",fontSize:15,fontWeight:600,cursor:"pointer"};

function AuthScreen() {
  const [isLogin,setIsLogin]=useState(true);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [msg,setMsg]=useState("");

  const handle=async()=>{
    if(!email||!password)return;
    setLoading(true); setError(""); setMsg("");
    if(isLogin){
      const{error}=await supabase.auth.signInWithPassword({email,password});
      if(error)setError(error.message);
    } else {
      const{error}=await supabase.auth.signUp({email,password});
      if(error)setError(error.message);
      else setMsg("נרשמת! בדוק את המייל לאישור.");
    }
    setLoading(false);
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"-apple-system,'Heebo',sans-serif",direction:"rtl"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,marginBottom:8}}>🔧</div>
          <div style={{fontSize:28,fontWeight:900,color:C.navy}}>כרישם</div>
          <div style={{fontSize:14,color:C.muted,marginTop:4}}>ניהול שטח מקצועי</div>
        </div>
        <div style={card()}>
          <div style={{display:"flex",marginBottom:20,background:"#F1F5F9",borderRadius:10,padding:4}}>
            <button onClick={()=>setIsLogin(true)} style={{flex:1,border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:14,cursor:"pointer",background:isLogin?C.white:"transparent",color:isLogin?C.navy:C.muted,transition:"all 0.2s"}}>התחברות</button>
            <button onClick={()=>setIsLogin(false)} style={{flex:1,border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:14,cursor:"pointer",background:!isLogin?C.white:"transparent",color:!isLogin?C.navy:C.muted,transition:"all 0.2s"}}>הרשמה</button>
          </div>
          <div style={{marginBottom:16}}>
            <label style={LBL}>אימייל</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={INP} placeholder="your@email.com" dir="ltr"/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={LBL}>סיסמא</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={INP} placeholder="••••••••" dir="ltr"/>
          </div>
          {error&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:16}}>{error}</div>}
          {msg&&<div style={{background:C.greenBg,border:`1px solid ${C.greenBdr}`,borderRadius:8,padding:"10px 14px",color:C.green,fontSize:13,marginBottom:16}}>{msg}</div>}
          <button onClick={handle} disabled={loading} style={{...BTNP,opacity:loading?0.7:1}}>
            {loading?"טוען...":isLogin?"התחבר":"הירשם"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HR({label,val,hi}){return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}><span style={{fontSize:13,color:hi?C.purple:C.muted}}>{label}</span><span style={{fontSize:14,fontWeight:700,color:hi?C.purple:C.navy}}>{val}</span></div>;}
function TRow({label,val,color,note}){return <div style={{marginBottom:12}}><div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:2}}>{label}{note&&<span style={{marginRight:6,color:C.muted,fontWeight:400}}>{note}</span>}</div><div style={{fontSize:22,fontWeight:800,color:color||C.navy}}>{val}</div></div>;}
function DRow({label,val,color}){return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.muted}}>{label}</span><span style={{fontSize:14,fontWeight:700,color:color||C.navy}}>{val}</span></div>;}
function MStat({label,val,color}){return <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.muted,marginBottom:2}}>{label}</div><div style={{fontSize:13,fontWeight:700,color:color||C.navy}}>{val}</div></div>;}

function URow({u,onAdvanceOnsite,onStartConfirm,onAdvancePaid,onDelete,confirmId,confirmAmt,setConfirmAmt,onSubmitCnf,onCancelCnf,showDate}){
  const iso=u.type==="onsite";
  const st=(iso?ST_ON:ST_REF)[u.status]||(iso?ST_ON:ST_REF)["pending"];
  const isCnf=confirmId===u.id;
  const tap=()=>{
    if(iso){onAdvanceOnsite(u.id);return;}
    if(u.status==="pending"){onStartConfirm(u.id);return;}
    if(u.status==="confirmed"){onAdvancePaid(u.id);return;}
  };
  const fmt2=(n)=>`₪${Math.abs(Math.round(n)).toLocaleString("he-IL")}`;
  return(
    <div style={{background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={tap} style={{background:`${st.c}15`,border:`1.5px solid ${st.c}33`,color:st.c,borderRadius:10,width:40,height:40,fontSize:18,cursor:"pointer",flexShrink:0}}>{st.i}</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:C.navy}}>{u.name||u.address||u.phone||"ללא שם"}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:1}}>{iso?"במקום":"הפניה"}{showDate&&` · ${dateObj(u.date).toLocaleDateString("he-IL")}`}</div>
          <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center",flexWrap:"wrap"}}>
            {u.amount>0&&<span style={{fontSize:13,color:C.sub,fontWeight:500}}>{fmt2(u.amount)}</span>}
            {u.commission>0&&<span style={{fontSize:13,color:C.green,fontWeight:700}}>עמלה: {fmt2(u.commission)}</span>}
            <span style={{fontSize:11,color:st.c,fontWeight:600}}>{st.l}</span>
          </div>
        </div>
        <button onClick={()=>onDelete(u.id)} style={{background:"none",border:"none",color:"#CBD5E1",fontSize:18,cursor:"pointer",padding:4}}>🗑</button>
      </div>
      {isCnf&&(
        <div style={{marginTop:12,background:C.greenBg,border:`1px solid ${C.greenBdr}`,borderRadius:10,padding:12}}>
          <div style={{fontSize:13,color:C.green,marginBottom:10,fontWeight:700}}>סכום העסקה הסופי</div>
          <div style={{display:"flex",gap:8}}>
            <input type="number" inputMode="numeric" placeholder="₪ סכום" value={confirmAmt} onChange={e=>setConfirmAmt(e.target.value)} style={{...INP,flex:1}}/>
            <button onClick={onSubmitCnf} style={{background:C.green,color:"#fff",border:"none",borderRadius:10,padding:"0 16px",fontWeight:700,cursor:"pointer"}}>אישור</button>
            <button onClick={onCancelCnf} style={{background:"#F1F5F9",color:C.muted,border:"none",borderRadius:10,padding:"0 12px",cursor:"pointer"}}>ביטול</button>
          </div>
          {confirmAmt&&parseFloat(confirmAmt)>0&&<div style={{fontSize:13,color:C.green,marginTop:8}}>עמלה: {fmt2(parseFloat(confirmAmt)*CR)}</div>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [session,setSession]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [data,setData]=useState({workDays:{},upsells:[]});
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("field");
  const [selDate,setSelDate]=useState(TODAY);
  const [calYear,setCalYear]=useState(new Date().getFullYear());
  const [calMonth,setCalMonth]=useState(new Date().getMonth());
  const [tipIn,setTipIn]=useState("");
  const [cashIn,setCashIn]=useState("");
  const [bonusIn,setBonusIn]=useState("");
  const [editMode,setEditMode]=useState(null);
  const [editVal,setEditVal]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({name:"",address:"",phone:"",amount:"",type:"onsite"});
  const [toast,setToast]=useState("");
  const [confirmId,setConfirmId]=useState(null);
  const [confirmAmt,setConfirmAmt]=useState("");
  const [modalDay,setModalDay]=useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthLoading(false);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>setSession(session));
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session)return;
    const load=async()=>{
      setLoading(true);
      const[{data:wdRows},{data:upRows}]=await Promise.all([
        supabase.from("work_days").select("*").eq("user_id",session.user.id),
        supabase.from("upsells").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false})
      ]);
      const workDays={};
      (wdRows||[]).forEach(r=>{workDays[r.date]={isActive:r.is_active,tips:r.tips,cashFromClients:r.cash_from_clients,bonus:r.bonus};});
      const upsells=(upRows||[]).map(r=>({id:r.id,date:r.date,name:r.name,type:r.type,status:r.status,address:r.address,phone:r.phone,amount:r.amount,commission:r.commission}));
      setData({workDays,upsells});
      setLoading(false);
    };
    load();
  },[session]);

  const flash=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),2000);};
  const goTo=useCallback((d)=>{setSelDate(d);setShowForm(false);setEditMode(null);setTipIn("");setCashIn("");setBonusIn("");},[]);

  const upsWD=async(date,fields)=>{
    const merged={...(data.workDays[date]||{isActive:false,tips:0,cashFromClients:0,bonus:0}),...fields};
    await supabase.from("work_days").upsert({user_id:session.user.id,date,is_active:merged.isActive||false,tips:merged.tips||0,cash_from_clients:merged.cashFromClients||0,bonus:merged.bonus||0},{onConflict:"user_id,date"});
    setData(d=>({...d,workDays:{...d.workDays,[date]:merged}}));
  };

  const selDay=data.workDays[selDate]||{isActive:false,tips:0,cashFromClients:0,bonus:0};
  const selWk=getWeekOf(selDate);
  const selDObj=dateObj(selDate);
  const selMDays=getMonthGrid(selDObj.getFullYear(),selDObj.getMonth()).filter(Boolean);

  const wkActive=selWk.filter(d=>data.workDays[d]?.isActive).length;
  const wkTips=selWk.reduce((s,d)=>s+(data.workDays[d]?.tips||0),0);
  const wkBonus=selWk.reduce((s,d)=>s+(data.workDays[d]?.bonus||0),0);
  const wkComm=data.upsells.filter(u=>selWk.includes(u.date)&&u.status==="paid").reduce((s,u)=>s+(u.commission||0),0);
  const wkTotal=wkActive*BASE+wkTips+wkBonus+wkComm;
  const wkCash=selWk.reduce((s,d)=>s+(data.workDays[d]?.cashFromClients||0),0);
  const moActive=selMDays.filter(d=>data.workDays[d]?.isActive).length;
  const moTips=selMDays.reduce((s,d)=>s+(data.workDays[d]?.tips||0),0);
  const moBonus=selMDays.reduce((s,d)=>s+(data.workDays[d]?.bonus||0),0);
  const moComm=data.upsells.filter(u=>selMDays.includes(u.date)&&u.status==="paid").reduce((s,u)=>s+(u.commission||0),0);
  const moTotal=moActive*BASE+moTips+moBonus+moComm;
  const pendingComm=data.upsells.filter(u=>u.status==="done"||u.status==="confirmed").reduce((s,u)=>s+(u.commission||0),0);
  const tuesdayNet=wkCash-pendingComm;
  const pendingRefs=data.upsells.filter(u=>u.type==="referral"&&u.status==="pending");
  const selUpsells=data.upsells.filter(u=>u.date===selDate);
  const chipLabel=tab==="field"?`${wkActive} ימים השבוע · ${fmt(wkTotal)}`:tab==="summary"?`${MONTH_HEB[selDObj.getMonth()]} · ${fmt(moTotal)}`:`שבוע · ${fmt(wkTotal)}`;
  const chipColor=wkActive>0?{bg:C.greenBg,border:C.greenBdr,text:C.green}:{bg:"#F1F5F9",border:C.border,text:C.muted};

  const toggleActive=()=>upsWD(selDate,{...selDay,isActive:!selDay.isActive});
  const addTip=()=>{const v=parseFloat(tipIn)||0;if(!v)return;upsWD(selDate,{...selDay,isActive:true,tips:(selDay.tips||0)+v});setTipIn("");flash("✅ טיפ נוסף");};
  const addCash=()=>{const v=parseFloat(cashIn)||0;if(!v)return;upsWD(selDate,{...selDay,isActive:true,cashFromClients:(selDay.cashFromClients||0)+v});setCashIn("");flash("✅ מזומן נוסף");};
  const addBonus=()=>{const v=parseFloat(bonusIn)||0;if(!v)return;upsWD(selDate,{...selDay,bonus:(selDay.bonus||0)+v});setBonusIn("");flash("✅ בונוס נוסף");};
  const saveEdit=()=>{const v=parseFloat(editVal)||0;const field=editMode==="tip"?"tips":editMode==="cash"?"cashFromClients":"bonus";upsWD(selDate,{...selDay,[field]:v});setEditMode(null);flash("✅ עודכן");};

  const addUpsell=async()=>{
    const iso=form.type==="onsite";
    if(iso&&(!form.address.trim()||!form.amount))return;
    if(!iso&&!form.phone.trim())return;
    const amt=iso?parseFloat(form.amount):0;
    const newUp={user_id:session.user.id,date:selDate,name:form.name.trim(),type:form.type,status:"pending",address:iso?form.address.trim():null,phone:!iso?form.phone.trim():null,amount:amt,commission:amt*CR};
    const{data:ins}=await supabase.from("upsells").insert(newUp).select().single();
    if(ins){const u={id:ins.id,date:ins.date,name:ins.name,type:ins.type,status:ins.status,address:ins.address,phone:ins.phone,amount:ins.amount,commission:ins.commission};setData(d=>({...d,upsells:[u,...d.upsells]}));}
    setForm({name:"",address:"",phone:"",amount:"",type:"onsite"});setShowForm(false);flash("✅ נוספה הגדלה");
  };

  const advOnsite=async(id)=>{const m={pending:"done",done:"paid",paid:"pending"};const u=data.upsells.find(u=>u.id===id);const ns=m[u.status];await supabase.from("upsells").update({status:ns}).eq("id",id);setData(d=>({...d,upsells:d.upsells.map(u=>u.id!==id?u:{...u,status:ns})}));};
  const startCnf=(id)=>{setConfirmId(id);setConfirmAmt("");};
  const submitCnf=async()=>{const a=parseFloat(confirmAmt);if(!a||a<=0)return;const c=a*CR;await supabase.from("upsells").update({status:"confirmed",amount:a,commission:c}).eq("id",confirmId);setData(d=>({...d,upsells:d.upsells.map(u=>u.id!==confirmId?u:{...u,status:"confirmed",amount:a,commission:c})}));setConfirmId(null);flash("✅ אושר");};
  const advPaid=async(id)=>{await supabase.from("upsells").update({status:"paid"}).eq("id",id);setData(d=>({...d,upsells:d.upsells.map(u=>u.id!==id?u:{...u,status:"paid"})}));};
  const delUp=async(id)=>{if(!window.confirm("למחוק?"))return;await supabase.from("upsells").delete().eq("id",id);setData(d=>({...d,upsells:d.upsells.filter(u=>u.id!==id)}));};

  const pill=(a,col=C.blue)=>({flex:1,background:a?col:"#F8FAFC",border:`1.5px solid ${a?col:C.border}`,borderRadius:10,padding:"10px",fontSize:14,fontWeight:700,color:a?"#fff":C.sub,cursor:"pointer"});
  const upProps={onAdvanceOnsite:advOnsite,onStartConfirm:startCnf,onAdvancePaid:advPaid,onDelete:delUp,confirmId,confirmAmt,setConfirmAmt,onSubmitCnf:submitCnf,onCancelCnf:()=>setConfirmId(null)};

  const AmountRow=({label,total,addVal,setAdd,onAdd,mode,color,borderColor,bgColor})=>{
    const isEdit=editMode===mode;
    return(
      <div style={{...card(),border:`1.5px solid ${borderColor||C.border}`,background:bgColor||C.white}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{...LBL,marginBottom:0,color:color||C.muted}}>{label}</div>
          {total>0&&!isEdit&&(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:15,fontWeight:700,color:color||C.navy}}>{fmt(total)}</span>
              <button onClick={()=>{setEditMode(mode);setEditVal(String(total));}} style={{background:"#F1F5F9",border:"none",color:C.sub,borderRadius:6,padding:"4px 8px",fontSize:12,cursor:"pointer"}}>עריכה</button>
            </div>
          )}
        </div>
        {isEdit?(
          <div>
            <div style={{fontSize:12,color:C.muted,marginBottom:6}}>ערוך סכום כולל</div>
            <div style={{display:"flex",gap:8}}>
              <input type="number" inputMode="numeric" value={editVal} onChange={e=>setEditVal(e.target.value)} style={{...INP,flex:1}}/>
              <button onClick={saveEdit} style={{background:C.green,color:"#fff",border:"none",borderRadius:10,padding:"0 16px",fontWeight:700,cursor:"pointer"}}>שמור</button>
              <button onClick={()=>setEditMode(null)} style={{background:"#F1F5F9",color:C.sub,border:"none",borderRadius:10,padding:"0 12px",cursor:"pointer"}}>ביטול</button>
            </div>
          </div>
        ):(
          <div style={{display:"flex",gap:8}}>
            <input type="number" inputMode="numeric" placeholder="הכנס סכום" value={addVal} onChange={e=>setAdd(e.target.value)} style={{...INP,flex:1}}/>
            <button onClick={onAdd} style={{background:bgColor||"#F8FAFC",color:color||C.sub,border:`1.5px solid ${borderColor||C.border}`,borderRadius:10,padding:"0 16px",fontWeight:700,cursor:"pointer",fontSize:20}}>+</button>
          </div>
        )}
      </div>
    );
  };

  const WeekNav=()=>{
    const wkStart=dateObj(selWk[0]),wkEnd=dateObj(selWk[6]);
    const wkLabel=selWk.includes(TODAY)?"השבוע הנוכחי":`${wkStart.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}–${wkEnd.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}`;
    const canFwd=selWk[6]<TODAY;
    return(
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <button onClick={()=>goTo(shift(selDate,-7))} style={{background:"#F1F5F9",border:"none",color:C.sub,borderRadius:8,width:32,height:32,fontSize:18,cursor:"pointer"}}>›</button>
          <span style={{fontSize:13,color:C.sub,fontWeight:600}}>{wkLabel}</span>
          <button onClick={()=>{if(!canFwd)return;goTo(shift(selDate,7));}} style={{background:canFwd?"#F1F5F9":"transparent",border:"none",color:canFwd?C.sub:"#CBD5E1",borderRadius:8,width:32,height:32,fontSize:18,cursor:canFwd?"pointer":"default"}}>‹</button>
        </div>
        <div style={{display:"flex",gap:5}}>
          {selWk.map((d,i)=>{
            const wd=data.workDays[d],fut=d>TODAY,act=wd?.isActive,isSel=d===selDate,isTod=d===TODAY;
            return(
              <button key={d} disabled={fut} onClick={()=>goTo(d)}
                style={{flex:1,background:isSel?C.blue:"#F8FAFC",border:`1.5px solid ${isSel?C.blue:act?C.greenBdr:isTod?C.blue+"44":C.border}`,
                  color:isSel?"#fff":act&&!isSel?C.green:fut?"#CBD5E1":isTod?C.blue:C.sub,
                  borderRadius:10,padding:"7px 0",fontSize:10,fontWeight:isSel?800:600,cursor:fut?"default":"pointer",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <span>{DAY_HEB[i]}</span>
                <span style={{fontSize:15,fontWeight:800}}>{dateObj(d).getDate()}</span>
                <span style={{width:4,height:4,borderRadius:"50%",background:act&&!isSel?C.green:"transparent"}}/>
              </button>
            );
          })}
        </div>
        <div style={{textAlign:"center",marginTop:10,fontSize:12,color:selDate===TODAY?C.blue:C.muted}}>
          {selDate===TODAY?"📍 היום":dateObj(selDate).toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"})}
        </div>
      </div>
    );
  };

  const renderField=()=>(
    <div style={{paddingTop:16,paddingBottom:80}}>
      <div style={{...card(),border:`1.5px solid ${selDay.isActive?C.greenBdr:C.border}`,background:selDay.isActive?C.greenBg:C.white,margin:"0 16px 12px"}}>
        <label style={LBL}>נוכחות</label>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:selDay.isActive?C.green:C.muted}}>{selDay.isActive?"✅ עבדתי היום":"לא סומן"}</div>
            {selDay.isActive&&<div style={{fontSize:13,color:C.green,marginTop:2}}>{fmt(BASE)} בסיס</div>}
          </div>
          <button onClick={toggleActive} style={{background:selDay.isActive?C.green:"#F1F5F9",color:selDay.isActive?"#fff":C.sub,border:"none",borderRadius:12,padding:"10px 18px",fontWeight:700,cursor:"pointer"}}>
            {selDay.isActive?"✓ בטל":"סמן"}
          </button>
        </div>
      </div>
      <div style={{margin:"0 16px"}}>
        <AmountRow label="טיפים במזומן" total={selDay.tips||0} addVal={tipIn} setAdd={setTipIn} onAdd={addTip} mode="tip" color={C.amber} borderColor={C.amberBdr} bgColor={C.amberBg}/>
        <AmountRow label="מזומן מלקוחות לחברה" total={selDay.cashFromClients||0} addVal={cashIn} setAdd={setCashIn} onAdd={addCash} mode="cash"/>
        {isTue(selDate)&&<AmountRow label="🎁 בונוס מהחברה" total={selDay.bonus||0} addVal={bonusIn} setAdd={setBonusIn} onAdd={addBonus} mode="bonus" color={C.purple} borderColor={C.purpleBdr} bgColor={C.purpleBg}/>}
      </div>
      <div style={{margin:"0 16px 12px"}}>
        {!showForm?(
          <button onClick={()=>setShowForm(true)} style={{...BTNP,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:20}}>+</span> הוסף הגדלה
          </button>
        ):(
          <div style={{background:C.white,border:`1.5px solid ${C.blue}`,borderRadius:16,padding:16}}>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:16}}>הגדלה חדשה</div>
            <div style={{marginBottom:14}}>
              <label style={LBL}>סוג</label>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setForm(f=>({...f,type:"onsite"}))} style={pill(form.type==="onsite")}>במקום</button>
                <button onClick={()=>setForm(f=>({...f,type:"referral"}))} style={pill(form.type==="referral",C.amber)}>הפניה</button>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={LBL}>שם (אופציונלי)</label>
              <input type="text" placeholder="שם הלקוח" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={INP}/>
            </div>
            {form.type==="onsite"&&<>
              <div style={{marginBottom:12}}><label style={LBL}>כתובת *</label><input type="text" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={INP} placeholder="כתובת הלקוח"/></div>
              <div style={{marginBottom:16}}>
                <label style={LBL}>סכום הגדלה (₪) *</label>
                <input type="number" inputMode="numeric" placeholder="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={INP}/>
                {form.amount&&parseFloat(form.amount)>0&&<div style={{marginTop:8,background:C.greenBg,border:`1px solid ${C.greenBdr}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:C.green,fontWeight:700}}>עמלה: {fmt(parseFloat(form.amount)*CR)}</div>}
              </div>
            </>}
            {form.type==="referral"&&<>
              <div style={{marginBottom:12}}><label style={LBL}>טלפון *</label><input type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={INP} placeholder="050-0000000" dir="ltr"/></div>
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBdr}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:C.amber,marginBottom:16}}>📞 מסור למנהל ביום שלישי</div>
            </>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={addUpsell} style={{...BTNP,flex:2,padding:14}}>הוסף</button>
              <button onClick={()=>{setShowForm(false);setForm({name:"",address:"",phone:"",amount:"",type:"onsite"});}} style={{...BTNS,flex:1,padding:14}}>ביטול</button>
            </div>
          </div>
        )}
      </div>
      {selUpsells.length>0&&(
        <div style={{...card(),margin:"0 16px"}}>
          <label style={LBL}>הגדלות ({selUpsells.length})</label>
          {selUpsells.map(u=><URow key={u.id} u={u} {...upProps}/>)}
        </div>
      )}
    </div>
  );

  const MonthCal=()=>{
    const grid=getMonthGrid(calYear,calMonth);
    const calMDays=grid.filter(Boolean);
    const cmActive=calMDays.filter(d=>data.workDays[d]?.isActive).length;
    const cmTips=calMDays.reduce((s,d)=>s+(data.workDays[d]?.tips||0),0);
    const cmBonus=calMDays.reduce((s,d)=>s+(data.workDays[d]?.bonus||0),0);
    const cmComm=data.upsells.filter(u=>calMDays.includes(u.date)&&u.status==="paid").reduce((s,u)=>s+(u.commission||0),0);
    const cmTotal=cmActive*BASE+cmTips+cmBonus+cmComm;
    const prevMo=()=>{if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1);};
    const canNext=calYear<new Date().getFullYear()||(calYear===new Date().getFullYear()&&calMonth<new Date().getMonth());
    const nextMo=()=>{if(!canNext)return;if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1);};
    return(
      <div style={{...card(),padding:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
          <button onClick={prevMo} style={{background:"#F1F5F9",border:"none",color:C.sub,borderRadius:8,width:32,height:32,fontSize:18,cursor:"pointer"}}>›</button>
          <div style={{fontSize:15,fontWeight:700,color:C.navy}}>{MONTH_HEB[calMonth]} {calYear}</div>
          <button onClick={nextMo} style={{background:canNext?"#F1F5F9":"transparent",border:"none",color:canNext?C.sub:"#CBD5E1",borderRadius:8,width:32,height:32,fontSize:18,cursor:canNext?"pointer":"default"}}>‹</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"8px 12px 4px"}}>
          {DAY_HEB.map(n=><div key={n} style={{textAlign:"center",fontSize:10,color:C.muted,fontWeight:600,padding:"4px 0"}}>{n}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 12px 12px",gap:3}}>
          {grid.map((d,i)=>{
            if(!d)return<div key={`b${i}`}/>;
            const wd=data.workDays[d],act=wd?.isActive,fut=d>TODAY,isTod=d===TODAY,isSel=d===selDate;
            const ups=data.upsells.filter(u=>u.date===d);
            return(
              <button key={d} onClick={()=>{if(!fut)setModalDay(d);}} disabled={fut}
                style={{background:isSel?C.blue:act?C.greenBg:isTod?"#EFF6FF":"#F8FAFC",
                  border:`1.5px solid ${isSel?C.blue:act?C.greenBdr:isTod?C.blue+"44":C.border}`,
                  borderRadius:10,padding:"6px 2px",cursor:fut?"default":"pointer",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:2,minHeight:52}}>
                <span style={{fontSize:13,fontWeight:isTod?800:600,color:isSel?"#fff":act?C.green:fut?"#CBD5E1":isTod?C.blue:C.navy}}>{dateObj(d).getDate()}</span>
                <div style={{display:"flex",gap:2,justifyContent:"center",flexWrap:"wrap"}}>
                  {act&&<span style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":C.green}}/>}
                  {(wd?.tips||0)>0&&<span style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.6)":C.amber}}/>}
                  {ups.length>0&&<span style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.6)":C.blue}}/>}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 16px",background:"#F8FAFC",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          <MStat label="ימי עבודה" val={cmActive} color={C.green}/>
          <MStat label="טיפים" val={fmt(cmTips)} color={C.amber}/>
          <MStat label='סה"כ חודש' val={fmt(cmTotal)} color={C.navy}/>
        </div>
      </div>
    );
  };

  const renderSummary=()=>{
    const allActive=data.upsells.filter(u=>u.status!=="paid");
    return(
      <div style={{paddingTop:16,paddingBottom:80}}>
        <div style={{...card(),background:`linear-gradient(135deg,${C.blue},#0A1F44)`,border:"none",margin:"0 16px 12px"}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:600,letterSpacing:"0.08em",marginBottom:4}}>
            סה"כ הכנסות — {MONTH_HEB[selDObj.getMonth()]} {selDObj.getFullYear()}
          </div>
          <div style={{fontSize:44,fontWeight:900,color:"#fff",lineHeight:1,letterSpacing:"-0.02em"}}>{fmt(moTotal)}</div>
          <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:4,borderTop:"1px solid rgba(255,255,255,0.15)",paddingTop:16}}>
            <HR label={`שכר בסיס — ${moActive} ימים`} val={fmt(moActive*BASE)}/>
            <HR label="טיפים" val={fmt(moTips)}/>
            <HR label="עמלות ששולמו" val={fmt(moComm)}/>
            {moBonus>0&&<HR label="בונוסים" val={fmt(moBonus)} hi/>}
          </div>
        </div>
        <div style={{margin:"0 16px 12px"}}><MonthCal/></div>
        {allActive.length>0&&(
          <div style={{...card(),margin:"0 16px"}}>
            <label style={LBL}>הגדלות פעילות ({allActive.length})</label>
            {allActive.map(u=><URow key={u.id} u={u} {...upProps} showDate/>)}
          </div>
        )}
      </div>
    );
  };

  const renderTuesday=()=>{
    const wkStart=dateObj(selWk[0]),wkEnd=dateObj(selWk[6]);
    const wkRangeLabel=`${wkStart.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}–${wkEnd.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}`;
    return(
      <div style={{paddingTop:16,paddingBottom:80}}>
        <div style={{margin:"0 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",background:C.white,borderRadius:14,padding:"12px 16px",boxShadow:C.sh}}>
          <button onClick={()=>goTo(shift(selDate,-7))} style={{background:"#F1F5F9",border:"none",color:C.sub,borderRadius:8,width:32,height:32,fontSize:18,cursor:"pointer"}}>›</button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:600}}>שבוע</div>
            <div style={{fontSize:14,fontWeight:700,color:C.navy}}>{wkRangeLabel}</div>
          </div>
          <button onClick={()=>{if(selWk[6]<TODAY)goTo(shift(selDate,7));}} style={{background:selWk[6]<TODAY?"#F1F5F9":"transparent",border:"none",color:selWk[6]<TODAY?C.sub:"#CBD5E1",borderRadius:8,width:32,height:32,fontSize:18,cursor:selWk[6]<TODAY?"pointer":"default"}}>‹</button>
        </div>
        {pendingRefs.length>0&&(
          <div style={{...card(),background:C.amberBg,border:`1px solid ${C.amberBdr}`,margin:"0 16px 12px"}}>
            <label style={{...LBL,color:C.amber}}>הפניות — למסור למנהל ({pendingRefs.length})</label>
            {pendingRefs.map(u=>(
              <div key={u.id} style={{background:C.white,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                {u.name&&<div style={{fontWeight:700,fontSize:15,color:C.navy,marginBottom:2}}>{u.name}</div>}
                <div style={{fontSize:18,color:C.amber,fontWeight:700,letterSpacing:1}}>{u.phone}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:4}}>{dateObj(u.date).toLocaleDateString("he-IL")}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{...card(),margin:"0 16px 12px"}}>
          <label style={LBL}>התחשבנות שבוע זה</label>
          <TRow label="מזומן שגבית מלקוחות" val={fmt(wkCash)} color={C.red} note="מסור למחסן"/>
          <div style={{height:1,background:C.border,margin:"16px 0"}}/>
          <TRow label="עמלות שמגיעות לך" val={`(${fmt(pendingComm)})`} color={C.green}/>
          <div style={{height:2,background:C.navy,margin:"16px 0",borderRadius:1}}/>
          <div>
            <label style={LBL}>{tuesdayNet>=0?"נטו — אתה מוסר למחסן":"נטו — המחסן חייב לך"}</label>
            <div style={{fontSize:40,fontWeight:900,color:tuesdayNet>=0?C.red:C.green,lineHeight:1}}>{fmt(Math.abs(tuesdayNet))}</div>
          </div>
        </div>
        <div style={{...card(),margin:"0 16px"}}>
          <label style={LBL}>פירוט ימי השבוע</label>
          {selWk.map(d=>{
            const wd=data.workDays[d];if(!wd?.isActive)return null;
            const comm=data.upsells.filter(u=>u.date===d&&u.status!=="pending").reduce((s,u)=>s+(u.commission||0),0);
            const dayTotal=BASE+(wd.tips||0)+(wd.bonus||0)+comm;
            return(
              <div key={d} style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:14,color:C.navy,fontWeight:500}}>{dateObj(d).toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"numeric"})}</div>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.green}}>{fmt(dayTotal)}</div>
                  <div style={{fontSize:11,color:C.muted}}>{fmt(BASE)}{wd.tips>0&&` +${fmt(wd.tips)}`}</div>
                </div>
              </div>
            );
          }).filter(Boolean)}
          {selWk.filter(d=>data.workDays[d]?.isActive).length===0&&<div style={{color:C.muted,fontSize:14,textAlign:"center",padding:16}}>אין ימי עבודה השבוע</div>}
        </div>
      </div>
    );
  };

  const DayModal=()=>{
    if(!modalDay)return null;
    const wd=data.workDays[modalDay]||{};
    const ups=data.upsells.filter(u=>u.date===modalDay);
    const comm=ups.filter(u=>u.status!=="pending").reduce((s,u)=>s+(u.commission||0),0);
    const dayTotal=(wd.isActive?BASE:0)+(wd.tips||0)+(wd.bonus||0)+comm;
    return(
      <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
        <div onClick={()=>setModalDay(null)} style={{position:"absolute",inset:0,background:"rgba(10,31,68,0.5)"}}/>
        <div style={{position:"relative",background:C.white,borderRadius:"24px 24px 0 0",maxHeight:"80vh",overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}><div style={{width:36,height:4,borderRadius:2,background:C.border}}/></div>
          <div style={{padding:"8px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:4}}>{dateObj(modalDay).toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:28,fontWeight:900,color:C.navy}}>{fmt(dayTotal)}</div>
              <div style={{background:wd.isActive?C.greenBg:"#F1F5F9",border:`1px solid ${wd.isActive?C.greenBdr:C.border}`,borderRadius:20,padding:"4px 12px",fontSize:13,fontWeight:700,color:wd.isActive?C.green:C.muted}}>
                {wd.isActive?"✅ עבדתי":"לא עבדתי"}
              </div>
            </div>
          </div>
          <div style={{padding:"16px 20px 0"}}>
            {wd.isActive&&<DRow label="שכר בסיס" val={fmt(BASE)} color={C.blue}/>}
            {(wd.tips||0)>0&&<DRow label="טיפים" val={fmt(wd.tips)} color={C.amber}/>}
            {(wd.cashFromClients||0)>0&&<DRow label="מזומן לחברה" val={fmt(wd.cashFromClients)}/>}
            {(wd.bonus||0)>0&&<DRow label="בונוס 🎁" val={fmt(wd.bonus)} color={C.purple}/>}
            {comm>0&&<DRow label="עמלות" val={fmt(comm)} color={C.green}/>}
            {!wd.isActive&&ups.length===0&&<div style={{textAlign:"center",color:C.muted,padding:20}}>אין נתונים ליום זה</div>}
            <div style={{display:"flex",gap:8,marginTop:20,marginBottom:24}}>
              <button onClick={()=>{goTo(modalDay);setModalDay(null);setTab("field");}} style={{...BTNP,flex:2,padding:13,fontSize:14}}>עבור ליום זה</button>
              <button onClick={()=>setModalDay(null)} style={{...BTNS,flex:1,padding:13,fontSize:14}}>סגור</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if(authLoading)return<div style={{background:C.white,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>⏳</div>;
  if(!session)return<AuthScreen/>;
  if(loading)return<div style={{background:C.white,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>⏳</div>;

  const TABS=[{id:"field",icon:"⚡",label:"שטח"},{id:"summary",icon:"📊",label:"סיכום"},{id:"tuesday",icon:"📋",label:"שלישי"}];

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.navy,fontFamily:"-apple-system,'Heebo',sans-serif",direction:"rtl",maxWidth:500,margin:"0 auto"}}>
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"14px 20px 10px",position:"sticky",top:0,zIndex:100}}>
        <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>KARISHAM</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:20,fontWeight:800,color:C.navy}}>{tab==="field"?"שטח":tab==="summary"?"סיכום":"שלישי"}</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{background:chipColor.bg,border:`1px solid ${chipColor.border}`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,color:chipColor.text}}>{chipLabel}</div>
            <button onClick={()=>supabase.auth.signOut()} style={{background:"#F1F5F9",border:"none",borderRadius:8,padding:"6px 10px",fontSize:12,color:C.muted,cursor:"pointer"}}>יציאה</button>
          </div>
        </div>
      </div>
      {tab==="field"&&<WeekNav/>}
      {toast&&<div style={{position:"fixed",top:12,left:"50%",transform:"translateX(-50%)",background:C.navy,color:"#fff",borderRadius:20,padding:"10px 20px",fontSize:14,fontWeight:600,zIndex:300,whiteSpace:"nowrap"}}>{toast}</div>}
      <div>
        {tab==="field"&&renderField()}
        {tab==="summary"&&renderSummary()}
        {tab==="tuesday"&&renderTuesday()}
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:500,background:C.white,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",padding:"10px 0 14px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:22}}>{t.icon}</span>
            <span style={{fontSize:11,fontWeight:tab===t.id?700:500,color:tab===t.id?C.blue:C.muted}}>{t.label}</span>
            {tab===t.id&&<span style={{width:16,height:2,background:C.blue,borderRadius:1}}/>}
          </button>
        ))}
      </div>
      <DayModal/>
    </div>
  );
}
