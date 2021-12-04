import { SubstrateEvent } from "@subql/types";
import { Account, Transfer } from "../types";
import { Balance } from "@polkadot/types/interfaces";
import { Proposal } from "../types/models/Proposal";
import { VoteHistory } from "../types/models/VoteHistory";
import { bool, Int } from "@polkadot/types";
import { Councillor } from "../types/models/Councillor";

export async function handleEvent(event: SubstrateEvent): Promise<void> {
  // The balances.transfer event has the following payload \[from, to, value\] that we can access

  const fromAddress = event.event.data[0];
  const toAddress = event.event.data[1];
  const amount = event.event.data[2];

  // query for toAddress from DB
  const toAccount = await Account.get(toAddress.toString());
  // if not in DB, instantiate a new Account object using the toAddress as a unique ID
  if (!toAccount) {
    await new Account(toAddress.toString()).save();
  }

  // instantiate a new Transfer object using the block number and event.idx as a unique ID
  const transfer = new Transfer(
    `${event.block.block.header.number.toNumber()}-${event.idx}`
  );
  transfer.blockNumber = event.block.block.header.number.toBigInt();
  transfer.toId = toAddress.toString();
  transfer.amount = (amount as Balance).toBigInt();
  await transfer.save();
}

export async function handleCouncilProposedEvent(
  event: SubstrateEvent
): Promise<void> {
  const {
    event: {
      data: [accountId, proposal_index, proposal_hash, threshold],
    },
  } = event;
  const proposal = new Proposal(proposal_hash.toString());

  proposal.index = proposal_index.toString();
  proposal.account = accountId.toString();
  proposal.hash = proposal_hash.toString();
  proposal.voteThreshold = threshold.toString();
  proposal.block = event.block.block.header.number.toBigInt();
  await proposal.save();
}

export async function handleCouncilVotedEvent(
  event: SubstrateEvent
): Promise<void> {
  const {
    event: {
      data: [councilorId, proposal_hash, approved_vote, numberYes, numberNo],
    },
  } = event;

  await ensureCouncillor(councilorId.toString());
  // Retrieve the record by the accountID
  const voteHistory = new VoteHistory(
    `${event.block.block.header.number.toNumber()}-${event.idx}`
  );

  voteHistory.proposalHashId = proposal_hash.toString();
  voteHistory.approvedVote = (approved_vote as bool).valueOf();
  voteHistory.councillorId = councilorId.toString();
  voteHistory.votedYes = (numberYes as Int).toNumber();
  voteHistory.votedNo = (numberNo as Int).toNumber();
  voteHistory.block = event.block.block.header.number.toNumber();
  await voteHistory.save();
}
async function ensureCouncillor(accountId: string): Promise<void> {
  // ensure that these account entities exist
  let councillor = await Councillor.get(accountId);
  if (!councillor) {
    councillor = new Councillor(accountId);
    councillor.numberOfVotes = 0;
  }
  councillor.numberOfVotes += 1;
  await councillor.save();
}
