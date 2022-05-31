import {run} from "hardhat";
import {readFile} from "fs";
import * as util from "util";

/**
 * Verify contract on the EtherScan.
 */
async function verify () {

    const promiseReadFile = util.promisify(readFile);

    const buffer = await promiseReadFile(".deployed-address.txt");
    const contractAddress = buffer.toString();
    console.log("Starting verifying smart contract:" + contractAddress);
    await run("verify:verify", {
        address: contractAddress
    });
}

verify().
    then(() => process.exit(0)).
    catch((error) => {
        console.error(error);
        process.exit(1);
    });

