// encode.js
const fs = require("fs");
const key = fs.readFileSync("./smart-deals-1433d-firebase-adminsdk-fbsvc-00d6fa790d.json", "utf8");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);