const ethers = require("ethers");
const crypto = require("crypto");

const id = crypto.randomBytes(32).
    toString("hex");
const privateKey = "0x" + id;
console.log("Private key: ", privateKey);

const wallet = new ethers.Wallet(privateKey);
console.log("Address: " + wallet.address);
