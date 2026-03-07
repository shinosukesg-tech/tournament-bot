require("dotenv").config();

/* ================= UPTIME ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(process.env.PORT || 3000);
/* ========================================== */

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle
} = require("discord.js");

const fs = require("fs");
const { get, add } = require("./gems");

const PREFIX = ";";

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

/* ================= HISTORY ================= */

let history = {};

if(fs.existsSync("./history.json")){
history = JSON.parse(fs.readFileSync("./history.json"));
}

function saveHistory(){
fs.writeFileSync("./history.json",JSON.stringify(history,null,2));
}

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg=>{

if(msg.author.bot) return;
if(!msg.content.startsWith(PREFIX)) return;

const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
const cmd = args.shift().toLowerCase();

/* ================= SHOP ================= */

if(cmd==="shop"){

const balance = get(msg.author.id);

const embed = new EmbedBuilder()
.setColor("#00ffff")
.setTitle("🛒 KmGems Shop")
.setDescription(`
💎 Balance: **${balance} KmGems**

Rewards

1k owo  = 500 KmGems
5k owo  = 2500 KmGems
10k owo = 5000 KmGems
20k owo = 10000 KmGems
30k owo = 15000 KmGems
40k owo = 20000 KmGems
50k owo = 25000 KmGems

Buy with:
;buy 1k
;buy 5k
;buy 10k
;buy 20k
;buy 30k
;buy 40k
;buy 50k
`);

msg.channel.send({embeds:[embed]});
}

/* ================= BUY ================= */

if(cmd==="buy"){

const item = args[0];
if(!item) return msg.reply("Use ;buy 1k / 5k / 10k / 20k / 30k / 40k / 50k");

let price=0;
let reward="";

if(item==="1k"){price=500;reward="1k owo";}
if(item==="5k"){price=2500;reward="5k owo";}
if(item==="10k"){price=5000;reward="10k owo";}
if(item==="20k"){price=10000;reward="20k owo";}
if(item==="30k"){price=15000;reward="30k owo";}
if(item==="40k"){price=20000;reward="40k owo";}
if(item==="50k"){price=25000;reward="50k owo";}

if(price===0) return msg.reply("❌ Item not found.");

if(get(msg.author.id) < price)
return msg.reply("❌ Not enough KmGems.");

add(msg.author.id,-price);

/* SAVE HISTORY */

if(!history[msg.author.id]) history[msg.author.id]=[];

history[msg.author.id].push({
reward:reward,
price:price,
date:new Date().toLocaleString()
});

saveHistory();

/* EMBED */

const embed = new EmbedBuilder()
.setColor("Green")
.setTitle("🎉 Purchase Successful")
.setDescription(`
User: ${msg.author}

Reward: **${reward}**

Cost: **${price} KmGems**

Remaining Balance
💎 **${get(msg.author.id)} KmGems**

📩 Open a **ticket** and moderator will confirm reward.
`);

/* BUTTON */

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`claim_${reward}_${msg.author.id}`)
.setLabel("Claim Reward")
.setStyle(ButtonStyle.Secondary)
);

msg.channel.send({embeds:[embed],components:[row]});
}

/* ================= GIVE ================= */

if(cmd==="give"){

if(!msg.member.permissions.has("Administrator"))
return msg.reply("Admin only command.");

const amount = parseInt(args[0]);
const user = msg.mentions.users.first();

if(!amount || !user)
return msg.reply("Usage: ;give 500 @user");

add(user.id,amount);

msg.channel.send(`💎 Added **${amount} KmGems** to ${user}`);
}

/* ================= HISTORY ================= */

if(cmd==="history"){

if(msg.author.id !== msg.guild.ownerId)
return msg.reply("Only server owner can use this.");

const user = msg.mentions.users.first();

if(!user) return msg.reply("Mention user.");

if(!history[user.id] || history[user.id].length===0)
return msg.reply("No purchase history.");

let text="";

history[user.id].forEach(h=>{
text += `Reward: ${h.reward} | Cost: ${h.price} KmGems | ${h.date}\n`;
});

const embed = new EmbedBuilder()
.setColor("Gold")
.setTitle("🧾 Purchase History")
.setDescription(`User: ${user}\n\n${text}`);

msg.channel.send({embeds:[embed]});
}

});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async interaction=>{

try{

if(!interaction.isButton()) return;

if(interaction.customId.startsWith("claim_")){

const data = interaction.customId.split("_");

const reward = data[1];
const buyerID = data[2];

/* MODERATOR CHECK */

if(!interaction.member.permissions.has("ManageMessages")){
return interaction.reply({
content:"❌ Only moderators can confirm rewards inside tickets.",
ephemeral:true
});
}

/* SUCCESS */

const embed = new EmbedBuilder()
.setColor("Green")
.setTitle("✅ Reward Delivered")
.setDescription(`
Moderator: ${interaction.user}

User: <@${buyerID}>

Reward Delivered:
**${reward}**
`);

await interaction.update({
embeds:[embed],
components:[]
});

}

}catch(err){

console.error("Button Error:",err);

if(!interaction.replied){
interaction.reply({
content:"❌ Button error occurred.",
ephemeral:true
}).catch(()=>{});
}

}

});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
