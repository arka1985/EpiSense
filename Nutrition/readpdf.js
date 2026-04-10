
const fs=require('fs'); const pdf=require('pdf-parse'); pdf(fs.readFileSync('DGI_2024.pdf')).then(d=>console.log(d.text.substring(0,2000))).catch(console.error);
