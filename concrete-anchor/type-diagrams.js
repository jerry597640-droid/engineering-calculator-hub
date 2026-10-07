'use strict';
// Inline SVG: no external assets, product-specific capacities or scale inference.
const ANCHOR_VISUALS={
 bolt:{feature:'擴頭承壓',description:'澆置前定位；埋入端的擴頭以承壓方式傳遞拉力。',focus:'核對有效埋深 hef、擴頭淨承壓面積 Abrg 及端部保護層。'},
 stud:{feature:'錨釘擴頭',description:'錨釘上端銲接於鋼附掛物，埋入端設擴頭。',focus:'核對錨釘材質、有效面積、擴頭尺寸及銲接品質。'},
 hook:{feature:'彎鉤承壓段',description:'預埋 J 型或 L 型螺栓，藉埋入端彎鉤傳遞拉力。',focus:'核對彎鉤有效伸出長度 eh；本工具要求 3da～4.5da。圖中並列 J／L 形狀。'},
 torque:{feature:'膨脹套管／錐體',description:'旋緊螺帽使錐體與套管產生相對位移，建立膨脹錨定。',focus:'核對產品規定安裝扭矩、套管構造、認證拔出強度 Np 及埋深。'},
 displacement:{feature:'打入塞／膨脹區',description:'以規定工具打入或推進內塞，令套管膨脹錨定。',focus:'核對產品規定打入行程及安裝工具，並使用認證報告的有效埋深及 Np。'},
 undercut:{feature:'擴底承壓區',description:'錨定元件與鑽孔擴底部位形成機械咬合。',focus:'核對擴底方式、鑽孔及安裝工具；有效埋深與承載資料依產品認證。'},
 screw:{feature:'咬合螺紋',description:'專用混凝土螺紋錨栓旋入鑽孔，螺紋與孔壁形成機械咬合。',focus:'有效埋深 hef 與安裝深度可能不同，須使用產品認證值及規定孔徑。'},
 adhesive:{feature:'黏結劑握裹層',description:'螺桿植入填有黏結劑的鑽孔，沿埋入段傳遞握裹力。',focus:'核對清孔、養護與溫濕度條件；τcr／τuncr 及持續拉力資料依產品認證。'}
};
function anchorTypeSvg(type){
 const info=ANCHOR_VISUALS[type];if(!info)return '';
 const rod='<rect x="132" y="36" width="16" height="182" rx="2" fill="#98afbf" stroke="#35566e" stroke-width="2"/>';
 const nut='<path d="M122 54h36l5 7-5 7h-36l-5-7z" fill="#7894a9" stroke="#35566e" stroke-width="2"/>';
 const threads=(from,to)=>Array.from({length:Math.floor((to-from)/7)+1},(_,i)=>`<path d="M132 ${from+i*7}l16 -4" stroke="#35566e" stroke-width="1.5"/>`).join('');
 let shape='',target=[160,222],extra='';
 if(type==='bolt')shape=rod+threads(42,68)+nut+'<path d="M116 216h48v13h-48z" fill="#7894a9" stroke="#35566e" stroke-width="2"/>';
 if(type==='stud')shape='<rect x="132" y="82" width="16" height="136" fill="#98afbf" stroke="#35566e" stroke-width="2"/><path d="M116 216h48v13h-48z M125 85l7-9h16l7 9z" fill="#7894a9" stroke="#35566e" stroke-width="2"/>';
 if(type==='hook'){
  shape='<path d="M140 36v166q0 20 20 20q20 0 20-20v-12" fill="none" stroke="#35566e" stroke-width="17"/><path d="M140 36v166q0 20 20 20q20 0 20-20v-12" fill="none" stroke="#98afbf" stroke-width="13"/><path d="M217 36v182h35" fill="none" stroke="#35566e" stroke-width="17"/><path d="M217 36v182h35" fill="none" stroke="#98afbf" stroke-width="13"/>'+threads(42,68)+nut;
  target=[249,216];extra='<text x="159" y="247" text-anchor="middle">J 型</text><text x="232" y="247" text-anchor="middle">L 型</text><path d="M217 232h35 M217 228v8 M252 228v8" stroke="#057a85"/><text x="236" y="266" text-anchor="middle" fill="#057a85">eh</text>';
 }
 if(type==='torque'){
  shape=rod+threads(42,68)+nut+'<path d="M125 158h8l-4 58h-13z M147 158h8l9 58h-13z" fill="#7894a9" stroke="#35566e" stroke-width="2"/><path d="M137 180h6l13 41h-32z" fill="#b8c9d5" stroke="#35566e" stroke-width="2"/>';
  target=[160,201];
 }
 if(type==='displacement'){
  shape=rod+threads(42,68)+nut+'<path d="M122 116h12v102h-20z M146 116h12l8 102h-20z" fill="#7894a9" stroke="#35566e" stroke-width="2"/><path d="M140 147l13 49h-26z" fill="#b8c9d5" stroke="#35566e" stroke-width="2"/><path d="M140 100v33m-5-6 5 6 5-6" fill="none" stroke="#057a85" stroke-width="2"/>';
  target=[158,206];
 }
 if(type==='undercut'){
  shape='<path d="M124 87h32v109l17 23h-66l17-23z" fill="#fff" stroke="#819daf" stroke-width="2"/>'+rod+threads(42,68)+nut+'<path d="M133 185l-23 33h60l-23-33z" fill="#7894a9" stroke="#35566e" stroke-width="2"/>';
  target=[169,215];
 }
 if(type==='screw'){
  shape=rod+threads(42,211)+nut+Array.from({length:9},(_,i)=>`<path d="M126 ${103+i*12}l28 -7v5l-28 7z" fill="#7894a9" stroke="#35566e"/>`).join('');
  target=[154,186];
 }
 if(type==='adhesive'){
  shape='<rect x="122" y="88" width="36" height="139" rx="3" fill="#d4a143" fill-opacity=".5" stroke="#ac791d" stroke-width="2"/>'+rod+threads(42,211)+nut;
  target=[159,183];
 }
 return `<svg class="anchor-type-svg" viewBox="0 0 420 280" role="img" aria-label="${esc(E.TYPES[type])}構造示意圖，${esc(info.feature)}"><title>${esc(E.TYPES[type])}構造示意圖</title><desc>${esc(info.description)} 圖形未按比例繪製，hef 表示有效埋深位置，da 表示公稱直徑。</desc><defs><pattern id="anchorConcrete" width="22" height="20" patternUnits="userSpaceOnUse"><path d="M3 5l3 2 M14 14l3-3" stroke="#b4c7d4" stroke-width="1"/></pattern></defs><rect x="28" y="86" width="246" height="170" rx="4" fill="#e7f0f6"/><rect x="28" y="86" width="246" height="170" fill="url(#anchorConcrete)"/><path d="M28 86h246" stroke="#819daf" stroke-width="2"/><rect x="102" y="72" width="160" height="13" rx="2" fill="#57758c"/>${shape}<g font-family="system-ui,sans-serif" font-size="14" fill="#35566e"><path d="M62 86v132 M56 86h12 M56 218h12" fill="none" stroke="#057a85" stroke-width="1.5"/><text x="53" y="152" transform="rotate(-90 53 152)" text-anchor="middle" fill="#057a85">hef 有效埋深</text><path d="M132 30h16 M132 26v8 M148 26v8" stroke="#057a85"/><text x="140" y="21" text-anchor="middle" fill="#057a85">da</text><path d="M${target[0]} ${target[1]}L286 172h115" fill="none" stroke="#057a85" stroke-width="1.5"/><circle cx="${target[0]}" cy="${target[1]}" r="3" fill="#057a85"/><text x="287" y="161">${esc(info.feature)}</text><text x="287" y="87">混凝土表面</text><text x="35" y="247">混凝土</text>${extra}</g></svg>`;
}
function renderAnchorType(){
 let box=$('anchorTypeVisual');const info=ANCHOR_VISUALS[state.type];if(!box){const field=document.querySelector('[data-field="type"]');if(!field)return;box=document.createElement('div');box.id='anchorTypeVisual';box.className='anchor-type-visual';box.setAttribute('aria-live','polite');box.setAttribute('aria-atomic','true');field.append(box);}
 if(!info){box.innerHTML='';return;}
 box.dataset.type=state.type;
 box.innerHTML=`<div class="anchor-type-heading"><strong>${esc(E.TYPES[state.type])}</strong><span class="anchor-type-badge">${['bolt','stud','hook'].includes(state.type)?'預埋式':'後置式'} · 構造示意</span></div><div class="anchor-type-layout">${anchorTypeSvg(state.type)}<div class="anchor-type-copy"><p>${esc(info.description)}</p><p>${esc(info.focus)}</p></div></div><div class="anchor-type-disclaimer">圖形未按比例繪製；標示為尺寸位置，實際構造及有效埋深依製造圖／產品認證。</div>`;
}

// Keep diagram synchronized with all existing input, example and case-load paths.
const anchorBaseUpdateVisibility=updateVisibility;
updateVisibility=function(){anchorBaseUpdateVisibility();renderAnchorType();};
renderAnchorType();
