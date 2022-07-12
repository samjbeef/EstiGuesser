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
