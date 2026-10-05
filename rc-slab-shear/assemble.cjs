'use strict';
const fs=require('fs'),path=require('path'),p=__dirname;
let s=fs.readFileSync(path.join(p,'template.html'),'utf8');
for(const [key,name] of [['DOCXVENDOR','../vendor/docx/docx-9.6.1.iife.js'],['DOCX','../shared/calculation-docx.js'],['WORD','word-report.js']]) s=s.replace('@@'+key+'@@',()=>fs.readFileSync(path.join(p,name),'utf8'));
fs.writeFileSync(path.join(p,'index.html'),s);
