import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/react";
import { Capacitor } from "@capacitor/core";

// iOS-3: רטט קצר/בינוני/חזק בפעולות חשובות — שקט לחלוטין ב-web
const haptics = {
  light: async () => { if (!Capacitor.isNativePlatform()) return; try { const { Haptics, ImpactStyle } = await import("@capacitor/haptics"); await Haptics.impact({ style: ImpactStyle.Light }); } catch {} },
  medium: async () => { if (!Capacitor.isNativePlatform()) return; try { const { Haptics, ImpactStyle } = await import("@capacitor/haptics"); await Haptics.impact({ style: ImpactStyle.Medium }); } catch {} },
  success: async () => { if (!Capacitor.isNativePlatform()) return; try { const { Haptics, NotificationType } = await import("@capacitor/haptics"); await Haptics.notification({ type: NotificationType.Success }); } catch {} },
  warning: async () => { if (!Capacitor.isNativePlatform()) return; try { const { Haptics, NotificationType } = await import("@capacitor/haptics"); await Haptics.notification({ type: NotificationType.Warning }); } catch {} },
};

const SUPABASE_URL = "https://xhouuigwhjwsmttdpudl.supabase.co";
const SUPABASE_KEY = "sb_publishable_jYGyXWsmisYcPjjVdWrOZw_ik7c3bRr";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// P1-4: ולידציה של מספרים — מסכומים שליליים, NaN, Infinity, או מספרים גבוהים בצורה לא הגיונית.
// מחזיר number חוקי או null. הקורא צריך לבדוק null ולא להמשיך.
// MAX מגדיר תקרה לפי הקשר (טיפים=99999, אפסיילים=999999) בהתאם ל-CHECK constraints ב-DB.
function parseAmount(raw, MAX = 99999) {
  const n = parseFloat(String(raw).trim());
  if (!Number.isFinite(n)) return null;     // NaN, Infinity, -Infinity
  if (n <= 0) return null;                   // 0 ולמטה
  if (n >= MAX) return null;                 // מעבר לתקרה — DB יחסום בכל מקרה
  return n;
}

// P0-4: error wrapper לכל קריאות Supabase mutations.
// מחזיר { ok, data, error }. אם ok=false — הקורא חייב להציג toast ולא לעדכן state אופטימי.
// כל error נרשם ל-console + נשלח ל-Sentry בפרודקשן.
async function dbOp(promise) {
  try {
    const result = await promise;
    if (result?.error) {
      console.error("[DB Error]", result.error.message || result.error, result.error);
      Sentry.captureException(result.error, { tags: { source: "supabase_db" } });
      return { ok: false, data: null, error: result.error };
    }
    return { ok: true, data: result?.data ?? null, error: null };
  } catch (err) {
    console.error("[DB Exception]", err);
    Sentry.captureException(err, { tags: { source: "supabase_exception" } });
    return { ok: false, data: null, error: err };
  }
}

const BASE = 580;
const CR = 0.25;
const DAY_HEB = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
const MONTH_HEB = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// P1-3: timezone lock — כל החישובים על פי Asia/Jerusalem גם אם המכשיר באזור זמן אחר.
// משתמש ב-Intl.DateTimeFormat שמכיר את DST של ישראל אוטומטית.
const TZ = "Asia/Jerusalem";
const _dsFmt = new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}); // YYYY-MM-DD
const _wdFmt = new Intl.DateTimeFormat("en-US",{timeZone:TZ,weekday:"short"}); // קצר: Sun/Mon/Tue/Wed/Thu/Fri/Sat
const _WD_MAP = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};

// המרה של Date אובייקט ל-YYYY-MM-DD במחוז זמן ישראל
const ds = (d) => _dsFmt.format(d);
const TODAY = ds(new Date());
const fmt = (n) => `₪${Math.abs(Math.round(n)).toLocaleString("he-IL")}`;
// יום בשבוע של תאריך (0=ראשון..6=שבת), במחוז זמן ישראל
const _getDay = (d) => _WD_MAP[_wdFmt.format(d)];
const isTue = (d) => _getDay(new Date(d+"T12:00:00Z"))===2;
// תאריך 'YYYY-MM-DD' → Date אובייקט שמתקבע על הצהריים UTC (12:00:00Z נמצא תמיד באותו יום בכל timezone)
const dateObj = (d) => new Date(d+"T12:00:00Z");
const shift = (d,days) => { const o=dateObj(d); o.setUTCDate(o.getUTCDate()+days); return ds(o); };

// P0-1 + P1-3: מחזור שלישי–שני (מחזור מסירת מזומן), כל החישובים ב-Asia/Jerusalem
function getDeliveryTuesdayOf(dateStr) {
  const d=dateObj(dateStr), day=_getDay(d);
  if(day===2) return dateStr;
  const daysUntilTue=(2-day+7)%7||7;
  return shift(dateStr,daysUntilTue);
}
function getDeliveryCycle(deliveryTuesdayStr) {
  // 7 ימים לפני יום המסירה: [שלישי קודם .. שני]
  return Array.from({length:7},(_,i)=>shift(deliveryTuesdayStr,i-7));
}

function getWeekOf(dateStr) {
  const day=_getDay(dateObj(dateStr));
  const sunday=shift(dateStr,-day);
  return Array.from({length:7},(_,i)=>shift(sunday,i));
}

// פונקציות עזר לשנה/חודש של תאריך לפי Asia/Jerusalem
const _ymFmt = new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit"});
function _getYearMonth(d){
  const [y,m]=_ymFmt.format(d).split("-").map(Number);
  return {year:y,month:m-1}; // 0-based month
}

function getMonthGrid(year,month) {
  // יוצרים תאריך התחלה ב-UTC על צהריים — שיתורגם תמיד לאותו תאריך ב-Asia/Jerusalem
  const firstStr=`${year}-${String(month+1).padStart(2,"0")}-01`;
  const firstDOW=_getDay(dateObj(firstStr));
  // מספר ימים בחודש: כמה ימים מ-1 בחודש עד ראשון של החודש הבא, מינוס 1
  const nextMonthYear=month===11?year+1:year;
  const nextMonth=month===11?0:month+1;
  const lastDayStr=`${nextMonthYear}-${String(nextMonth+1).padStart(2,"0")}-01`;
  const daysInMonth=Math.round((dateObj(lastDayStr)-dateObj(firstStr))/86400000);
  const cells=[];
  for(let i=0;i<firstDOW;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  return cells;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS v2 — iOS 26 inspired, enterprise grade
// Color palette: iOS system colors + neutral grays
// Type scale: 11 / 13 / 15 / 17 / 22 / 34
// Spacing: 4px base scale
// Radii: 8 / 14 / 20
// ═══════════════════════════════════════════════════════════════
const C={
// Base
bg:"#F5F5F7", white:"#FFFFFF", surface:"#FFFFFF", surfaceAlt:"#FAFAFB",
border:"#E5E5EA", borderSubtle:"#F0F0F2", divider:"#EFEFF1",
// Ink
ink:"#1C1C1E", inkSecondary:"#636366", inkTertiary:"#8E8E93", inkQuaternary:"#C7C7CC",
// Accents (iOS system)
brand:"#007AFF", brandSoft:"#E5F0FF", brandDeep:"#0051D5",
success:"#34C759", successSoft:"#E8F8EC", successDeep:"#248A3D",
warning:"#FF9500", warningSoft:"#FFF4E5", warningDeep:"#C76E00",
danger:"#FF3B30", dangerSoft:"#FFE5E5", dangerDeep:"#C72820",
special:"#AF52DE", specialSoft:"#F5E9FB", specialDeep:"#7E3DA8",
teal:"#5AC8FA", tealSoft:"#E5F6FF",
// Overlay
overlay:"rgba(0,0,0,0.40)",
// Shadows (3 levels)
shSm:"0 1px 2px rgba(0,0,0,0.04)",
shMd:"0 4px 12px rgba(0,0,0,0.06)",
shLg:"0 10px 30px rgba(0,0,0,0.10)",
// Legacy aliases for backwards compatibility (mapped to new palette)
navy:"#1C1C1E", blue:"#007AFF", muted:"#8E8E93", sub:"#636366", disabled:"#C7C7CC",
green:"#248A3D", greenBg:"#E8F8EC", greenBdr:"#A7E5B8",
amber:"#C76E00", amberBg:"#FFF4E5", amberBdr:"#FFDFB0",
red:"#FF3B30", purple:"#AF52DE", purpleBg:"#F5E9FB", purpleBdr:"#E5C8F2",
sh:"0 1px 2px rgba(0,0,0,0.04)", shGreen:"0 4px 16px rgba(52,199,89,0.24)", shBlue:"0 4px 16px rgba(0,122,255,0.24)",
};

// Status colors — modernized
const ST_ON = {
  pending:{l:"ממתין",i:"⏳",c:C.warning,bg:C.warningSoft},
  done:{l:"בוצע",i:"✓",c:C.success,bg:C.successSoft},
  paid:{l:"שולם",i:"💰",c:C.brand,bg:C.brandSoft},
  deferred_monthly:{l:"נדחה לחודש",i:"📅",c:C.special,bg:C.specialSoft},
  deferred_tuesday:{l:"נדחה לשלישי",i:"⏰",c:"#0891B2",bg:C.tealSoft}
};
const ST_REF = {
  pending:{l:"למנהל טלפון",i:"📞",c:C.warning,bg:C.warningSoft},
  confirmed:{l:"אושר",i:"✓",c:C.success,bg:C.successSoft},
  paid:{l:"שולם",i:"💰",c:C.brand,bg:C.brandSoft},
  deferred_monthly:{l:"נדחה לחודש",i:"📅",c:C.special,bg:C.specialSoft},
  deferred_tuesday:{l:"נדחה לשלישי",i:"⏰",c:"#0891B2",bg:C.tealSoft}
};

// Spacing scale (4px base)
const SP={xs:4, s:8, m:12, base:16, l:20, xl:24, xxl:32, xxxl:48};
// Radii
const R={s:8, m:14, l:20, full:9999};

// Typography scale
const T={
  display:{fontSize:34, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1.1},
  titleL:{fontSize:22, fontWeight:700, letterSpacing:"-0.01em", lineHeight:1.2},
  titleM:{fontSize:17, fontWeight:600, lineHeight:1.3},
  bodyL:{fontSize:15, fontWeight:500, lineHeight:1.4},
  bodyM:{fontSize:13, fontWeight:500, lineHeight:1.4},
  caption:{fontSize:11, fontWeight:600, color:C.inkTertiary, letterSpacing:"0.04em"},
  captionUC:{fontSize:11, fontWeight:600, color:C.inkTertiary, letterSpacing:"0.08em", textTransform:"uppercase"},
};

// Transitions
const TRANS={
  btn:"transform 0.12s cubic-bezier(0.4,0,0.2,1), box-shadow 0.18s ease, background 0.18s ease, opacity 0.18s ease",
  spring:"all 0.32s cubic-bezier(0.34,1.56,0.64,1)",
};

// Component builders
const card=(ex={})=>({background:C.white,border:`1px solid ${C.borderSubtle}`,borderRadius:R.m,padding:SP.base,marginBottom:SP.m,boxShadow:C.shSm,...ex});
const INP={background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:R.s+4,color:C.ink,fontSize:16,padding:"14px 16px",width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none",transition:"border-color 0.15s ease, background 0.15s ease",fontWeight:500};
const LBL={...T.captionUC,marginBottom:SP.s,display:"block"};
// Button system: primary / secondary / ghost / icon
const BTNP={background:C.brand,color:"#fff",border:"none",borderRadius:R.s+4,padding:"15px 20px",fontSize:16,fontWeight:600,cursor:"pointer",width:"100%",transition:TRANS.btn,WebkitTapHighlightColor:"transparent",letterSpacing:"-0.01em"};
const BTNS={background:C.surfaceAlt,color:C.ink,border:`1px solid ${C.border}`,borderRadius:R.s+4,padding:"15px 20px",fontSize:16,fontWeight:600,cursor:"pointer",transition:TRANS.btn,WebkitTapHighlightColor:"transparent"};
const BTNG={background:"transparent",color:C.inkSecondary,border:`1px solid ${C.border}`,borderRadius:R.s,cursor:"pointer",transition:TRANS.btn,WebkitTapHighlightColor:"transparent"};
const BTNI=(sz=44)=>({...BTNG,width:sz,height:sz,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:sz>36?18:14,lineHeight:1,padding:0});

// SVG Icon component — replaces emoji-based icons
const Icon=({name,size=20,color="currentColor",strokeWidth=2})=>{
  const paths={
    bolt:<><path d="M13 2 L4.5 13.5 H11 L10 22 L18.5 10.5 H12 L13 2Z"/></>,
    chart:<><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></>,
    calendar:<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    logout:<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    chevronRight:<><polyline points="9 18 15 12 9 6"/></>,
    chevronLeft:<><polyline points="15 18 9 12 15 6"/></>,
    chevronDown:<><polyline points="6 9 12 15 18 9"/></>,
    plus:<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    minus:<><line x1="5" y1="12" x2="19" y2="12"/></>,
    check:<><polyline points="20 6 9 17 4 12"/></>,
    x:<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    trash:<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    edit:<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    download:<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    gift:<><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>,
    clock:<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    phone:<><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></>,
    play:<><polygon points="5 3 19 12 5 21 5 3"/></>,
    play2:<><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></>,
    bell:<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    dollar:<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    alert:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    info:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    pinpoint:<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
    sparkle:<><path d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z"/></>,
    sparkle2:<><path d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z" fill="currentColor" stroke="none"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{display:"block",flexShrink:0}}>{paths[name]||null}</svg>;
};

function PrivacyModal({onClose}){
return(
<div style={{position:"fixed",inset:0,background:C.overlay,zIndex:600,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
<div onClick={e=>e.stopPropagation()} style={{background:C.white,width:"100%",maxHeight:"85dvh",borderRadius:"20px 20px 0 0",display:"flex",flexDirection:"column"}}>
<div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
<div style={{fontSize:16,fontWeight:800,color:C.navy}}>מדיניות פרטיות</div>
<button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",color:C.inkSecondary,padding:0,minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}><Icon name="x" size={20} strokeWidth={2}/></button>
</div>
<div style={{padding:"20px",overflowY:"auto",flex:1,fontSize:14,lineHeight:1.8,color:C.navy,direction:"rtl"}}>
<p style={{margin:"0 0 16px",color:C.muted,fontSize:12}}>עדכון אחרון: אפריל 2026</p>
<h3 style={{fontSize:14,fontWeight:800,color:C.navy,margin:"0 0 8px"}}>1. מי אחראי על המידע</h3>
<p style={{margin:"0 0 16px"}}>האפליקציה מופעלת לניהול ימי עבודה ועמלות עבור עובדי כרישים בניקיון.</p>
<h3 style={{fontSize:14,fontWeight:800,color:C.navy,margin:"0 0 8px"}}>2. מה אנחנו אוספים</h3>
<ul style={{margin:"0 0 16px",paddingRight:20}}>
<li><strong>פרטי חשבון:</strong> כתובת אימייל וסיסמה מוצפנת לצורך התחברות.</li>
<li><strong>נתוני עבודה:</strong> תאריכים, טיפים, מזומן מלקוחות ובונוסים — כפי שאתה מזין.</li>
<li><strong>נתוני מכירות:</strong> שם, סוג, כתובת, טלפון, סכום ועמלה של כל אפסייל או הפניה.</li>
</ul>
<h3 style={{fontSize:14,fontWeight:800,color:C.navy,margin:"0 0 8px"}}>3. למה אנחנו אוספים</h3>
<p style={{margin:"0 0 16px"}}>המידע משמש אך ורק לניהול השכר האישי שלך ולהצגת נתוני העבודה. אין שימוש פרסומי.</p>
<h3 style={{fontSize:14,fontWeight:800,color:C.navy,margin:"0 0 8px"}}>4. אחסון ואבטחה</h3>
<p style={{margin:"0 0 16px"}}>המידע מאוחסן בשירות Supabase (supabase.com) על שרתים באיחוד האירופי, מוגנים בהצפנה.</p>
<h3 style={{fontSize:14,fontWeight:800,color:C.navy,margin:"0 0 8px"}}>5. עוגיות (Cookies)</h3>
<p style={{margin:"0 0 16px"}}>האפליקציה משתמשת בעוגיית הזדהות של Supabase כדי לשמור על החיבור שלך. לא נעשה שימוש בעוגיות פרסומיות.</p>
<h3 style={{fontSize:14,fontWeight:800,color:C.navy,margin:"0 0 8px"}}>6. זכויות שלך</h3>
<p style={{margin:"0 0 16px"}}>יש לך זכות לעיין במידע, לתקן אותו, או לבקש מחיקת החשבון — בפנייה ישירה למנהל המערכת.</p>
<h3 style={{fontSize:14,fontWeight:800,color:C.navy,margin:"0 0 8px"}}>7. יצירת קשר</h3>
<p style={{margin:"0 0 24px"}}>לשאלות בנושא פרטיות — פנה למנהל המערכת.</p>
</div>
</div>
</div>
);
}

function CookieBanner({onAccept,onOpenPrivacy}){
return(
<div style={{position:"fixed",bottom:0,left:0,right:0,background:C.navy,color:"#fff",padding:"14px 16px",paddingBottom:"calc(14px + env(safe-area-inset-bottom))",zIndex:150,direction:"rtl",display:"flex",flexDirection:"column",gap:10}}>
<div style={{fontSize:13,lineHeight:1.6}}>
האפליקציה משתמשת בעוגיות הזדהות כדי לשמור אותך מחובר.
{" "}<button onClick={onOpenPrivacy} style={{background:"none",border:"none",color:"#93C5FD",fontSize:13,cursor:"pointer",padding:0,textDecoration:"underline",fontFamily:"inherit"}}>מדיניות פרטיות</button>
</div>
<button onClick={onAccept} style={{background:C.blue,color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:"pointer",alignSelf:"flex-start",fontFamily:"inherit"}}>הבנתי, אישור</button>
</div>
);
}

function AuthScreen({onPrivacy}) {
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
<div style={{background:C.bg,minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingTop:"calc(24px + env(safe-area-inset-top))",paddingBottom:24,paddingLeft:"calc(24px + env(safe-area-inset-left))",paddingRight:"calc(24px + env(safe-area-inset-right))",fontFamily:"-apple-system,'Heebo',sans-serif",direction:"rtl"}}>
<div style={{width:"100%",maxWidth:"min(400px, 100% - 48px)"}}>
<div style={{textAlign:"center",marginBottom:32}}>
<div style={{fontSize:48,marginBottom:8}}>🔧</div>
<div style={{fontSize:28,fontWeight:900,color:C.navy}}>כרישים בניקיון</div>
<div style={{fontSize:14,color:C.muted,marginTop:4}}>ניהול שטח מקצועי</div>
</div>
<div style={card()}>
<div style={{display:"flex",marginBottom:20,background:C.surfaceAlt,borderRadius:10,padding:4}}>
<button onClick={()=>setIsLogin(true)} style={{flex:1,border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:14,cursor:"pointer",background:isLogin?C.white:"transparent",color:isLogin?C.navy:C.muted,transition:"all 0.2s"}}>התחברות</button>
<button onClick={()=>setIsLogin(false)} style={{flex:1,border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:14,cursor:"pointer",background:!isLogin?C.white:"transparent",color:!isLogin?C.navy:C.muted,transition:"all 0.2s"}}>הרשמה</button>
</div>
<div style={{marginBottom:16}}>
<label style={LBL}>אימייל</label>
<input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} style={INP} placeholder="your@email.com" dir="ltr"/>
</div>
<div style={{marginBottom:20}}>
<label style={LBL}>סיסמא</label>
<input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} style={INP} placeholder="••••••••" dir="ltr"/>
</div>
{error&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",color:C.red,fontSize:13,marginBottom:16}}>{error}</div>}
{msg&&<div style={{background:C.greenBg,border:`1px solid ${C.greenBdr}`,borderRadius:8,padding:"10px 14px",color:C.green,fontSize:13,marginBottom:16}}>{msg}</div>}
<button onClick={handle} disabled={loading} style={{...BTNP,opacity:loading?0.7:1}}>
{loading?"טוען...":isLogin?"התחבר":"הירשם"}
</button>
</div>
<div style={{textAlign:"center",marginTop:20}}>
<button onClick={onPrivacy} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",textDecoration:"underline",fontFamily:"inherit"}}>מדיניות פרטיות</button>
</div>
</div>
</div>
);
}

function HR({label,val,hi}){return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}><span style={{fontSize:13,color:hi?"#E5C8F2":"rgba(255,255,255,0.7)",fontWeight:500}}>{label}</span><span style={{fontSize:14,fontWeight:600,color:hi?"#E5C8F2":"#fff"}}>{val}</span></div>;}
function TRow({label,val,color,note}){return <div style={{marginBottom:12}}><div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:2}}>{label}{note&&<span style={{marginRight:6,color:C.muted,fontWeight:400}}>{note}</span>}</div><div style={{fontSize:22,fontWeight:800,color:color||C.navy}}>{val}</div></div>;}
function DRow({label,val,color}){return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.muted}}>{label}</span><span style={{fontSize:14,fontWeight:700,color:color||C.navy}}>{val}</span></div>;}
function MStat({label,val,color}){return <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.muted,marginBottom:2}}>{label}</div><div style={{fontSize:13,fontWeight:700,color:color||C.navy}}>{val}</div></div>;}

function URow({u,onAdvanceOnsite,onStartConfirm,onDelete,confirmId,confirmAmt,setConfirmAmt,onSubmitCnf,onCancelCnf,showDate,
deleteConfirmId,onCancelDelete,
chipMenuId,setChipMenuId,paidConfirmId,onRequestPaid,onExecutePaid,onCancelPaid,
onDeferMonthly,onDeferTuesday}){
const iso=u.type==="onsite";
const st=(iso?ST_ON:ST_REF)[u.status]||(iso?ST_ON:ST_REF)["pending"];
const isCnf=confirmId===u.id;
const isDelConfirm=deleteConfirmId===u.id;
const isMenuOpen=chipMenuId===u.id;
const isPaidConfirm=paidConfirmId===u.id;
const isFinal=u.status==="paid"||u.status==="deferred_monthly"||u.status==="deferred_tuesday";
const fmt2=(n)=>`₪${Math.abs(Math.round(n)).toLocaleString("he-IL")}`;

// תפריט פעולות לפי סטטוס
const bMenu=(label,col,bg,border,onClick)=>(
<button onClick={onClick} style={{background:bg,color:col,border:`1.5px solid ${border}`,borderRadius:8,padding:"9px 12px",fontSize:12,fontWeight:700,cursor:"pointer",flex:1,textAlign:"center"}}>{label}</button>
);
const menuContent=()=>{
if(iso){
if(u.status==="pending") return bMenu("✅ סמן כבוצע",C.green,C.greenBg,C.greenBdr,()=>onAdvanceOnsite(u.id));
if(u.status==="done") return(<><div style={{display:"flex",gap:6,flexWrap:"wrap",width:"100%"}}>{bMenu("✓ גביתי",C.green,C.greenBg,C.greenBdr,()=>onRequestPaid(u.id))}{bMenu("📅 לחודש",C.purple,C.purpleBg,C.purpleBdr,()=>onDeferMonthly(u.id))}{bMenu("⏰ לשלישי הבא","#0891B2","#ECFEFF","#A5F3FC",()=>onDeferTuesday(u.id))}</div></>);
}else{
if(u.status==="pending") return bMenu("📞 הזן סכום לאישור",C.amber,C.amberBg,C.amberBdr,()=>{onStartConfirm(u.id);setChipMenuId(null);});
if(u.status==="confirmed") return(<><div style={{display:"flex",gap:6,flexWrap:"wrap",width:"100%"}}>{bMenu("✓ גביתי",C.green,C.greenBg,C.greenBdr,()=>onRequestPaid(u.id))}{bMenu("📅 לחודש",C.purple,C.purpleBg,C.purpleBdr,()=>onDeferMonthly(u.id))}{bMenu("⏰ לשלישי הבא","#0891B2","#ECFEFF","#A5F3FC",()=>onDeferTuesday(u.id))}</div></>);
}
return null;
};

return(
<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px",marginBottom:8,position:"relative",zIndex:isMenuOpen?100:undefined}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
{/* chip סטטוס לחיץ */}
<button onClick={()=>{if(!isFinal)setChipMenuId(isMenuOpen?null:u.id);}} disabled={isFinal}
style={{background:`${st.c}15`,border:`1.5px solid ${st.c}44`,color:st.c,borderRadius:8,padding:"5px 9px",fontSize:12,fontWeight:700,cursor:isFinal?"default":"pointer",flexShrink:0,opacity:isFinal?0.65:1,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",minHeight:34,WebkitTapHighlightColor:"transparent"}}>
<span style={{fontSize:15,lineHeight:1}}>{st.i}</span>
<span>{st.l}</span>
{!isFinal&&<span style={{fontSize:9,opacity:0.7}}>{isMenuOpen?"▴":"▾"}</span>}
</button>
{/* שם + פרטים */}
<div style={{flex:1,minWidth:0}}>
<div style={{fontWeight:700,fontSize:14,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name||u.address||u.phone||"ללא שם"}</div>
<div style={{fontSize:11,color:C.muted,marginTop:1}}>{iso?"במקום":"הפניה"}{showDate&&` · ${dateObj(u.date).toLocaleDateString("he-IL")}`}</div>
{(u.amount>0||u.commission>0)&&(
<div style={{display:"flex",gap:6,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
{u.amount>0&&<span style={{fontSize:12,color:C.sub,fontWeight:500}}>{fmt2(u.amount)}</span>}
{u.commission>0&&<span style={{fontSize:12,color:C.green,fontWeight:700}}>עמלה: {fmt2(u.commission)}</span>}
</div>
)}
</div>
{/* כפתור מחיקה */}
<div style={{flexShrink:0}}>
{isDelConfirm?(
<div style={{display:"flex",gap:4}}>
<button onClick={()=>onDelete(u.id)} style={{background:C.red,color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:700,minHeight:28}}>מחק!</button>
<button onClick={onCancelDelete} style={{background:C.surfaceAlt,border:"none",color:C.muted,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",minHeight:28}}>ביטול</button>
</div>
):(
<button onClick={()=>onDelete(u.id)} style={{background:"transparent",border:"none",color:C.inkQuaternary,cursor:"pointer",minWidth:36,minHeight:36,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}><Icon name="trash" size={18} strokeWidth={1.8}/></button>
)}
</div>
</div>
{/* אזהרת מחיקה */}
{isDelConfirm&&(
<div style={{marginTop:8,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"8px 12px",fontSize:12,color:C.red,fontWeight:600}}>
⚠️ הפעולה בלתי הפיכה — המידע יימחק לצמיתות
</div>
)}
{/* תפריט inline */}
{isMenuOpen&&(
<div style={{marginTop:8,padding:8,background:C.white,border:`1.5px solid ${st.c}33`,borderRadius:10}}>
{menuContent()}
</div>
)}
{/* אישור מפורש לפני paid */}
{isPaidConfirm&&(
<div style={{marginTop:8,background:C.amberBg,border:`1.5px solid ${C.amberBdr}`,borderRadius:10,padding:12}}>
<div style={{fontSize:13,color:C.amber,fontWeight:700,marginBottom:6}}>לסמן כשולם? הפעולה סופית ובלתי הפיכה</div>
{u.commission>0&&<div style={{fontSize:13,color:C.green,fontWeight:700,marginBottom:10}}>עמלה: {fmt2(u.commission)}</div>}
<div style={{display:"flex",gap:8}}>
<button onClick={()=>onExecutePaid(u.id)} style={{background:C.green,color:"#fff",border:"none",borderRadius:8,padding:"10px 0",fontWeight:700,cursor:"pointer",flex:2,fontSize:14}}>✓ אישור</button>
<button onClick={onCancelPaid} style={{background:C.surfaceAlt,color:C.muted,border:"none",borderRadius:8,padding:"10px 0",cursor:"pointer",flex:1,fontSize:14}}>ביטול</button>
</div>
</div>
)}
{/* הזנת סכום הפניה */}
{isCnf&&(
<div style={{marginTop:12,background:C.greenBg,border:`1px solid ${C.greenBdr}`,borderRadius:10,padding:12}}>
<div style={{fontSize:13,color:C.green,marginBottom:10,fontWeight:700}}>סכום העסקה הסופי</div>
<div style={{display:"flex",gap:8}}>
<input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="₪ סכום" value={confirmAmt} onChange={e=>setConfirmAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSubmitCnf()} style={{...INP,flex:1}}/>
<button onClick={onSubmitCnf} style={{background:C.green,color:"#fff",border:"none",borderRadius:10,padding:"0 16px",fontWeight:700,cursor:"pointer",minHeight:44}}>אישור</button>
<button onClick={onCancelCnf} style={{background:C.surfaceAlt,color:C.muted,border:"none",borderRadius:10,padding:"0 12px",cursor:"pointer",minHeight:44}}>ביטול</button>
</div>
{confirmAmt&&parseFloat(confirmAmt)>0&&<div style={{fontSize:13,color:C.green,marginTop:8}}>עמלה: {fmt2(parseFloat(confirmAmt)*CR)}</div>}
</div>
)}
</div>
);
}

function AmountRow({label,total,addVal,setAdd,onAdd,mode,color,borderColor,bgColor,editMode,editVal,setEditMode,setEditVal,saveEdit}){
const isEdit=editMode===mode;
return(
<div style={{...card(),padding:12,border:`1.5px solid ${borderColor||C.border}`,background:bgColor||C.white}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<div style={{...LBL,marginBottom:0,color:color||C.muted}}>{label}</div>
{total>0&&!isEdit&&(
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:15,fontWeight:700,color:color||C.navy}}>{fmt(total)}</span>
<button onClick={()=>{setEditMode(mode);setEditVal(String(total));}} style={{background:C.surfaceAlt,border:"none",color:C.sub,borderRadius:6,padding:"4px 8px",fontSize:12,cursor:"pointer",minHeight:44,alignSelf:"center"}}>עריכה</button>
</div>
)}
</div>
{isEdit?(
<div>
<div style={{fontSize:12,color:C.muted,marginBottom:6}}>ערוך סכום כולל</div>
<div style={{display:"flex",gap:8}}>
<input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit()} style={{...INP,flex:1}}/>
<button onClick={saveEdit} style={{background:C.green,color:"#fff",border:"none",borderRadius:10,padding:"0 16px",fontWeight:700,cursor:"pointer",minHeight:44}}>שמור</button>
<button onClick={()=>setEditMode(null)} style={{background:C.surfaceAlt,color:C.sub,border:"none",borderRadius:10,padding:"0 12px",cursor:"pointer",minHeight:44}}>ביטול</button>
</div>
</div>
):(
<div style={{display:"flex",gap:8}}>
<input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="0" value={addVal} onChange={e=>setAdd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAdd()} style={{...INP,flex:1}}/>
<button onClick={onAdd} style={{background:color||C.brand,color:"#fff",border:"none",borderRadius:R.s+4,padding:"0 16px",fontWeight:600,cursor:"pointer",minHeight:48,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",minWidth:48}}><Icon name="plus" size={20} strokeWidth={2.5} color="#fff"/></button>
</div>
)}
</div>
);
}

function WeekNav({selWk,data,selDate,goTo}){
const wkStart=dateObj(selWk[0]),wkEnd=dateObj(selWk[6]);
const wkLabel=selWk.includes(TODAY)?"השבוע הנוכחי":`${wkStart.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}–${wkEnd.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}`;
const canFwd=selWk[6]<TODAY;
return(
<div style={{background:C.surface,borderBottom:`0.5px solid ${C.border}`,padding:"10px 16px 12px"}}>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
<button onClick={()=>goTo(shift(selDate,-7))} style={{...BTNI(36),background:C.surfaceAlt,border:"none",color:C.inkSecondary}}><Icon name="chevronRight" size={16} strokeWidth={2.2}/></button>
<span style={{fontSize:14,color:C.ink,fontWeight:600,letterSpacing:"-0.01em"}}>{wkLabel}</span>
<button onClick={()=>{if(!canFwd)return;goTo(shift(selDate,7));}} style={{...BTNI(36),background:canFwd?C.surfaceAlt:"transparent",border:"none",color:canFwd?C.inkSecondary:C.inkQuaternary,cursor:canFwd?"pointer":"default"}}><Icon name="chevronLeft" size={16} strokeWidth={2.2}/></button>
</div>
<div style={{display:"flex",gap:6}}>
{selWk.map((d,i)=>{
const wd=data.workDays[d],fut=d>TODAY,act=wd?.isActive,isSel=d===selDate,isTod=d===TODAY;
return(
<button key={d} disabled={fut} onClick={()=>{haptics.light();goTo(d);}}
style={{flex:1,background:isSel?C.brand:act?C.successSoft:isTod?C.brandSoft:C.surfaceAlt,
border:"none",
color:isSel?"#fff":act?C.successDeep:fut?C.inkQuaternary:isTod?C.brand:C.inkSecondary,
borderRadius:R.m,padding:"8px 0 6px",fontSize:10,fontWeight:isSel?700:600,cursor:fut?"default":"pointer",
display:"flex",flexDirection:"column",alignItems:"center",gap:3,
opacity:fut?0.4:1,
WebkitTapHighlightColor:"transparent",
transition:"background 0.15s ease, color 0.15s ease"}}>
<span style={{fontSize:10,fontWeight:600,opacity:isSel?0.85:0.7,letterSpacing:"0.02em"}}>{DAY_HEB[i]}</span>
<span style={{fontSize:17,fontWeight:700,letterSpacing:"-0.01em"}}>{Number(d.split("-")[2])}</span>
<span style={{width:4,height:4,borderRadius:"50%",background:act&&!isSel?C.success:isSel?"rgba(255,255,255,0.6)":"transparent",marginTop:1}}/>
</button>
);
})}
</div>
<div style={{textAlign:"center",marginTop:8,fontSize:12,color:selDate===TODAY?C.brand:C.inkTertiary,fontWeight:500}}>
{selDate===TODAY?"היום":dateObj(selDate).toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"})}
</div>
</div>
);
}

function MonthCal({calYear,calMonth,data,selDate,setModalDay,setCalYear,setCalMonth}){
const grid=getMonthGrid(calYear,calMonth);
const calMDays=grid.filter(Boolean);
const cmActive=calMDays.filter(d=>data.workDays[d]?.isActive).length;
const cmTips=calMDays.reduce((s,d)=>s+(data.workDays[d]?.tips||0),0);
const cmBonus=calMDays.reduce((s,d)=>s+(data.workDays[d]?.bonus||0),0);
const cmComm=data.upsells.filter(u=>calMDays.includes(u.date)&&(u.status==="paid"||u.status==="deferred_monthly")).reduce((s,u)=>s+(u.commission||0),0);
const cmTotal=cmActive*BASE+cmTips+cmBonus+cmComm;
const prevMo=()=>{if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1);};
const _todayYM=_getYearMonth(new Date());
const canNext=calYear<_todayYM.year||(calYear===_todayYM.year&&calMonth<_todayYM.month);
const nextMo=()=>{if(!canNext)return;if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1);};
return(
<div style={{...card(),padding:0,overflow:"hidden"}}>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
<button onClick={prevMo} style={{...BTNI(36),background:C.surfaceAlt,border:"none",color:C.inkSecondary}}><Icon name="chevronRight" size={16} strokeWidth={2.2}/></button>
<div style={{fontSize:15,fontWeight:700,color:C.navy}}>{MONTH_HEB[calMonth]} {calYear}</div>
<button onClick={nextMo} style={{...BTNI(36),background:C.surfaceAlt,border:"none",color:canNext?C.inkSecondary:C.inkQuaternary,opacity:canNext?1:0.4,cursor:canNext?"pointer":"default"}}><Icon name="chevronLeft" size={16} strokeWidth={2.2}/></button>
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
style={{background:isSel?C.blue:act?C.greenBg:isTod?"#EFF6FF":C.surface,
border:`1.5px solid ${isSel?C.blue:act?C.greenBdr:isTod?C.blue+"44":C.border}`,
borderRadius:10,padding:"6px 2px",cursor:fut?"default":"pointer",
display:"flex",flexDirection:"column",alignItems:"center",gap:2,minHeight:52,opacity:fut?0.25:1}}>
<span style={{fontSize:13,fontWeight:isTod?800:600,color:isSel?"#fff":act?C.green:fut?C.disabled:isTod?C.blue:C.navy}}>{Number(d.split("-")[2])}</span>
<div style={{display:"flex",gap:2,justifyContent:"center",flexWrap:"wrap"}}>
{act&&<span style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.8)":C.green}}/>}
{(wd?.tips||0)>0&&<span style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.6)":C.amber}}/>}
{ups.length>0&&<span style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.6)":C.blue}}/>}
</div>
</button>
);
})}
</div>
<div style={{borderTop:`1px solid ${C.border}`,padding:"12px 16px",background:C.surface,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
<MStat label="ימי עבודה" val={cmActive} color={C.green}/>
<MStat label="טיפים" val={fmt(cmTips)} color={C.amber}/>
<MStat label='סה"כ חודש' val={fmt(cmTotal)} color={C.navy}/>
</div>
</div>
);
}

function DayModal({modalDay,setModalDay,data,goTo,setTab}){
if(!modalDay)return null;
const wd=data.workDays[modalDay]||{};
const ups=data.upsells.filter(u=>u.date===modalDay);
const comm=ups.filter(u=>u.status!=="pending").reduce((s,u)=>s+(u.commission||0),0);
const dayTotal=(wd.isActive?BASE:0)+(wd.tips||0)+(wd.bonus||0)+comm;
return(
<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
<div onClick={()=>setModalDay(null)} style={{position:"absolute",inset:0,background:C.overlay}}/>
<div className="modal-sheet" style={{position:"relative",background:C.white,borderRadius:"24px 24px 0 0",maxHeight:"80vh",overflowY:"auto",overscrollBehavior:"contain"}}>
<div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}><div style={{width:36,height:4,borderRadius:2,background:C.border}}/></div>
<div style={{padding:"8px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
<div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:4}}>{dateObj(modalDay).toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div style={{fontSize:28,fontWeight:900,color:C.navy}}>{fmt(dayTotal)}</div>
<div style={{background:wd.isActive?C.greenBg:C.surfaceAlt,border:`1px solid ${wd.isActive?C.greenBdr:C.border}`,borderRadius:20,padding:"4px 12px",fontSize:13,fontWeight:700,color:wd.isActive?C.green:C.muted}}>
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
<div style={{display:"flex",gap:8,marginTop:20,marginBottom:"calc(24px + env(safe-area-inset-bottom))"}}>

<button onClick={()=>{goTo(modalDay);setModalDay(null);setTab("field");}} style={{...BTNP,flex:2,padding:13,fontSize:14}}>עבור ליום זה</button>
<button onClick={()=>setModalDay(null)} style={{...BTNS,flex:1,padding:13,fontSize:14}}>סגור</button>
</div>
</div>
</div>
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
// P1-3: timezone-aware initial calendar position
const [calYear,setCalYear]=useState(()=>_getYearMonth(new Date()).year);
const [calMonth,setCalMonth]=useState(()=>_getYearMonth(new Date()).month);
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
const [deleteConfirmId,setDeleteConfirmId]=useState(null);
const [chipMenuId,setChipMenuId]=useState(null);
const [paidConfirmId,setPaidConfirmId]=useState(null);
const [modalDay,setModalDay]=useState(null);
const [showPrivacy,setShowPrivacy]=useState(false);
// P1-8: busy state למניעת double-submit. ערך = id של הפעולה הפעילה (או "global")
const [busy,setBusy]=useState(null);
const [showSettings,setShowSettings]=useState(false);
const [deleteAccountStep,setDeleteAccountStep]=useState(0); // 0=closed, 1=confirm, 2=type-confirm
// P1-7: localStorage לא תמיד זמין (iOS Safari Private, Mobile Safari quotaExceeded וכו')
const safeLS={
  get:(k)=>{try{return localStorage.getItem(k);}catch{return null;}},
  set:(k,v)=>{try{localStorage.setItem(k,v);return true;}catch{return false;}}
};
const [cookieConsent,setCookieConsent]=useState(()=>!!safeLS.get("cookieConsent"));
const acceptCookies=()=>{safeLS.set("cookieConsent","1");setCookieConsent(true);};

useEffect(()=>{
supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthLoading(false);});
const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>setSession(session));
return()=>subscription.unsubscribe();
},[]);

useEffect(()=>{
if(!session)return;
const load=async()=>{
setLoading(true);
const[wdRes,upRes]=await Promise.all([
dbOp(supabase.from("work_days").select("*").eq("user_id",session.user.id)),
dbOp(supabase.from("upsells").select("*").eq("user_id",session.user.id).is("deleted_at",null).order("created_at",{ascending:false}))
]);
// אם session פג / JWT לא תקף — לכוף sign-out כדי שהמשתמש יחזור ל-AuthScreen
if(!wdRes.ok||!upRes.ok){
const msg=(wdRes.error?.message||upRes.error?.message||"").toLowerCase();
if(msg.includes("jwt")||msg.includes("expired")||msg.includes("invalid")||msg.includes("not authenticated")){
await supabase.auth.signOut();
setLoading(false);
return;
}
flash("⚠️ שגיאה בטעינה — בדוק חיבור לאינטרנט");
setLoading(false);
return;
}
const workDays={};
(wdRes.data||[]).forEach(r=>{workDays[r.date]={isActive:r.is_active,tips:r.tips,cashFromClients:r.cash_from_clients,bonus:r.bonus};});
const upsells=(upRes.data||[]).map(r=>({id:r.id,date:r.date,name:r.name,type:r.type,status:r.status,address:r.address,phone:r.phone,amount:r.amount,commission:r.commission,paid_at:r.paid_at,deferred_until:r.deferred_until,deleted_at:r.deleted_at}));
setData({workDays,upsells});
setLoading(false);
};
load();
},[session]);

useEffect(()=>{
if(!window.visualViewport)return;
const onViewportResize=()=>{
const vv=window.visualViewport;
if(vv.height>=window.innerHeight*0.85){
window.scrollTo(0,0);
document.documentElement.scrollTop=0;
document.body.scrollTop=0;
const root=document.getElementById("root");
if(root)root.scrollTop=Math.max(0,root.scrollTop);
}
};
window.visualViewport.addEventListener("resize",onViewportResize);
return()=>window.visualViewport.removeEventListener("resize",onViewportResize);
},[]);

const flash=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),2000); if(msg.startsWith("⚠️")) haptics.warning(); else if(msg.startsWith("✅")||msg.startsWith("🗑")||msg.startsWith("📅")||msg.startsWith("⏰")) haptics.light();};
const goTo=useCallback((d)=>{setSelDate(d);setShowForm(false);setEditMode(null);setTipIn("");setCashIn("");setBonusIn("");},[]);

const upsWD=async(date,fields)=>{
const merged={...(data.workDays[date]||{isActive:false,tips:0,cashFromClients:0,bonus:0}),...fields};
const res=await dbOp(supabase.from("work_days").upsert({user_id:session.user.id,date,is_active:merged.isActive||false,tips:merged.tips||0,cash_from_clients:merged.cashFromClients||0,bonus:merged.bonus||0},{onConflict:"user_id,date"}));
if(!res.ok){flash("⚠️ שגיאה בשמירה — נסה שוב");return;}
setData(d=>({...d,workDays:{...d.workDays,[date]:merged}}));
};

const selDay=data.workDays[selDate]||{isActive:false,tips:0,cashFromClients:0,bonus:0};
const selWk=getWeekOf(selDate);
// P1-3: parse YYYY-MM-DD ישירות במקום .getFullYear()/.getMonth() שתלויים ב-timezone של הדפדפן
const [_selY,_selM]=selDate.split("-").map(Number);
const selMDays=getMonthGrid(_selY,_selM-1).filter(Boolean);

// P0-1: מחזור מסירה שלישי–שני
const deliveryTuesday=getDeliveryTuesdayOf(selDate);
const deliveryCycle=getDeliveryCycle(deliveryTuesday);

const wkActive=selWk.filter(d=>data.workDays[d]?.isActive).length;
const wkTips=selWk.reduce((s,d)=>s+(data.workDays[d]?.tips||0),0);
const wkBonus=selWk.reduce((s,d)=>s+(data.workDays[d]?.bonus||0),0);
const wkComm=data.upsells.filter(u=>selWk.includes(u.date)&&u.status==="paid").reduce((s,u)=>s+(u.commission||0),0);
const wkTotal=wkActive*BASE+wkTips+wkBonus+wkComm;
// P0-1: wkCash על פי מחזור שלישי–שני, לא שבוע קלנדרי
const wkCash=deliveryCycle.reduce((s,d)=>s+(data.workDays[d]?.cashFromClients||0),0);
const moActive=selMDays.filter(d=>data.workDays[d]?.isActive).length;
const moTips=selMDays.reduce((s,d)=>s+(data.workDays[d]?.tips||0),0);
const moBonus=selMDays.reduce((s,d)=>s+(data.workDays[d]?.bonus||0),0);
// moComm: paid + deferred_monthly (עמלות שנדחו לחישוב חודשי)
const moComm=data.upsells.filter(u=>selMDays.includes(u.date)&&(u.status==="paid"||u.status==="deferred_monthly")).reduce((s,u)=>s+(u.commission||0),0);
const moTotal=moActive*BASE+moTips+moBonus+moComm;
// P0-2: pendingComm מוגבל למחזור הנוכחי בלבד
const pendingComm=data.upsells.filter(u=>
  (deliveryCycle.includes(u.date)&&(u.status==="done"||u.status==="confirmed"))
  ||(u.status==="deferred_tuesday"&&u.deferred_until===deliveryTuesday)
).reduce((s,u)=>s+(u.commission||0),0);
const tuesdayNet=wkCash-pendingComm;
const pendingRefs=data.upsells.filter(u=>u.type==="referral"&&u.status==="pending");
const selUpsells=data.upsells.filter(u=>u.date===selDate);
const chipLabel=tab==="field"?`${wkActive} ימים השבוע · ${fmt(wkTotal)}`:tab==="summary"?`${MONTH_HEB[_selM-1]} · ${fmt(moTotal)}`:`שבוע · ${fmt(wkTotal)}`;
const chipColor=wkActive>0?{bg:C.greenBg,border:C.greenBdr,text:C.green}:{bg:C.surfaceAlt,border:C.border,text:C.muted};

const toggleActive=()=>{haptics.medium();upsWD(selDate,{...selDay,isActive:!selDay.isActive});};

// P1-1: increment אטומי דרך RPC — מונע race condition כשהמשתמש פתוח בכמה מכשירים
async function incrementField(date, field, delta) {
  const res = await dbOp(supabase.rpc("increment_work_day", { p_date: date, p_field: field, p_delta: delta }));
  if (!res.ok) return null;
  const row = res.data;
  if (!row) return null;
  return { isActive: row.is_active, tips: Number(row.tips), cashFromClients: Number(row.cash_from_clients), bonus: Number(row.bonus) };
}

const addTip=async()=>{
  const v=parseAmount(tipIn,99999);
  if(v===null){if(tipIn.trim())flash("⚠️ סכום לא חוקי");return;}
  const merged=await incrementField(selDate,"tips",v);
  if(!merged){flash("⚠️ שגיאה בשמירה — נסה שוב");return;}
  setData(d=>({...d,workDays:{...d.workDays,[selDate]:merged}}));
  setTipIn("");flash("✅ טיפ נוסף");
};
const addCash=async()=>{
  const v=parseAmount(cashIn,999999);
  if(v===null){if(cashIn.trim())flash("⚠️ סכום לא חוקי");return;}
  const merged=await incrementField(selDate,"cash_from_clients",v);
  if(!merged){flash("⚠️ שגיאה בשמירה — נסה שוב");return;}
  setData(d=>({...d,workDays:{...d.workDays,[selDate]:merged}}));
  setCashIn("");flash("✅ מזומן נוסף");
};
const addBonus=async()=>{
  const v=parseAmount(bonusIn,99999);
  if(v===null){if(bonusIn.trim())flash("⚠️ סכום לא חוקי");return;}
  const merged=await incrementField(selDate,"bonus",v);
  if(!merged){flash("⚠️ שגיאה בשמירה — נסה שוב");return;}
  setData(d=>({...d,workDays:{...d.workDays,[selDate]:merged}}));
  setBonusIn("");flash("✅ בונוס נוסף");
};
const saveEdit=()=>{
const MAX=editMode==="cash"?999999:99999;
const v=parseAmount(editVal,MAX);
if(v===null){flash("⚠️ סכום לא חוקי");return;}
const field=editMode==="tip"?"tips":editMode==="cash"?"cashFromClients":"bonus";
upsWD(selDate,{...selDay,[field]:v});setEditMode(null);flash("✅ עודכן");
};

const addUpsell=async()=>{
if(busy)return; // P1-8: מניעת double-submit
const iso=form.type==="onsite";
if(iso&&(!form.address.trim()||!form.amount))return;
if(!iso&&!form.phone.trim())return;
let amt=0;
if(iso){
  // P1-4: ולידציה — סכום אפסייל בין 1 ל-999999
  const parsed=parseAmount(form.amount,999999);
  if(parsed===null){flash("⚠️ סכום לא חוקי");return;}
  amt=parsed;
}
setBusy("addUpsell");
const newUp={user_id:session.user.id,date:selDate,name:form.name.trim(),type:form.type,status:"pending",address:iso?form.address.trim():null,phone:!iso?form.phone.trim():null,amount:amt,commission:amt*CR};
const res=await dbOp(supabase.from("upsells").insert(newUp).select().single());
setBusy(null);
if(!res.ok){flash("⚠️ שגיאה בהוספה — נסה שוב");return;}
const ins=res.data;
if(ins){const u={id:ins.id,date:ins.date,name:ins.name,type:ins.type,status:ins.status,address:ins.address,phone:ins.phone,amount:ins.amount,commission:ins.commission};setData(d=>({...d,upsells:[u,...d.upsells]}));}
setForm({name:"",address:"",phone:"",amount:"",type:"onsite"});setShowForm(false);flash("✅ נוספה הגדלה");
};

// P0-3: pending→done בלבד — done→paid דורש אישור מפורש. P1-8: busy למניעת double-tap
const advOnsite=async(id)=>{
if(busy)return;
const u=data.upsells.find(u=>u.id===id);if(u.status!=="pending")return;
setBusy(id);
const res=await dbOp(supabase.from("upsells").update({status:"done"}).eq("id",id));
setBusy(null);
if(!res.ok){flash("⚠️ שגיאה — נסה שוב");return;}
setData(d=>({...d,upsells:d.upsells.map(u=>u.id!==id?u:{...u,status:"done"})}));setChipMenuId(null);
};
const startCnf=(id)=>{setConfirmId(id);setConfirmAmt("");setChipMenuId(null);};
const submitCnf=async()=>{
if(busy)return;
// P1-4: ולידציה — סכום אישור בין 1 ל-999999
const a=parseAmount(confirmAmt,999999);
if(a===null){flash("⚠️ סכום לא חוקי");return;}
const c=a*CR;
setBusy(confirmId);
const res=await dbOp(supabase.from("upsells").update({status:"confirmed",amount:a,commission:c}).eq("id",confirmId));
setBusy(null);
if(!res.ok){flash("⚠️ שגיאה באישור — נסה שוב");return;}
setData(d=>({...d,upsells:d.upsells.map(u=>u.id!==confirmId?u:{...u,status:"confirmed",amount:a,commission:c})}));setConfirmId(null);flash("✅ אושר");
};
// P0-3: מחיקה רכה (soft delete) עם אישור שני-שלב
const delUp=async(id)=>{
if(busy)return;
if(deleteConfirmId!==id){setDeleteConfirmId(id);return;}
setBusy(id);
const now=new Date().toISOString();
const res=await dbOp(supabase.from("upsells").update({deleted_at:now}).eq("id",id));
setBusy(null);
if(!res.ok){flash("⚠️ שגיאה במחיקה — נסה שוב");return;}
setData(d=>({...d,upsells:d.upsells.filter(u=>u.id!==id)}));
setDeleteConfirmId(null);flash("🗑 נמחק");
};
// paid דרך אישור מפורש בלבד (כל המסלולים)
const requestPaid=(id)=>{setChipMenuId(null);setPaidConfirmId(id);};
const executePaid=async(id)=>{
if(busy)return;
setBusy(id);
const now=new Date().toISOString();
const res=await dbOp(supabase.from("upsells").update({status:"paid",paid_at:now}).eq("id",id));
setBusy(null);
if(!res.ok){flash("⚠️ שגיאה בסימון כשולם — נסה שוב");return;}
setData(d=>({...d,upsells:d.upsells.map(u=>u.id!==id?u:{...u,status:"paid",paid_at:now})}));setPaidConfirmId(null);haptics.success();flash("✅ שולם");
};
const deferMonthly=async(id)=>{
if(busy)return;
setBusy(id);
const res=await dbOp(supabase.from("upsells").update({status:"deferred_monthly"}).eq("id",id));
setBusy(null);
if(!res.ok){flash("⚠️ שגיאה בדחייה — נסה שוב");return;}
setData(d=>({...d,upsells:d.upsells.map(u=>u.id!==id?u:{...u,status:"deferred_monthly"})}));setChipMenuId(null);flash("📅 נדחה לחישוב חודשי");
};
const deferTuesday=async(id)=>{
if(busy)return;
setBusy(id);
const nextTue=getDeliveryTuesdayOf(shift(deliveryTuesday,1));
const res=await dbOp(supabase.from("upsells").update({status:"deferred_tuesday",deferred_until:nextTue}).eq("id",id));
setBusy(null);
if(!res.ok){flash("⚠️ שגיאה בדחייה — נסה שוב");return;}
setData(d=>({...d,upsells:d.upsells.map(u=>u.id!==id?u:{...u,status:"deferred_tuesday",deferred_until:nextTue})}));setChipMenuId(null);flash("⏰ נדחה לשלישי הבא");
};

// P1-2: ייצוא כל הנתונים של המשתמש כקובץ JSON להורדה (GDPR right of access)
const exportMyData=async()=>{
  if(busy)return;
  setBusy("export");
  const [wd,up]=await Promise.all([
    dbOp(supabase.from("work_days").select("*").eq("user_id",session.user.id)),
    dbOp(supabase.from("upsells").select("*").eq("user_id",session.user.id))
  ]);
  setBusy(null);
  if(!wd.ok||!up.ok){flash("⚠️ שגיאה בייצוא — נסה שוב");return;}
  const payload={
    exported_at:new Date().toISOString(),
    user:{id:session.user.id,email:session.user.email},
    work_days:wd.data||[],
    upsells:up.data||[],
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`karisham-export-${TODAY}.json`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  flash("✅ הקובץ הורד");
};

// P1-2: מחיקת חשבון מלאה — GDPR/Apple compliance
const deleteMyAccount=async()=>{
  if(busy)return;
  setBusy("delete-account");
  const res=await dbOp(supabase.rpc("delete_my_account"));
  if(!res.ok){setBusy(null);flash("⚠️ שגיאה במחיקה — נסה שוב");return;}
  // התנתקות סופית
  await supabase.auth.signOut();
  // ניקוי localStorage
  try{localStorage.clear();}catch{/* ignore */}
  setBusy(null);
  setDeleteAccountStep(0);
  setShowSettings(false);
  // ה-onAuthStateChange יזרוק אותנו ל-AuthScreen
};

const pill=(a,col=C.blue)=>({flex:1,background:a?col:C.surface,border:`1.5px solid ${a?col:C.border}`,borderRadius:10,padding:"10px",fontSize:14,fontWeight:700,color:a?"#fff":C.sub,cursor:"pointer",transition:TRANS.btn,WebkitTapHighlightColor:"transparent"});
const upProps={onAdvanceOnsite:advOnsite,onStartConfirm:startCnf,onDelete:delUp,confirmId,confirmAmt,setConfirmAmt,onSubmitCnf:submitCnf,onCancelCnf:()=>setConfirmId(null),
deleteConfirmId,onCancelDelete:()=>setDeleteConfirmId(null),
chipMenuId,setChipMenuId,paidConfirmId,onRequestPaid:requestPaid,onExecutePaid:executePaid,onCancelPaid:()=>setPaidConfirmId(null),
onDeferMonthly:deferMonthly,onDeferTuesday:deferTuesday};

const renderField=()=>(
<div style={{paddingTop:16,paddingBottom:"calc(49px + env(safe-area-inset-bottom) + 8px)",minHeight:"calc(100dvh - 83px - env(safe-area-inset-top) - 120px - 49px - env(safe-area-inset-bottom))"}}>
<div style={{margin:"0 16px 16px"}}>
{selDay.isActive?(
<div onClick={toggleActive} style={{background:C.success,borderRadius:R.l,padding:"20px 22px",boxShadow:"0 8px 24px rgba(52,199,89,0.32)",cursor:"pointer",userSelect:"none",position:"relative",overflow:"hidden"}}>
<div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
<div style={{flex:1,minWidth:0}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
<div style={{width:24,height:24,borderRadius:"50%",background:"rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><Icon name="check" size={16} strokeWidth={3}/></div>
<div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.95)",letterSpacing:"0.02em"}}>עבדתי היום</div>
</div>
<div style={{fontSize:38,fontWeight:700,color:"#fff",letterSpacing:"-0.03em",lineHeight:1}}>{fmt(BASE)}</div>
<div style={{fontSize:12,color:"rgba(255,255,255,0.78)",marginTop:6,fontWeight:500}}>שכר בסיס · הקש לביטול</div>
</div>
</div>
</div>
):(
<button onClick={toggleActive} style={{width:"100%",background:C.brand,border:"none",borderRadius:R.l,padding:"22px 24px",boxShadow:"0 8px 24px rgba(0,122,255,0.32)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,WebkitTapHighlightColor:"transparent",color:"#fff"}}>
<div style={{textAlign:"right",flex:1,minWidth:0}}>
<div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.85)",letterSpacing:"0.02em",marginBottom:6}}>שכר בסיס</div>
<div style={{fontSize:22,fontWeight:700,color:"#fff",letterSpacing:"-0.01em",lineHeight:1.1}}>התחל יום עבודה</div>
<div style={{fontSize:13,color:"rgba(255,255,255,0.78)",marginTop:6,fontWeight:500}}>{fmt(BASE)} כשמסמנים</div>
</div>
<div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff"}}><Icon name="play2" size={18}/></div>
</button>
)}
</div>
<div style={{margin:"0 16px"}}>
<AmountRow label="טיפים במזומן" total={selDay.tips||0} addVal={tipIn} setAdd={setTipIn} onAdd={addTip} mode="tip" color={C.amber} borderColor={C.amberBdr} bgColor={C.amberBg} editMode={editMode} editVal={editVal} setEditMode={setEditMode} setEditVal={setEditVal} saveEdit={saveEdit}/>
<AmountRow label="מזומן מלקוחות לחברה" total={selDay.cashFromClients||0} addVal={cashIn} setAdd={setCashIn} onAdd={addCash} mode="cash" editMode={editMode} editVal={editVal} setEditMode={setEditMode} setEditVal={setEditVal} saveEdit={saveEdit}/>
{isTue(selDate)&&<AmountRow label="🎁 בונוס מהחברה" total={selDay.bonus||0} addVal={bonusIn} setAdd={setBonusIn} onAdd={addBonus} mode="bonus" color={C.purple} borderColor={C.purpleBdr} bgColor={C.purpleBg} editMode={editMode} editVal={editVal} setEditMode={setEditMode} setEditVal={setEditVal} saveEdit={saveEdit}/>}
</div>
<div style={{margin:"0 16px 12px"}}>
{!showForm?(
<button onClick={()=>{haptics.light();setShowForm(true);}} style={{...BTNP,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
<Icon name="plus" size={20} strokeWidth={2.5} color="#fff"/>
<span>הוסף הגדלה</span>
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
<input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={INP}/>
{form.amount&&parseFloat(form.amount)>0&&<div style={{marginTop:8,background:C.greenBg,border:`1px solid ${C.greenBdr}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:C.green,fontWeight:700}}>עמלה: {fmt(parseFloat(form.amount)*CR)}</div>}
</div>
</>}
{form.type==="referral"&&<>
<div style={{marginBottom:12}}><label style={LBL}>טלפון *</label><input type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={INP} placeholder="050-0000000" dir="ltr"/></div>
<div style={{background:C.amberBg,border:`1px solid ${C.amberBdr}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:C.amber,marginBottom:16}}>📞 מסור למנהל ביום שלישי</div>
</>}
<div style={{display:"flex",gap:8}}>
<button onClick={addUpsell} disabled={busy==="addUpsell"} style={{...BTNP,flex:2,padding:14,opacity:busy==="addUpsell"?0.6:1}}>{busy==="addUpsell"?"שומר...":"הוסף"}</button>
<button onClick={()=>{setShowForm(false);setForm({name:"",address:"",phone:"",amount:"",type:"onsite"});}} disabled={busy==="addUpsell"} style={{...BTNS,flex:1,padding:14,opacity:busy==="addUpsell"?0.6:1}}>ביטול</button>
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

const renderSummary=()=>{
const allActive=data.upsells.filter(u=>!["paid","deferred_monthly","deferred_tuesday"].includes(u.status));
return(
<div style={{paddingTop:16,paddingBottom:"calc(49px + env(safe-area-inset-bottom) + 8px)",minHeight:"calc(100dvh - 83px - env(safe-area-inset-top) - 46px - env(safe-area-inset-bottom))"}}>
<div style={{background:C.ink,borderRadius:R.l,padding:"22px 24px",margin:"0 16px 16px",boxShadow:"0 8px 24px rgba(0,0,0,0.16)"}}>
<div style={{fontSize:12,color:"rgba(255,255,255,0.65)",fontWeight:500,letterSpacing:"0.04em",marginBottom:8}}>
סך הכל בחודש · {MONTH_HEB[_selM-1]} {_selY}
</div>
<div style={{fontSize:42,fontWeight:700,color:"#fff",lineHeight:1,letterSpacing:"-0.03em"}}>{fmt(moTotal)}</div>
<div style={{marginTop:20,display:"flex",flexDirection:"column",gap:2,borderTop:"0.5px solid rgba(255,255,255,0.12)",paddingTop:16}}>
<HR label={`שכר בסיס · ${moActive} ימים`} val={fmt(moActive*BASE)}/>
<HR label="טיפים" val={fmt(moTips)}/>
<HR label="עמלות ששולמו" val={fmt(moComm)}/>
{moBonus>0&&<HR label="בונוסים" val={fmt(moBonus)} hi/>}
</div>
</div>
<div style={{margin:"0 16px 12px"}}><MonthCal calYear={calYear} calMonth={calMonth} data={data} selDate={selDate} setModalDay={setModalDay} setCalYear={setCalYear} setCalMonth={setCalMonth}/></div>
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
// P0-1: תצוגת מחזור שלישי–שני (לא שבוע קלנדרי)
const cycleStart=dateObj(deliveryCycle[0]),cycleEnd=dateObj(deliveryCycle[6]);
const cycleLabel=`${cycleStart.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}–${cycleEnd.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}`;
const deliveryLbl=deliveryTuesday===TODAY?"מסירה היום ✓":`מסירה ${dateObj(deliveryTuesday).toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}`;
const canFwd=shift(deliveryTuesday,7)<=TODAY;
// עמלות הניתנות לניהול (done/confirmed במחזור + deferred_tuesday לשלישי זה)
const cycleCommUpsells=data.upsells.filter(u=>
  (deliveryCycle.includes(u.date)&&(u.status==="done"||u.status==="confirmed"))
  ||(u.status==="deferred_tuesday"&&u.deferred_until===deliveryTuesday)
);
return(
<div style={{paddingTop:16,paddingBottom:"calc(49px + env(safe-area-inset-bottom) + 8px)",minHeight:"calc(100dvh - 83px - env(safe-area-inset-top) - 46px - env(safe-area-inset-bottom))"}}>
<div style={{margin:"0 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",background:C.white,borderRadius:14,padding:"12px 16px",boxShadow:C.shSm}}>
<button onClick={()=>goTo(shift(deliveryTuesday,-7))} style={{...BTNI(36),background:C.surfaceAlt,border:"none",color:C.inkSecondary}}><Icon name="chevronRight" size={16} strokeWidth={2.2}/></button>
<div style={{textAlign:"center"}}>
<div style={{fontSize:11,color:deliveryTuesday===TODAY?C.green:C.muted,fontWeight:700}}>{deliveryLbl}</div>
<div style={{fontSize:14,fontWeight:700,color:C.navy}}>{cycleLabel}</div>
</div>
<button onClick={()=>{if(canFwd)goTo(shift(deliveryTuesday,7));}} style={{...BTNI(36),background:canFwd?C.surfaceAlt:"transparent",border:"none",color:canFwd?C.inkSecondary:C.inkQuaternary,cursor:canFwd?"pointer":"default"}}><Icon name="chevronLeft" size={16} strokeWidth={2.2}/></button>
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
<label style={LBL}>התחשבנות מחזור זה</label>
<TRow label="מזומן שגבית מלקוחות" val={fmt(wkCash)} color={C.red} note="מסור למחסן"/>
<div style={{height:1,background:C.border,margin:"16px 0"}}/>
<TRow label="עמלות שמגיעות לך" val={`(${fmt(pendingComm)})`} color={C.green}/>
<div style={{height:2,background:C.navy,margin:"16px 0",borderRadius:1}}/>
<div>
<label style={LBL}>{tuesdayNet>=0?"נטו — אתה מוסר למחסן":"נטו — המחסן חייב לך"}</label>
<div style={{fontSize:40,fontWeight:900,color:tuesdayNet>=0?C.red:C.green,lineHeight:1}}>{fmt(Math.abs(tuesdayNet))}</div>
</div>
</div>
{cycleCommUpsells.length>0&&(
<div style={{...card(),margin:"0 16px 12px"}}>
<label style={{...LBL,color:C.green}}>עמלות במחזור זה — ניהול ({cycleCommUpsells.length})</label>
{cycleCommUpsells.map(u=><URow key={u.id} u={u} {...upProps} showDate/>)}
</div>
)}
<div style={{...card(),margin:"0 16px"}}>
<label style={LBL}>פירוט ימי המחזור</label>
{deliveryCycle.map(d=>{
const wd=data.workDays[d];if(!wd?.isActive)return null;
const comm=data.upsells.filter(u=>u.date===d&&u.status==="paid").reduce((s,u)=>s+(u.commission||0),0);
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
{deliveryCycle.filter(d=>data.workDays[d]?.isActive).length===0&&<div style={{color:C.muted,fontSize:14,textAlign:"center",padding:16}}>אין ימי עבודה במחזור זה</div>}
</div>
</div>
);
};

const overlays=(<>
{chipMenuId&&<div onClick={()=>setChipMenuId(null)} style={{position:"fixed",inset:0,zIndex:98,WebkitTapHighlightColor:"transparent"}}/>}
{!cookieConsent&&<CookieBanner onAccept={acceptCookies} onOpenPrivacy={()=>setShowPrivacy(true)}/>}
{showPrivacy&&<PrivacyModal onClose={()=>setShowPrivacy(false)}/>}
{showSettings&&(
  <div style={{position:"fixed",inset:0,background:C.overlay,zIndex:600,display:"flex",alignItems:"flex-end"}} onClick={()=>{setShowSettings(false);setDeleteAccountStep(0);}}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.white,width:"100%",maxHeight:"85dvh",borderRadius:"20px 20px 0 0",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{fontSize:16,fontWeight:800,color:C.navy}}>הגדרות</div>
        <button onClick={()=>{setShowSettings(false);setDeleteAccountStep(0);}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.muted,lineHeight:1,padding:0,minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
      <div style={{padding:"20px",overflowY:"auto",flex:1,direction:"rtl",paddingBottom:"calc(20px + env(safe-area-inset-bottom))"}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:600,letterSpacing:"0.06em"}}>חשבון</div>
        <div style={{fontSize:14,color:C.navy,marginBottom:24,fontWeight:600,direction:"ltr",textAlign:"right"}}>{session?.user?.email}</div>

        <div style={{...LBL,marginBottom:8}}>פעולות פרטיות</div>

        <button onClick={exportMyData} disabled={busy==="export"} style={{...BTNS,width:"100%",marginBottom:10,opacity:busy==="export"?0.6:1,textAlign:"right",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>📥 הורד את כל הנתונים שלי</span>
          <span style={{fontSize:12,color:C.muted,fontWeight:500}}>{busy==="export"?"מכין...":"JSON"}</span>
        </button>
        <div style={{fontSize:11,color:C.muted,marginBottom:20,lineHeight:1.5}}>קובץ עם כל ימי העבודה, אפסיילים, ופרטי חשבון. אפשר לפתוח בכל עורך טקסט.</div>

        <button onClick={()=>setShowPrivacy(true)} style={{...BTNS,width:"100%",marginBottom:20,textAlign:"right"}}>
          📋 מדיניות פרטיות
        </button>

        <div style={{height:1,background:C.border,margin:"20px 0"}}/>

        <div style={{...LBL,marginBottom:8,color:C.red}}>אזור מסוכן</div>

        {deleteAccountStep===0&&(
          <button onClick={()=>setDeleteAccountStep(1)} style={{background:"#FEF2F2",border:`1.5px solid #FECACA`,color:C.red,borderRadius:12,padding:"14px 20px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",textAlign:"right"}}>
            🗑 מחק את החשבון שלי
          </button>
        )}
        {deleteAccountStep===1&&(
          <div style={{background:"#FEF2F2",border:`1.5px solid #FECACA`,borderRadius:12,padding:16}}>
            <div style={{fontSize:14,color:C.red,fontWeight:700,marginBottom:8}}>⚠️ פעולה בלתי הפיכה</div>
            <div style={{fontSize:13,color:C.navy,marginBottom:14,lineHeight:1.6}}>מחיקת חשבון תמחק לצמיתות: כל ימי העבודה, אפסיילים, הפניות, וגם את החשבון עצמו. <strong>אין אפשרות לשחזר.</strong> מומלץ להוריד את הנתונים קודם.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDeleteAccountStep(2)} style={{background:C.red,color:"#fff",border:"none",borderRadius:10,padding:"12px 20px",fontWeight:700,cursor:"pointer",flex:1,fontSize:14}}>הבנתי, המשך</button>
              <button onClick={()=>setDeleteAccountStep(0)} style={{background:C.surfaceAlt,color:C.muted,border:"none",borderRadius:10,padding:"12px 16px",cursor:"pointer",fontSize:14}}>ביטול</button>
            </div>
          </div>
        )}
        {deleteAccountStep===2&&(
          <div style={{background:"#FEF2F2",border:`1.5px solid ${C.red}`,borderRadius:12,padding:16}}>
            <div style={{fontSize:14,color:C.red,fontWeight:700,marginBottom:10}}>אישור אחרון לפני מחיקה</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:14,lineHeight:1.6}}>לחיצה על "מחק כעת" תמחק לתמיד את החשבון <strong style={{color:C.navy}}>{session?.user?.email}</strong> וכל הנתונים שלך.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={deleteMyAccount} disabled={busy==="delete-account"} style={{background:C.red,color:"#fff",border:"none",borderRadius:10,padding:"12px 20px",fontWeight:700,cursor:"pointer",flex:1,fontSize:14,opacity:busy==="delete-account"?0.6:1}}>{busy==="delete-account"?"מוחק...":"🗑 מחק כעת"}</button>
              <button onClick={()=>setDeleteAccountStep(0)} disabled={busy==="delete-account"} style={{background:C.surfaceAlt,color:C.muted,border:"none",borderRadius:10,padding:"12px 16px",cursor:"pointer",fontSize:14}}>ביטול</button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}
</>);

if(authLoading)return<div style={{background:C.white,minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>⏳</div>;
if(!session)return<>{<AuthScreen onPrivacy={()=>setShowPrivacy(true)}/>}{overlays}</>;
if(loading)return<div style={{background:C.white,minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>⏳</div>;

const TABS=[
  {id:"field",icon:"bolt",label:"שטח"},
  {id:"summary",icon:"chart",label:"סיכום"},
  {id:"tuesday",icon:"calendar",label:"שלישי"}
];

return(
<div className="app-shell" style={{background:C.bg,minHeight:"100dvh",color:C.navy,fontFamily:"-apple-system,'Heebo',sans-serif",direction:"rtl",overscrollBehavior:"none",WebkitTextSizeAdjust:"100%"}}>
<div style={{background:`rgba(255,255,255,0.92)`,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:`0.5px solid ${C.border}`,paddingTop:"calc(12px + env(safe-area-inset-top))",paddingBottom:"12px",paddingLeft:"calc(20px + env(safe-area-inset-left))",paddingRight:"calc(20px + env(safe-area-inset-right))",position:"sticky",top:0,zIndex:100}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<img src="/apple-touch-icon.png" style={{width:36,height:36,borderRadius:10,objectFit:"cover",flexShrink:0,boxShadow:"0 2px 6px rgba(0,0,0,0.08)"}}/>
<div>
<div style={{fontSize:17,fontWeight:700,color:C.ink,lineHeight:1.15,letterSpacing:"-0.01em"}}>כרישים בניקיון</div>
<div style={{fontSize:12,color:C.inkTertiary,fontWeight:500,marginTop:2}}>{tab==="field"?"יום עבודה":tab==="summary"?"סיכום חודשי":"מחזור שלישי"}</div>
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<button onClick={()=>setShowSettings(true)} title="הגדרות" style={{background:"transparent",border:"none",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:C.inkSecondary,WebkitTapHighlightColor:"transparent",transition:"color 0.15s ease"}}><Icon name="settings" size={22} strokeWidth={1.8}/></button>
<button onClick={()=>supabase.auth.signOut()} title="יציאה" style={{background:"transparent",border:"none",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:C.inkSecondary,WebkitTapHighlightColor:"transparent",transition:"color 0.15s ease"}}><Icon name="logout" size={22} strokeWidth={1.8}/></button>
</div>
</div>
</div>
{tab==="field"&&<WeekNav selWk={selWk} data={data} selDate={selDate} goTo={goTo}/>}
{toast&&<div style={{position:"fixed",top:"calc(16px + env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",background:"rgba(28,28,30,0.94)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",color:"#fff",borderRadius:R.full,padding:"10px 20px",fontSize:14,fontWeight:600,zIndex:300,whiteSpace:"nowrap",boxShadow:"0 8px 24px rgba(0,0,0,0.18)",animation:"slideUp 0.3s ease-out"}}>{toast}</div>}
<div>
{tab==="field"&&renderField()}
{tab==="summary"&&renderSummary()}
{tab==="tuesday"&&renderTuesday()}
</div>
<div style={{position:"fixed",bottom:0,left:0,right:0,paddingBottom:"env(safe-area-inset-bottom)",background:`rgba(255,255,255,0.92)`,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`0.5px solid ${C.border}`,display:"flex",alignItems:"stretch",zIndex:100,boxSizing:"border-box"}}>
{TABS.map(t=>{
const act=tab===t.id;
return(
<button key={t.id} onClick={()=>{haptics.light();setTab(t.id);}} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"8px 0 8px",WebkitTapHighlightColor:"transparent",color:act?C.brand:C.inkTertiary,transition:"color 0.2s ease"}}>
<Icon name={t.icon} size={26} strokeWidth={act?2.2:1.8}/>
<span style={{fontSize:10,fontWeight:act?600:500,lineHeight:1,letterSpacing:"-0.01em"}}>{t.label}</span>
</button>
);
})}
</div>
<DayModal modalDay={modalDay} setModalDay={setModalDay} data={data} goTo={goTo} setTab={setTab}/>
{overlays}
</div>
);
}
