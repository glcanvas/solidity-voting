import {task, types} from "hardhat/config";

task("create", "create election").
    addParam("contract", "contract's address", undefined, types.string, false).
    addParam("name", "election's name", undefined, types.string, false).
    setAction(async (taskArgs, env, runSuper) => {
        const Voting = await env.ethers.getContractFactory("Voting");
        const voting = Voting.attach(taskArgs["contract"]);
        const transaction = await voting.createElection(taskArgs["name"]);
        await transaction.wait();
        console.log("election created successfully");
    });

task("vote", "Vote for candidate").
    addParam("contract", "contract's address", undefined, types.string, false).
    addParam("name", "election's name", undefined, types.string, false).
    addParam("candidate", "candidate's address", undefined, types.string, false).
    addParam("signer", "signers id", 0, types.int, true).
    setAction(async (taskArgs, env, runSuper) => {
        const signer = (await env.ethers.getSigners())[taskArgs["signer"]];
        if (signer === undefined) {
            throw new RangeError(`Out of signers: ${taskArgs["signer"]}`);
        }
        const Voting = await env.ethers.getContractFactory("Voting");
        const voting = Voting.attach(taskArgs["contract"]).connect(signer);
        const transaction = await voting.voteForCandidate(taskArgs["name"], taskArgs["candidate"], {value: env.ethers.utils.parseEther("0.01")});
        await transaction.wait();
        console.log("votes successfully");
    });

task("finish", "finish election").
    addParam("contract", "contract's address", undefined, types.string, false).
    addParam("name", "election's name", undefined, types.string, false).
    addParam("signer", "signers id", 0, types.int, true).
    setAction(async (taskArgs, env, runSuper) => {
        const signer = (await env.ethers.getSigners())[taskArgs["signer"]];
        if (signer === undefined) {
            throw new RangeError(`Out of signers: ${taskArgs["signer"]}`);
        }
        const Voting = await env.ethers.getContractFactory("Voting");
        const voting = Voting.attach(taskArgs["contract"]).connect(signer);
        const transaction = await voting.finishElection(taskArgs["name"]);
        await transaction.wait();
        console.log("finished successfully");
    });

task("get-taxes", "send taxes to owner's wallet").
    addParam("contract", "contract's address", undefined, types.string, false).
    setAction(async (taskArgs, env, runSuper) => {
        const Voting = await env.ethers.getContractFactory("Voting");
        const voting = Voting.attach(taskArgs["contract"]);
        const transaction = await voting.getTaxes();
        await transaction.wait();
        console.log("taxes transferred successfully");
    });


task("elections", "Print elections list").
    addParam("contract", "contract's address", undefined, types.string, false).
    setAction(async (taskArgs, env, runSuper) => {
        const Voting = await env.ethers.getContractFactory("Voting");
        const voting = Voting.attach(taskArgs["contract"]);
        try {
            console.log(await voting.getElections());
        } catch (e) {
            console.log(e);
        }
    });

task("leaders", "Print election's leaders").
    addParam("contract", "contract's address", undefined, types.string, false).
    addParam("name", "election's name", undefined, types.string, false).
    setAction(async (taskArgs, env, runSuper) => {
        const Voting = await env.ethers.getContractFactory("Voting");
        const voting = Voting.attach(taskArgs["contract"]);
        try {
            const info = await voting.getFavorites(taskArgs["name"]);
            console.log(`favorites: ${info[0]}`);
            console.log(`favorites score: ${info[1]}`);
        } catch (e) {
            console.log(e);
        }
    });

task("election-info", "Print election information").
    addParam("contract", "contract's address", undefined, types.string, false).
    addParam("name", "election's name", undefined, types.string, false).
    setAction(async (taskArgs, env, runSuper) => {
        const Voting = await env.ethers.getContractFactory("Voting");
        const voting = Voting.attach(taskArgs["contract"]);
        try {
            const info = await voting.getElectionInfo(taskArgs["name"]);
            console.log(`name: ${info[0]}`);
            const date = new Date();
            date.setTime(info[1].toNumber() * 1_000);
            console.log(`start time epoch seconds: ${date}`);
            console.log(`election active: ${info[2]}`);
            console.log(`reward distributed: ${info[3]}`);
            console.log(`electorate: ${info[4]}`);
            const candidateCount = info[5].map((v, i) => {
                return {
                    "address": v,
                    "count": info[6][i].toNumber()
                };
            });
            console.log(`candidates and count: ${JSON.stringify(candidateCount)}`);
        } catch (e) {
            console.log(e);
        }
    });

