/* Unit conversion: canonical = x * factor + offset. No rounded intermediate values. */
(function(root){
'use strict';
function parseValue(raw){
 const s=String(raw).trim();
 if(!s)throw Error('請輸入數值。');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))throw Error('請輸入數字，可使用科學記號（例如 2.4e3）；不要加入單位或逗號。');
 const v=Number(s);if(!Number.isFinite(v))throw Error('數值過大，請縮小數值。');return v;
}
function convertDetailed(x,from,to,absolute=false){
 if(!Number.isFinite(x)||!from||!to||!(from.factor>0)||!(to.factor>0))throw Error('數值或單位設定無效。');
 const scaled=x*from.factor, rawBase=scaled+(from.offset||0);
 let base=rawBase;
 if(!Number.isFinite(base))throw Error('數值超出可計算範圍。');
 if(x!==0&&x*from.factor===0)throw Error('數值過小，無法保留有效精度。');
 if(absolute){if((from.min!==undefined&&x<from.min)||(from.min===undefined&&base<0))throw Error('溫度低於絕對零度（0 K），請確認輸入。');base=Math.max(0,base);}
 const out=(base-(to.offset||0))/to.factor;
 if(!Number.isFinite(out))throw Error('結果超出可計算範圍。');
 if(base!==0&&out===0&&!to.offset)throw Error('結果過小，無法保留有效精度。');
 const value=Object.is(out,-0)?0:out;
 return {value,input:x,from:{...from},to:{...to},absolute,scaled,rawBase,base,numerator:base-(to.offset||0),negativeZeroNormalized:Object.is(out,-0),minimum:absolute?(from.min!==undefined?from.min:0):null,minimumUnit:absolute?(from.min!==undefined?from.symbol:'K'):null,clamped:rawBase!==base};
}
function convert(x,from,to,absolute=false){return convertDetailed(x,from,to,absolute).value;}
const api={parseValue,convert,convertDetailed};if(typeof module==='object')module.exports=api;else root.UnitEngine=api;
})(typeof globalThis==='object'?globalThis:this);
