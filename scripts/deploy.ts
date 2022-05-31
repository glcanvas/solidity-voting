import {ethers, run} from "hardhat";
import {writeFile} from "fs";

/**
 * Deploys contract into the network,
 * storages contact's name into file for further processing.
 */
async function deploy () {

    await run("compile");
    const Voting = await ethers.getContractFactory("Voting");
    console.log("Starting deploying contract");
    const voting = await Voting.deploy();
    await voting.deployed();
    console.log("Contract deployed to:", voting.address);

    await new Promise(function () {
        writeFile(".deployed-address.txt", voting.address, function (err) {
            if (err) {
                console.error(err);
            }
        });
    });

}

deploy().
    then(() => process.exit(0)).
    catch((error) => {
        console.error(error);
        process.exit(1);
    });

