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
const OWNER_ID = "947183912097026108";

let welcomeChannel = null;
let purchaseHistory = [];

/* ================= TOURNAMENT ================= */

let tournament = {
active:false,
size:0,
server:"",
map:"",
name:"",
round:1,
players:[],
qualified:[]
};

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

/* ===== HELP ===== */

if(cmd==="help"){

const embed = new EmbedBuilder()
.setColor("#5865F2")
.setTitle("🤖 Bot Commands")
.setDescription(`
💎 ;gems
🛒 ;shop
🎟 ;ticketpanel
⚔ ;1v1
💰 ;owo
🧾 ;history
`);

msg.channel.send({embeds:[embed]});

}

/* ===== GEMS ===== */

if(cmd==="gems"){

if(msg.author.id===OWNER_ID)
return msg.reply("💎 Balance: **∞ <:NoobGems:1479770351473787023>**");

const balance = get(msg.author.id)||0;

msg.reply(`💎 Balance: **${balance} <:NoobGems:1479770351473787023>**`);

}

/* ===== SHOP ===== */

if(cmd==="shop"){

const balance = get(msg.author.id)||0;

const embed = new EmbedBuilder()
.setColor("#00ffff")
.setTitle("🛒 KmGems Shop")
.setDescription(`
Balance: **${balance} <:NoobGems:1479770351473787023>**

VIP Role — 500
Name Color — 200
Server Shoutout — 100
`);

msg.channel.send({embeds:[embed]});

}

/* ===== BUY ===== */

if(cmd==="buy"){

const item=args[0];

let price=0;

if(item==="vip") price=500;
if(item==="color") price=200;
if(item==="shoutout") price=100;

if(price===0) return msg.reply("Item not found");

const balance=get(msg.author.id)||0;

if(balance<price)
return msg.reply("Not enough KmGems");

add(msg.author.id,-price);

purchaseHistory.push({
user:msg.author.tag,
item:item,
price:price
});

msg.channel.send(`✅ Purchased **${item}**`);

}

/* ===== GIVE ===== */

if(cmd==="give"){

if(!msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
return msg.reply("Admin only");

const amount=parseInt(args[0]);
const user=msg.mentions.users.first();

if(!amount||!user)
return msg.reply("Use ;give amount @user");

add(user.id,amount);

msg.channel.send(`${user} received **${amount} <:NoobGems:1479770351473787023>**`);

}

/* ===== HISTORY ===== */

if(cmd==="history"){

if(!msg.member.roles.cache.some(r=>r.name===MOD_ROLE))
return msg.reply("Moderator only");

let text=purchaseHistory
.slice(-10)
.map(h=>`${h.user} bought ${h.item} (${h.price})`)
.join("\n");

const embed=new EmbedBuilder()
.setColor("Orange")
.setTitle("🧾 Purchase History")
.setDescription(text||"No purchases");

msg.channel.send({embeds:[embed]});

}

/* ===== OWO ===== */

if(cmd==="owo"){

const embed=new EmbedBuilder()
.setColor("#2f3136")
.setTitle("💰 OWO → KmGems")
.setDescription(`
1k OWO = 500 <:NoobGems:1479770351473787023>
10k OWO = 5000 <:NoobGems:1479770351473787023>
20k OWO = 10000 <:NoobGems:1479770351473787023>
30k OWO = 15000 <:NoobGems:1479770351473787023>
40k OWO = 20000 <:NoobGems:1479770351473787023>
50k OWO = 25000 <:NoobGems:1479770351473787023>
`);

msg.channel.send({embeds:[embed]});

}

/* ===== TICKET PANEL ===== */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()
.setColor("#5865F2")
.setTitle("🎟 Ticket System")
.setDescription(`
🛡 Support → Need help
📋 Apply → Become staff
🎁 Reward → Claim reward
💰 Purchase → Buy KmGems
`)
.setImage("https://i.imgur.com/2s7X6kT.png");

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("ticket_support")
.setLabel("Support")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("ticket_apply")
.setLabel("Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("ticket_reward")
.setLabel("Reward")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("purchase_panel")
.setLabel("Purchase")
.setStyle(ButtonStyle.Secondary)

);

msg.channel.send({embeds:[embed],components:[row]});

}

/* ================= TOURNAMENT ================= */

/* ===== CREATE ===== */

if(cmd==="1v1"){

const size=args[0];
const server=args[1];
const map=args[2];
const name=args.slice(3).join(" ")||"1v1 Tournament";

tournament.active=true;
tournament.size=size;
tournament.server=server;
tournament.map=map;
tournament.name=name;
tournament.round=1;
tournament.players=[];
tournament.qualified=[];

msg.channel.send(`⚔ **${name} Created**`);

}

/* ===== BYE ===== */

if(cmd==="bye"){

tournament.players.push("bye1");

msg.channel.send("✅ Bye slot added");

}

/* ===== START ===== */

if(cmd==="start"){

const embed=new EmbedBuilder()
.setColor("Green")
.setTitle(`Round ${tournament.round}`)
.setDescription(`Map: ${tournament.map}`);

msg.channel.send({embeds:[embed]});

}

/* ===== QUAL ===== */

if(cmd==="qual"){

const player=args[0];

tournament.qualified.push(player);

msg.channel.send(`✅ Qualified: ${player}`);

}

/* ===== ROOM CODE ===== */

if(cmd==="code"){

const room=args[0];
const user=msg.mentions.users.first();

const embed=new EmbedBuilder()
.setColor("Blue")
.setTitle("🎮 Room Code")
.setDescription(`
Code: **${room}**
Player: ${user}
`);

msg.channel.send({embeds:[embed]});

}

/* ===== DELETE ===== */

if(cmd==="del"){

tournament.active=false;
tournament.players=[];
tournament.qualified=[];
tournament.round=1;

msg.channel.send("❌ Tournament deleted");

}

});

/* ================= BUTTON SYSTEM ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

/* PURCHASE */

if(interaction.customId==="purchase_panel"){

const embed=new EmbedBuilder()
.setColor("Gold")
.setTitle("💰 OWO Purchase")
.setDescription(`
1k OWO = 500 <:NoobGems:1479770351473787023>
10k OWO = 5000 <:NoobGems:1479770351473787023>
20k OWO = 10000 <:NoobGems:1479770351473787023>
30k OWO = 15000 <:NoobGems:1479770351473787023>
40k OWO = 20000 <:NoobGems:1479770351473787023>
50k OWO = 25000 <:NoobGems:1479770351473787023>
`);

interaction.reply({embeds:[embed],ephemeral:true});

}

/* NEXT ROUND */

if(interaction.customId==="next_round"){

tournament.round++;

interaction.reply(`⚔ Round ${tournament.round} started`);

}

/* WINNER */

if(interaction.customId==="announce_winner"){

const winner=interaction.user;

const embed=new EmbedBuilder()
.setColor("#FFD700")
.setTitle("🏆 Tournament Winner")
.setThumbnail(winner.displayAvatarURL({size:512}))
.setDescription(`Congratulations ${winner}`);

interaction.reply({embeds:[embed]});

}

});

client.login(process.env.TOKEN);
