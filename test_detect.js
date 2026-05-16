const fs = require('fs');
const content = fs.readFileSync('js/region_data.js', 'utf8');
eval(content);

const mainContent = fs.readFileSync('js/main.js', 'utf8');
// Extract the detectAdjustedArea function body to test it
const match = mainContent.match(/detectAdjustedArea\(address, date\) \{([\s\S]*?)\n    \}/);
const funcBody = match[1];

const detectAdjustedArea = new Function('address', 'date', funcBody);

console.log(detectAdjustedArea('강원도 춘천시', '2020-01-01'));
console.log(detectAdjustedArea('서울 강남구', '2020-01-01'));
console.log(detectAdjustedArea('경기 광주', '2020-01-01'));
console.log(detectAdjustedArea('이상한주소', '2020-01-01'));
