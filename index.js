require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express");
const app = express();

app.get("/", (req,res)=>res.send("Bot Alive"));
app.listen(process.env.PORT || 3000);

/* ========================================== */

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
PermissionsBitField,
ChannelType
} = require("discord.js");

const { get, add } = require("./gems");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
});

const PREFIX = ";";
const MOD_ROLE = "Moderator";

let welcomeChannel = null;
let purchaseHistory = [];

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

/* ===== WELCOME ===== */

if(cmd==="welcome"){

if(!msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
return msg.reply("Admin only.");

welcomeChannel = msg.channel.id;

msg.channel.send("✅ Welcome system enabled.");

}

/* ===== BALANCE ===== */

if(cmd==="gems"){

const balance = get(msg.author.id) || 0;

msg.reply(`💎 Balance: **${balance} <:NoobGems:1479770351473787023>**`);

}

/* ===== SHOP ===== */

if(cmd==="shop"){

const balance = get(msg.author.id) || 0;

const embed = new EmbedBuilder()
.setColor("#00ffff")
.setTitle("🛒 KmGems Shop")
.setDescription(`
Balance: **${balance} <:NoobGems:1479770351473787023>**

VIP Role — 500
Name Color — 200
Server Shoutout — 100

Buy using
;buy vip
;buy color
;buy shoutout
`);

msg.channel.send({embeds:[embed]});

}

/* ===== BUY ===== */

if(cmd==="buy"){

const item = args[0];
if(!item) return msg.reply("Use ;buy item");

let price = 0;

if(item==="vip") price=500;
if(item==="color") price=200;
if(item==="shoutout") price=100;

if(price===0) return msg.reply("Item not found.");

const balance = get(msg.author.id) || 0;

if(balance < price)
return msg.reply("❌ Not enough KmGems.");

add(msg.author.id,-price);

purchaseHistory.push({
user: msg.author.tag,
item: item,
price: price
});

const embed = new EmbedBuilder()
.setColor("Green")
.setTitle("🛒 Purchase Successful")
.setDescription(`
Item: **${item}**
Cost: **${price} <:NoobGems:1479770351473787023>**

Balance: **${get(msg.author.id)} <:NoobGems:1479770351473787023>**
`);

msg.channel.send({embeds:[embed]});

}

/* ===== GIVE ===== */

if(cmd==="give"){

if(!msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
return msg.reply("Admin only.");

const amount = parseInt(args[0]);
const user = msg.mentions.users.first();

if(!amount || !user)
return msg.reply("Use ;give amount @user");

add(user.id,amount);

msg.channel.send(`
${user} received **${amount} <:NoobGems:1479770351473787023>**

Total: **${get(user.id)} <:NoobGems:1479770351473787023>**
`);

}

/* ===== HISTORY ===== */

if(cmd==="history"){

if(!msg.member.roles.cache.some(r=>r.name===MOD_ROLE))
return msg.reply("Moderator only.");

if(purchaseHistory.length === 0)
return msg.reply("No purchases yet.");

let text = purchaseHistory
.slice(-10)
.reverse()
.map(h=>`👤 ${h.user} bought **${h.item}** for **${h.price} <:NoobGems:1479770351473787023>**`)
.join("\n");

const embed = new EmbedBuilder()
.setColor("Orange")
.setTitle("🧾 Purchase History")
.setDescription(text);

msg.channel.send({embeds:[embed]});

}

/* ===== OWO EXCHANGE ===== */

if(cmd==="owo"){

const embed = new EmbedBuilder()
.setColor("#2f3136")
.setTitle("💰 OWO → KmGems Exchange")
.setDescription(`
1k OWO = 500 <:NoobGems:1479770351473787023>
10k OWO = 5000 <:NoobGems:1479770351473787023>
20k OWO = 10000 <:NoobGems:1479770351473787023>
30k OWO = 15000 <:NoobGems:1479770351473787023>
40k OWO = 20000 <:NoobGems:1479770351473787023>
50k OWO = 25000 <:NoobGems:1479770351473787023>

Open ticket after selecting
`);

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("owo1")
.setLabel("1k OWO")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("owo10")
.setLabel("10k OWO")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("owo20")
.setLabel("20k OWO")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("owo50")
.setLabel("50k OWO")
.setStyle(ButtonStyle.Secondary)

);

msg.channel.send({embeds:[embed],components:[row]});

}

/* ===== TICKET PANEL ===== */

if(cmd==="ticketpanel"){

const embed = new EmbedBuilder()
.setColor("#2f3136")
.setTitle("🎟 Ticket Panel")
.setDescription(`
Support
Apply
Reward
`);

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("ticket_support")
.setLabel("Support")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("ticket_apply")
.setLabel("Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("ticket_reward")
.setLabel("Reward")
.setStyle(ButtonStyle.Secondary)

);

msg.channel.send({embeds:[embed],components:[row]});

}

});

/* ================= WELCOME EVENT ================= */

client.on("guildMemberAdd", member=>{

if(!welcomeChannel) return;

const channel = member.guild.channels.cache.get(welcomeChannel);
if(!channel) return;

const embed = new EmbedBuilder()
.setColor("#8e44ad")
.setTitle(`Welcome ${member.user.username}`)
.setThumbnail(member.user.displayAvatarURL({size:512}))
.setDescription(`User ID: ${member.id}`)
.setTimestamp();

channel.send({embeds:[embed]});

});

/* ================= BUTTON SYSTEM ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return;

/* ===== OWO BUTTON ===== */

if(interaction.customId.startsWith("owo")){

await interaction.reply({
content:`Open a **reward ticket** to receive your KmGems.`,
ephemeral:true
});

}

/* ===== CREATE TICKET ===== */

if(
interaction.customId==="ticket_support" ||
interaction.customId==="ticket_apply" ||
interaction.customId==="ticket_reward"
){

const type = interaction.customId.split("_")[1];

const channel = await interaction.guild.channels.create({
name:`${type}-${interaction.user.username}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},
{
id:interaction.user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
}
]
});

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("claim_ticket")
.setLabel("Claim")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close")
.setStyle(ButtonStyle.Danger)

);

await channel.send({
content:`Ticket opened by ${interaction.user}`,
components:[row]
});

await interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
});

}

/* ===== CLAIM ===== */

if(interaction.customId==="claim_ticket"){

await interaction.reply(`✅ Ticket claimed by ${interaction.user}`);

}

/* ===== CLOSE ===== */

if(interaction.customId==="close_ticket"){

await interaction.reply("Closing ticket in 5 seconds...");

setTimeout(()=>{
interaction.channel.delete().catch(()=>{});
},5000);

}

});

client.login(process.env.TOKEN);
