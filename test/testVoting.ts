import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Voting } from "../typechain";

const ENOUGH_PAYABLE_ETHER = ethers.utils.parseEther("0.01");
const MORE_ENOUGH_PAYABLE_ETHER = ethers.utils.parseEther("1");
const NOT_ENOUGH_PAYABLE_ETHER = ethers.utils.parseEther("0.001");
const ZERO_ETHER = ethers.utils.parseEther("0");
const createEmptyElection = (name: string, active: boolean) => ({
  electionName: name,
  isActive: active,
  rewardDistributed: false,
  candidates: [],
  electorate: [],
});

type ElectionInfo = {
  electionName: string;
  isActive: boolean;
  rewardDistributed: boolean;
  candidates: Array<{ candidate: SignerWithAddress; count: number }>;
  electorate: SignerWithAddress[];
};
type Favorites = {
  electionName: string;
  candidates: SignerWithAddress[];
  score: number;
};

async function shiftNextTime(addDays: number): Promise<void> {
  const daysInSeconds: number = addDays * 24 * 60 * 60;
  await network.provider.send("evm_increaseTime", [daysInSeconds]);
  await network.provider.send("evm_mine");
}

async function deployContract(): Promise<Voting> {
  const contract = await ethers.getContractFactory("Voting"),
    voting = await contract.deploy();
  await voting.deployed();
  return voting as Voting;
}

async function voteForCandidate(
  contract: Voting,
  election: string,
  from: SignerWithAddress,
  to: SignerWithAddress
) {
  contract = contract.connect(from);
  await expect(
    contract.voteForCandidate(election, to.address, {
      value: ENOUGH_PAYABLE_ETHER,
    })
  )
    .to.emit(contract, "VoteForEvent")
    .withArgs(election, from.address, to.address);
}

async function checkElectionInfo(contract: Voting, info: ElectionInfo) {
  const electionResponse = await contract.getElectionInfo(info.electionName);
  expect(electionResponse[0]).to.be.eql(info.electionName);
  expect(electionResponse[2]).to.be.eq(info.isActive);
  expect(electionResponse[3]).to.be.eq(info.rewardDistributed);
  expect(electionResponse[4]).to.be.eql(info.electorate.map((x) => x.address));
  expect(electionResponse[5]).to.be.eql(
    info.candidates.map((x) => x.candidate.address)
  );
  expect(electionResponse[6].map((x) => x.toNumber())).to.be.eql(
    info.candidates.map((x) => x.count)
  );
}

async function checkFavorites(contract: Voting, favorites: Favorites) {
  const favoritesResponse = await contract.getFavorites(favorites.electionName);
  expect(favoritesResponse[0]).to.be.eql(
    favorites.candidates.map((x) => x.address)
  );
  expect(favoritesResponse[1]).to.be.eq(favorites.score);
}

function buildPermutations<T>(xs: T[]): T[][] {
  if (!xs.length) {
    return [[]];
  }
  return xs.flatMap((x) =>
    // Get permutations of xs without x, then prepend x to each
    buildPermutations(xs.filter((v) => v !== x)).map((vs) => [x, ...vs])
  );
}

const electorateOrder = buildPermutations([0, 1, 2]),
  candidatesOrder = [
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ],
  winners = [1, 2, 3, 10, 100, 777].map((x) => BigNumber.from(x)),
  worths = ["0.01", "1", "0.3", "0.7", "99"].map((x) =>
    ethers.utils.parseEther(x)
  );

async function checkEmptyElection(voting: Voting) {
  await checkElectionInfo(voting, createEmptyElection("election", true));
  await checkFavorites(voting, {
    electionName: "election",
    score: 0,
    candidates: [],
  });
  expect(await voting.getElections()).to.be.eql(["election"]);

  await shiftNextTime(4);

  await checkElectionInfo(voting, createEmptyElection("election", false));
  await checkFavorites(voting, {
    electionName: "election",
    score: 0,
    candidates: [],
  });
  expect(await voting.getElections()).to.be.eql(["election"]);
}

async function checkContractInfoWithBalance(
  voting: Voting,
  isActive: boolean,
  author: SignerWithAddress,
  nonAuthor: SignerWithAddress
) {
  expect(await ethers.provider.getBalance(voting.address)).to.be.equal(
    ENOUGH_PAYABLE_ETHER
  );
  await checkElectionInfo(voting, {
    electionName: "election 1",
    isActive,
    rewardDistributed: false,
    electorate: [author],
    candidates: [
      {
        candidate: nonAuthor,
        count: 1,
      },
    ],
  });
  await checkFavorites(voting, {
    electionName: "election 1",
    candidates: [nonAuthor],
    score: 1,
  });
  expect(await voting.getElections()).to.be.eql(["election 1"]);
}

describe("Voting", () => {
  it("change owner", async () => {
    let voting = await deployContract();
    const [author, nonAuthor, ...other] = await ethers.getSigners();
    await expect(
      voting.transferOwnership(nonAuthor.address)
    ).to.be.revertedWith("Changing the owner is forbidden");
    voting = voting.connect(nonAuthor);
    await expect(
      voting.transferOwnership(nonAuthor.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("create empty election", async () => {
    const voting = await deployContract();
    await voting.createElection("election");
    await checkEmptyElection(voting);
  });

  it("duplicate election", async () => {
    const voting = await deployContract();
    await voting.createElection("election");
    await expect(voting.createElection("election")).to.be.revertedWith(
      "Election already exists"
    );
  });

  it("election not found", async () => {
    const voting = await deployContract();
    await expect(voting.getFavorites("election")).to.be.revertedWith(
      "Election not found"
    );
  });

  it("create empty election checks non owner", async () => {
    let voting = await deployContract();
    await voting.createElection("election");
    const [author, nonAuthor, ...other] = await ethers.getSigners();
    voting = voting.connect(nonAuthor);
    await checkEmptyElection(voting);
  });

  it("create election by non owner", async () => {
    let voting = await deployContract();
    const [author, nonAuthor, ...other] = await ethers.getSigners();
    voting = voting.connect(nonAuthor);
    await expect(voting.createElection("election")).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    expect(await voting.getElections()).to.be.empty;
  });

  it("create two elections", async () => {
    let voting = await deployContract();
    await voting.createElection("election 1");
    await voting.createElection("election 2");

    const internalCheck = async (active: boolean) => {
      const electionList = await voting.getElections();
      expect(electionList).to.be.eql(["election 1", "election 2"]);
      await checkElectionInfo(
        voting,
        createEmptyElection("election 1", active)
      );
      await checkElectionInfo(
        voting,
        createEmptyElection("election 2", active)
      );
    };

    await internalCheck(true);
    const [author, nonAuthor, ...other] = await ethers.getSigners();
    voting = voting.connect(nonAuthor);
    await internalCheck(true);

    await shiftNextTime(4);

    await internalCheck(false);
    voting = voting.connect(author);
    await internalCheck(false);
  });

  it("create election and vote for candidate", async () => {
    const voting = await deployContract();
    await voting.createElection("election 1");
    const [author, nonAuthor, ...other] = await ethers.getSigners();

    await expect(
      voting.voteForCandidate("election 1", nonAuthor.address, {
        value: ENOUGH_PAYABLE_ETHER,
      })
    )
      .to.emit(voting, "VoteForEvent")
      .withArgs("election 1", author.address, nonAuthor.address);

    await checkContractInfoWithBalance(voting, true, author, nonAuthor);
    await shiftNextTime(5);
    await checkContractInfoWithBalance(voting, false, author, nonAuthor);
  });

  it("vote with wrong balance", async () => {
    const voting = await deployContract();
    await voting.createElection("election 1");
    const [author, nonAuthor, ...other] = await ethers.getSigners();

    await expect(
      voting.voteForCandidate("election 1", nonAuthor.address, {
        value: MORE_ENOUGH_PAYABLE_ETHER,
      })
    ).to.be.revertedWith("Incorrect ethers amount");

    await expect(
      voting.voteForCandidate("election 1", nonAuthor.address, {
        value: NOT_ENOUGH_PAYABLE_ETHER,
      })
    ).to.be.revertedWith("Incorrect ethers amount");

    expect(await ethers.provider.getBalance(voting.address)).to.be.equal(
      ZERO_ETHER
    );

    await checkElectionInfo(voting, createEmptyElection("election 1", true));
    await checkFavorites(voting, {
      electionName: "election 1",
      candidates: [],
      score: 0,
    });
  });

  it("vote twice", async () => {
    const voting = await deployContract();
    await voting.createElection("election 1");
    const [author, nonAuthor, ...other] = await ethers.getSigners();

    await voteForCandidate(voting, "election 1", author, nonAuthor);
    await checkContractInfoWithBalance(voting, true, author, nonAuthor);

    await expect(
      voting.voteForCandidate("election 1", author.address, {
        value: ENOUGH_PAYABLE_ETHER,
      })
    ).to.be.revertedWith("Elector already voted");
    await checkContractInfoWithBalance(voting, true, author, nonAuthor);

    await shiftNextTime(5);
    await checkContractInfoWithBalance(voting, false, author, nonAuthor);
  });

  it("vote election closed", async () => {
    const voting = await deployContract();
    await voting.createElection("election 1");
    const [author, nonAuthor, ...other] = await ethers.getSigners();

    await checkElectionInfo(voting, createEmptyElection("election 1", true));
    await checkFavorites(voting, {
      electionName: "election 1",
      candidates: [],
      score: 0,
    });

    await shiftNextTime(10);
    await expect(
      voting.voteForCandidate("election 1", author.address, {
        value: ENOUGH_PAYABLE_ETHER,
      })
    ).to.be.revertedWith("Election is over");
    await checkElectionInfo(voting, createEmptyElection("election 1", false));
    await checkFavorites(voting, {
      electionName: "election 1",
      candidates: [],
      score: 0,
    });
  });

  it("vote and get favorite distribution 'nonAuthor1, 2'", async () => {
    const voting = await deployContract();
    await voting.createElection("election 1");
    const [author, nonAuthor1, ...other] = await ethers.getSigners();

    await voteForCandidate(voting, "election 1", author, nonAuthor1);
    await voteForCandidate(voting, "election 1", nonAuthor1, nonAuthor1);

    await checkElectionInfo(voting, {
      electionName: "election 1",
      isActive: true,
      rewardDistributed: false,
      candidates: [
        {
          candidate: nonAuthor1,
          count: 2,
        },
      ],
      electorate: [author, nonAuthor1],
    });
    await checkFavorites(voting, {
      electionName: "election 1",
      candidates: [nonAuthor1],
      score: 2,
    });
    expect(await voting.getElections()).to.be.eql(["election 1"]);
  });

  it("vote and get favorite distribution 'author, 1', 'nonAuthor1, 1'", async () => {
    const voting = await deployContract();
    await voting.createElection("election 1");
    const [author, nonAuthor1, ...other] = await ethers.getSigners();

    await voteForCandidate(voting, "election 1", author, author);
    await voteForCandidate(voting, "election 1", nonAuthor1, nonAuthor1);

    await checkElectionInfo(voting, {
      electionName: "election 1",
      isActive: true,
      rewardDistributed: false,
      candidates: [
        {
          candidate: author,
          count: 1,
        },
        {
          candidate: nonAuthor1,
          count: 1,
        },
      ],
      electorate: [author, nonAuthor1],
    });
    await checkFavorites(voting, {
      electionName: "election 1",
      candidates: [author, nonAuthor1],
      score: 1,
    });
    expect(await voting.getElections()).to.be.eql(["election 1"]);
  });

  it("distribute reward error", async () => {
    const voting = await deployContract();
    await expect(
      voting.distributeReward(BigNumber.from(0), BigNumber.from(10))
    ).to.be.revertedWith("Winners are absent");
    await expect(
      voting.distributeReward(BigNumber.from(10), BigNumber.from(0))
    ).to.be.revertedWith("Amount can't be empty");
  });

  it("finish election reverts", async () => {
    const voting = await deployContract();
    await voting.createElection("election");
    await expect(voting.finishElection("election")).to.be.revertedWith(
      "Election is active"
    );
    await expect(voting.finishElection("some name")).to.be.revertedWith(
      "Election not found"
    );
  });

  it("finish empty election", async () => {
    const voting = await deployContract();
    await voting.createElection("election");
    await shiftNextTime(4);
    await expect(voting.finishElection("election"))
      .to.emit(voting, "DistributeReward")
      .withArgs(BigNumber.from(0), ZERO_ETHER, ZERO_ETHER);

    await expect(voting.finishElection("election")).to.be.revertedWith(
      "Reward already distributed"
    );
    await checkElectionInfo(voting, {
      electionName: "election",
      isActive: false,
      rewardDistributed: true,
      candidates: [],
      electorate: [],
    });
  });

  it("finish election one winner", async () => {
    const voting = await deployContract();
    await voting.createElection("election");
    const wallets = await ethers.getSigners();
    await voteForCandidate(voting, "election", wallets[0], wallets[0]);
    await shiftNextTime(4);
    const [perAddressReward, taxes] = await voting.distributeReward(
      BigNumber.from(1),
      ENOUGH_PAYABLE_ETHER
    );
    await expect(voting.finishElection("election"))
      .to.emit(voting, "DistributeReward")
      .withArgs(BigNumber.from(1), perAddressReward, taxes);

    await checkElectionInfo(voting, {
      electionName: "election",
      isActive: false,
      rewardDistributed: true,
      candidates: [
        {
          candidate: wallets[0],
          count: 1,
        },
      ],
      electorate: [wallets[0]],
    });
  });

  it("finish election two winners", async () => {
    const voting = await deployContract();
    await voting.createElection("election");
    const wallets = await ethers.getSigners();
    await voteForCandidate(voting, "election", wallets[0], wallets[0]);
    await voteForCandidate(voting, "election", wallets[1], wallets[1]);

    await shiftNextTime(4);
    const [perAddressReward, taxes] = await voting.distributeReward(
      BigNumber.from(2),
      ENOUGH_PAYABLE_ETHER.mul(BigNumber.from(2))
    );
    await expect(voting.finishElection("election"))
      .to.emit(voting, "DistributeReward")
      .withArgs(BigNumber.from(2), perAddressReward, taxes);

    await checkElectionInfo(voting, {
      electionName: "election",
      isActive: false,
      rewardDistributed: true,
      candidates: [
        {
          candidate: wallets[0],
          count: 1,
        },
        {
          candidate: wallets[1],
          count: 1,
        },
      ],
      electorate: [wallets[0], wallets[1]],
    });
  });

  it("finish election, check funds and taxes available", async () => {
    const voting = await deployContract();
    await voting.createElection("election");
    const wallets = await ethers.getSigners(),
      worthBefore = await ethers.provider.getBalance(wallets[10].address);
    await voteForCandidate(voting, "election", wallets[0], wallets[10]);

    await shiftNextTime(4);
    const [perAddressReward, taxes] = await voting.distributeReward(
      BigNumber.from(1),
      ENOUGH_PAYABLE_ETHER
    );
    await expect(voting.finishElection("election"))
      .to.emit(voting, "DistributeReward")
      .withArgs(BigNumber.from(1), perAddressReward, taxes);

    const worthAfter = await ethers.provider.getBalance(wallets[10].address);
    expect(worthAfter.gt(worthBefore)).is.true;

    const worthOwnerBefore = await ethers.provider.getBalance(
        wallets[0].address
      ),
      getTaxesTransaction = await voting.getTaxes(),
      gasPrice = getTaxesTransaction.gasPrice as BigNumber,
      { gasUsed } = await getTaxesTransaction.wait(),
      worthOwnerAfter = await ethers.provider.getBalance(wallets[0].address),
      gas = gasPrice.mul(gasUsed);

    expect(worthOwnerAfter.add(gas).sub(worthOwnerBefore)).to.be.eq(taxes);
  });

  it("withdraw taxes", async () => {
    let voting = await deployContract();
    await voting.createElection("election");
    const wallets = await ethers.getSigners();
    await voting.getTaxes();
    voting = voting.connect(wallets[1]);
    await expect(voting.getTaxes()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  for (const electorate of electorateOrder) {
    for (const candidate of candidatesOrder) {
      it(`${
        "vote, distribution: 'author, 1', 'nonAuthor 2' " + "electorate:"
      }${electorate} candidates:${candidate}`, async () => {
        const voting = await deployContract();
        await voting.createElection("election 1");
        const wallets = await ethers.getSigners(),
          candidateOrder =
            wallets[candidate[0]] === wallets[0]
              ? [
                  {
                    candidate: wallets[0],
                    count: 1,
                  },
                  {
                    candidate: wallets[1],
                    count: 2,
                  },
                ]
              : [
                  {
                    candidate: wallets[1],
                    count: 2,
                  },
                  {
                    candidate: wallets[0],
                    count: 1,
                  },
                ];

        await voteForCandidate(
          voting,
          "election 1",
          wallets[electorate[0]],
          wallets[candidate[0]]
        );
        await voteForCandidate(
          voting,
          "election 1",
          wallets[electorate[1]],
          wallets[candidate[1]]
        );
        await voteForCandidate(
          voting,
          "election 1",
          wallets[electorate[2]],
          wallets[candidate[2]]
        );

        await checkElectionInfo(voting, {
          electionName: "election 1",
          isActive: true,
          candidates: candidateOrder,
          rewardDistributed: false,
          electorate: electorate.map((el) => wallets[el]),
        });
        await checkFavorites(voting, {
          candidates: [wallets[1]],
          electionName: "election 1",
          score: 2,
        });
      });
    }
  }

  for (const winner of winners) {
    for (const worth of worths) {
      it(`distribute reward winner:${winner} worth:${worth}`, async () => {
        const voting = await deployContract(),
          [perAddressReward, taxes] = await voting.distributeReward(
            winner,
            worth
          );
        expect(perAddressReward.mul(winner).add(taxes)).to.be.eq(worth);
      });
    }
  }
});
