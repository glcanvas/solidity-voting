import * as dotenv from "dotenv";
import {HardhatUserConfig, task} from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "solidity-coverage";
import "./tasks/tasks";
import * as process from "process";

dotenv.config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

const config: HardhatUserConfig = {
    solidity: "0.8.0", // compiler version
    networks: { // list of networks with routes and accounts to use
        ropsten: {
            url: "https://ropsten.infura.io/v3/" + process.env.ROPSTEN_KEY,
            accounts:
                process.env.PRIVATE_KEY !== undefined ?
                    [process.env.PRIVATE_KEY] :
                    []
        }
    },
    etherscan: { // private api key to verify deployed contracts on etherscan
        apiKey: process.env.ETHERSCAN_API_KEY
    }
};

export default config;
