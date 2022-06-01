# Voting contract

Implementation of multiple voting with Solidity language.

This implementation supports multiple voting (each voting must have unique name), created by owner (contract's author).

Every voting lasts 3 days (time measure based on block's timestamp), during this voting each address might vote for
arbitrary address only once. The cost of such an election is 0.01 ether.

After 3 days anyone can finish this election and distribute funds for winners, but taxes will stay on the contract till
owner send them directly to himself.

## Functions

* create election -- election's name must be unique
* vote for candidate -- signers votes for the first time with 0.01 ether and election exists
* finish election -- will be successfully only after 3 days lasts, funds distributed over winners and taxes part stay on
  the contract's side
* get taxes -- sends taxes to the owner

## Views

* elections -- returns all existing elections
* favorites -- returns list of favorites for this election with the number of votes submitted for them
* election info -- returns all information about this election:
    * electionName
    * start time
    * is election still active
    * is reward distributed
    * list of electorates
    * list of candidates
    * list of corresponded votes for candidate

## Existing tasks

* create -- creates new election, required contract's address and election's name
* vote -- votes for candidate, required contract's address, election's name, candidate's address and singers id
* finish -- finishes election, required contract's address, election's name and singers id
* get-taxes -- sends funds to the owner, required contract's address only
* elections -- prints list of all elections, required contract's address
* leaders -- prints list of leaders for this election, required contract's address and election's name
* election-info -- prints election's info, required contract's address and election's name

Execute with: `  npx hardhat <task-name> arguments `

List of possible tasks: `  npx hardhat `

## Deploy

Contract might be deployed ether into **local** network or **ropsten** network. For the second one must be specified **
ROPSTEN_KEY** -- access key for infura services. Moreover must be specified **PRIVATE_KEY** for signing transactions.

To deploy use script/deploy.ts -- it sends script to the network and writes contract's address into
deployed-address.txt. Execute with: `  npx hardhat run scripts/deploy.ts `

## Verify

To verify contract on etherscan must be specified **ETHERSCAN_API_KEY**. Contract might be verified with
script/verify.ts. Execute with: `  npx hardhat run scripts/validate.ts `

## Test

For testing was used chai lib. All possible cases was covered. Execute with: ` npx hardhat coverage`
