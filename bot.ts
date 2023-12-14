// Objective:

// - To develop a Telegram bot that monitors heroes.build
// - The bot should automatically track and only report new bounties as they are created and when they are completed.

// Key Features of the Bot:

// - New Bounty Alerts: The bot should send a notification whenever a new bounty is posted on the platform.
// - Completion Alerts: The bot should send a notification when a bounty is marked as completed.
// - Message Content: Each alert must include comprehensive details of the bounty:
// + Type and tags of the bounty
// + Title of the bounty
// + Owner of the bounty
// + Deadline
// + Description of the task.
// + How many people wanted & Bounty amount // {\"OneForAll\":{\"number_of_slots\":10,\"amount_per_slot\":\"100000
// + Advanced setting features: KYC, Whitelist, Invoice, Reviewer
// + Link to the bounty for more details.
// - Message Clarity: Messages delivered by the bot should be coherent, easy to understand, and well-structured.
// bounty_done : user - how much they claim - title
// Smart contract address: bounties.heroes.build

import { Composer, Markup, Scenes, session, Telegraf } from "telegraf";
import * as nearAPI from "near-api-js";
require('dotenv').config();


const provider = new nearAPI.providers.JsonRpcProvider({url:process.env.NEAR_RPC_API as string} );
const stepHandler = new Composer<Scenes.WizardContext>();
const hero_bounty_address = process.env.HERO_BOUNTY_ADDRESS as string;


const bounty_process = (transaction: any)=> {
	if (hero_bounty_address.includes(transaction.receiver_id)) {
		return true;	
	}
	return false;
	
}

const create_new_bounty = (transaction: any)=> {
	if (transaction.receiver_id == process.env.USDT_ADDRESS || transaction.receiver_id == process.env.USDC_ADDRESS || transaction.receiver_id == process.env.DAI_ADDRESS  || transaction.receiver_id == process.env.XP_ADDRESS) {
		
		const action = JSON.parse(atob(transaction.actions[0].FunctionCall.args));
		if(action && action.receiver_id == hero_bounty_address){
			return true;
		}
			
	}
	return false;
	
}
const superWizard = new Scenes.WizardScene(
	"super-wizard",
	async(ctx) => {
		let latestBlockHeight = 0;
		setInterval(async () => {
			try {
				const latestBlock = await provider.block({ finality: 'final' });
				const height = latestBlock.header.height;
	
				if (height === latestBlockHeight) {
					return;
				}
	
				latestBlockHeight = height;
				console.log('Latest Block:', height);

				const chunks = latestBlock.chunks;
	
				for (const chunk of chunks) {
					const chunkTemp = await provider.chunk(chunk.chunk_hash);
					const transactions = chunkTemp.transactions;
					
					if (transactions.length > 0) {
						
						for (const transaction of transactions) {
						//	console.log(JSON.stringify(transaction));
						//claim bounty
							if (bounty_process(transaction)) {
								if(transaction.actions[0].FunctionCall.method_name=='bounty_done'){
									await ctx.reply("bounty_done")
									//https://staging.heroes.build/api/bounty/transactions?bountyId=291
									const claim_bounty_json = JSON.parse(atob(transaction.actions[0].FunctionCall.args));
									await ctx.reply(`${claim_bounty_json.id} - ${claim_bounty_json.description} - ${transaction.signer_id}`)
								}
								console.log('Data Sent to Endpoint');
							}
							if (create_new_bounty(transaction)) {
								const result : any = await provider.txStatus(transaction.hash, transaction.receiver_id);
								
								const status  = atob(result.status.SuccessValue);
								let id = null;
								if(status !== '"0"'){
									result.receipts_outcome.forEach((element:any) => {
										if(element.outcome.logs[0]?.includes('index')){
											id = element.outcome.logs[0].split('index')[1].replace(/^\D+/g, '');
										}
									});
									
								}
								if(id){
									const stable_USD = transaction.receiver_id ==  'usdt.fakes.testnet' ? 'USDT.e': transaction.receiver_id ==  'usdc.fakes.testnet' ? 'USDC.e' :  transaction.receiver_id ==  'dai.fakes.testnet' ? "DAI" :  transaction.receiver_id ==  'rep.heroe.testnet' ? "XREP" : "unknown";
									const amount = parseInt(JSON.parse(atob(transaction.actions[0].FunctionCall.args)).amount) / 1e6 + "";
									const advanced_metadata = JSON.parse(JSON.parse(atob(transaction.actions[0].FunctionCall.args)).msg);
									const metadata = advanced_metadata.metadata;
									const deadline = advanced_metadata.deadline;
									const kyc_config = advanced_metadata.kyc_config;
									const reviewers = advanced_metadata.reviewers;
									const multitasking = advanced_metadata.multitasking;
									const tags = metadata.tags ;
									let tags_element = "";
									if(tags.length > 1){
										const Tagspop = tags.pop();
										tags_element = tags.join(", ") + " and " + Tagspop ;
									}else{
										tags_element = tags[0]
									}
									let multitasking_element = ""
									if(multitasking){
										if(multitasking?.OneForAll){
											multitasking_element = '- <b>Share : </b>$'+parseInt(amount)/parseInt(multitasking.OneForAll.number_of_slots) * multitasking.OneForAll.amount_per_slot/1e6 + ` ${stable_USD} per Hunter \n` 
										}
									}
									let reviewers_element = "";
									if(reviewers){
										if(reviewers.MoreReviewers?.more_reviewers){
											reviewers_element='<b>⏩ REVIEWER :</b>\n\n'
											reviewers.MoreReviewers.more_reviewers.forEach((element : string) => {
												reviewers_element =reviewers_element + "- " + element+"\n"
											});
										}
										
									}
									const claimer_approval = advanced_metadata.claimer_approval;
									let claimer_approval_element = ''
									if(claimer_approval){
										if(claimer_approval?.WhitelistWithApprovals?.claimers_whitelist){
											claimer_approval_element = '<b>⏩ Whitelist :</b>\n\n'
											claimer_approval.WhitelistWithApprovals.claimers_whitelist.forEach((element : string) => {
												console.log(element);
												claimer_approval_element = claimer_approval_element + element +'\n'
											});
										}
									}

									const kyc_config_element  = kyc_config ==  'KycNotRequired' ? '' :  kyc_config.KycRequired.kyc_verification_method == 'DuringClaimApproval' ? '- <b>KYC :</b> After\n' : kyc_config.KycRequired.kyc_verification_method == 'WhenCreatingClaim' ? '- <b>KYC :</b> Before \n' : '';
									const deadline_element =  deadline == 'WithoutDeadline' ? '' : `-<b> Deadline :</b> ${new Date(parseInt(deadline?.DueDate.due_date)/1000000).toLocaleString('en-US',{year : 'numeric',month: 'long', day: 'numeric' })}\n`
									const contract_element_url = metadata.contact_details.contact_type == "Telegram" ? `https://t.me/${metadata.contact_details.contact}` : metadata.contact_details.contact_type == 'Discord' ? `https://discord.com/users/${metadata.contact_details.contact}` :  metadata.contact_details.contact_type == 'Twitter' ? `https://twitter.com/${metadata.contact_details.contact}` :  metadata.contact_details.contact_type == 'Email' ? metadata.contact_details.contact_type : "Unknown";
									await ctx.sendPhoto({source: './new_bounty.jpg'}, { 
										caption: 
										`<b>NEW BOUNTY UPDATE:</b>\n` +
										`${new Date().toLocaleString('en-US',{year : 'numeric',month: 'long', day: 'numeric' })}\n\n`+
										`<b> ${metadata.title}\n </b>` +
										` - ${metadata.description}\n\n`+
										` <b>⏩ Requirements:</b>\n\n`+
										`- <b>Level:</b> ${metadata.experience} \n`+
										`- <b>${metadata.category} Skill : </b>${tags_element}\n`+
										`- <b>Acceptance criteria :</b> ${metadata.acceptance_criteria}\n` +
										`${kyc_config_element}\n` +
										`<b>⏩ DETAILS :</b>\n\n`+
										`- <b>Paid in : </b>${stable_USD}\n`+
										`- <b>Total : </b>$${amount} \n` +
										`${multitasking_element}`+
										`${deadline_element}`+
										`- <b>${metadata.contact_details.contact_type}: </b><a href="${contract_element_url}">${contract_element_url}</a>\n` +
										`\n`+
										`${claimer_approval_element}` +
										`${reviewers_element}` ,
										parse_mode: 'HTML',
										reply_markup: {
											inline_keyboard: [
												[{
													text: "CLAIM BOUNTY NOW 🚀",
													url: `https://staging.heroes.build/bounties/bounty/${id}`,
												}, 
											],
											]
												
											}
									
									 });
								}
							}
						}
								}
								

	}
 } catch (error) {
		console.error('Error Processing Block:', error);
	}
}, 500)
	},
	stepHandler,


);

const bot = new Telegraf<Scenes.WizardContext>(process.env.BOT_TOKEN as string);
const stage = new Scenes.Stage<Scenes.WizardContext>([superWizard], {
	default: "super-wizard",
});
bot.use(session());
bot.use(stage.middleware());

bot.launch();