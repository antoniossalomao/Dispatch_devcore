const fs=require('fs');const tl=fs.readFileSync('timeline.json','utf8');
fs.writeFileSync('_play.html',fs.readFileSync('index.html','utf8').replace('__TL__',tl));
