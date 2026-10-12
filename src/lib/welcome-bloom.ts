// Senso's spring engine (Kian's picks of 2026-10-11: five blossoms and the rosebud, src/lib/welcome-spring-art.ts), the motion of the
// gallery's spring demo that he picked from (reports/welcome/gallery.html): lighter than the fall leaves, so slower and with a wider
// sway; a whole blossom twirls slowly as it falls (a full turn every 7–15 s, one way or the other) under a small 3D tilt; the bud is
// heavier: a quarter faster, under half the sway, barely tilting. 20 particles on every load in three depth layers (9 far: small, slow
// and faint; 9 middle; 2 near: larger), random designs, columns, sizes, timings, sway, tilt and twirl, started mid-flight by negative
// delays, so the scene is full on the first frame and no two loads look alike. Reduced motion: ten designs resting low and along the
// sides, nothing moving. Transform and opacity only. The fall, sway and tilt are the shared artwork rules of the public stylesheet
// (`.scene[data-engine]`: wa-fall, wa-sway, wa-flutter); the twirl is set on its own element by this script (wa-spin), so the
// stylesheet is unchanged. In src/lib, outside the stylesheet's sources: no word here can add a rule to it. Nothing is stored.
export const bloomEngineScript = `(function(){var w=document.getElementById('welcome'),s=w&&w.querySelector('.scene[data-engine="bloom"]');if(!s||!s.getAttribute('data-designs'))return;
var D=s.getAttribute('data-designs').split(','),B=(s.getAttribute('data-buds')||'').split(','),Z={S3:1.05,S4:.85,S5:.95,S9:.85};
var L={b:44,far:[9,.42,.6,16,24,.4,.6,8,16,3.6,5.6,.12,3.2,5.5],mid:[9,.65,.9,11,16,.75,.92,14,26,3,4.6,.18,2.6,4.4],near:[2,1,1.3,8.5,12,.88,.96,22,36,2.6,3.8,.24,2.2,3.6]};
var R=function(a,b){return a+Math.random()*(b-a)},r1=function(n){return Math.round(n*10)/10},I=Math.round,h='';
var one=function(l,x,y){var c=L[l],d=D[Math.floor(Math.random()*D.length)],bud=B.indexOf(d)>=0,du=r1(R(c[3],c[4])*(bud?.75:1)),sw=R(c[7],c[8])*(bud?.45:1),fp=r1(R(c[12],c[13])*(bud?1.6:1));
var tw=!bud&&y==null?'<b style="display:block;width:100%;height:100%;will-change:transform;animation:wa-spin '+r1(R(7,15))+'s linear var(--l) infinite'+(Math.random()<.5?' reverse':'')+'">':'';
h+='<i class="p '+l+'" style="--x:'+r1(x*100)+'vw;--s:'+I(L.b*R(c[1],c[2])*(Z[d]||1))+'px;--d:'+du+'s;--l:'+r1(-R(.5,du))+'s;--o:'+I(R(c[5],c[6])*100)/100+';--sw:'+I(sw)+'px;--sp:'+r1(R(c[9],c[10]))+'s;--dr:'+r1(R(-c[11],c[11])*100)+'vw;--rx:'+I(bud?R(4,10):R(12,32))+'deg;--ry:'+I(bud?R(6,14):R(15,38))+'deg;--rz:'+I(bud?R(6,14):R(6,16))+'deg;--fp:'+fp+'s;--dip:'+I(bud?R(1,3):R(4,10))+'px'+(y==null?'':';--y:'+r1(y*100)+'vh;--rs:'+I(R(-60,60))+'deg')+'"><b class="y"><b class="s">'+tw+'<svg class="w" viewBox="0 0 64 64" focusable="false"><use href="#'+d+'"/></svg>'+(tw?'</b>':'')+'</b></b></i>'};
if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){s.className+=' still';var P=[[.08,.86],[.22,.93],[.38,.9],[.56,.95],[.72,.88],[.9,.92],[.05,.3],[.94,.55],[.9,.12],[.12,.6]];for(var i=0;i<P.length;i++)one(i<2?'near':i<6?'mid':'far',P[i][0]+R(-.03,.03),P[i][1]+R(-.03,.03))}
else{for(var k in L)if(k!=='b')for(var j=0;j<L[k][0];j++)one(k,R(.02,.98))}
s.innerHTML=h})();`;
