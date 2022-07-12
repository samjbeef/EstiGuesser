function revealMessage() {
    alert(JSON.stringify('hello world'));
}
async function revealMessage2() {
    const response = await fetch('http://localhost:3000/sam');
    // console.log(response.body)
    const body = await response.json();
    // console.log(response.body.JSON);
    console.log(body)
    const myNumber = body.myNumber
    document.getElementById('hiddenMessage').innerText = myNumber
}

const EventEmitter = require('events');
var url = 'http://woohoo.com/log'

class Logger extends EventEmitter {
    log(message) {
        console.log(message);

        //Raise an Event
        this.emit('messageLogged', { id: 1, url: 'http://' });
    }
}

module.exports = log;