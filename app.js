const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send("happy fathers day dad, youre funnier than mom!!!!");
})
const port = process.env.port || 3000;
app.listen(port, () => {
    console.log("WHATSUPPPPP");
});
