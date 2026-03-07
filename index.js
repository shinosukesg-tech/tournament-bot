require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express");
const app = express();
app.get("/", (req,res)=>res.send("Bot Online"));
app.listen(process.env.PORT || 3000);

/* ================= DISCORD ================= */

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

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const MOD_ROLE = "Moderator";

/* ================= BANNERS ================= */

const BANNERS = [
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
];

function banner(){
return BANNERS[Math.floor(Math.random()*BANNERS.length)];
}

/* ================= CLIENT ================= */

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent,
GatewayIntentBits.DirectMessages
],
partials:["CHANNEL"]
});

/* ================= VARIABLES ================= */

let welcomeChannel = null;
let ticketCategory = null;

let tournament = null;

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`);
});

/* ================= UTIL ================= */

function shuffle(arr){
return [...arr].sort(()=>Math.random()-0.5);
}

function isStaff(member){
return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
member.roles.cache.some(r=>r.name===STAFF_ROLE);
}

function autoDelete(msg){
setTimeout(()=>msg.delete().catch(()=>{}),2000);
}

function allFinished(){
return tournament.matches.every(m=>m.winner);
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg=>{

if(msg.author.bot){
if(!msg.embeds.length) autoDelete(msg);
return;
}

if(!msg.content.startsWith(PREFIX)) return;

const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
const cmd = args.shift().toLowerCase();

await msg.delete().catch(()=>{});

/* ================= WELCOME SET ================= */

if(cmd==="welcome"){

if(!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

welcomeChannel = msg.channel.id;

const m = await msg.channel.send("✅ Welcome channel set");
autoDelete(m);

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel" && args[0]==="add"){

if(!ticketCategory){

ticketCategory = await msg.guild.channels.create({
name:"tickets",
type:ChannelType.GuildCategory
});

}

const embed = new EmbedBuilder()

.setColor("Blue")

.setTitle("🎫 Ticket System")

.setDescription(`
🛡 Support → Need help
📋 Apply → Staff application
🎁 Reward → Claim reward
`)

.setImage(banner());

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("ticket_support")
.setLabel("🛡 Support")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("ticket_apply")
.setLabel("📋 Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("ticket_reward")
.setLabel("🎁 Reward")
.setStyle(ButtonStyle.Primary)

);

msg.channel.send({embeds:[embed],components:[row]});

}

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

if(!isStaff(msg.member)) return;

const size = parseInt(args[0]);
const server = args[1];
const map = args[2];
const name = args.slice(3).join(" ") || "Tournament";

tournament = {

name,
server,
map,
maxPlayers:size,
players:[],
matches:[],
round:1,
image:banner()

};

const embed = new EmbedBuilder()

.setColor("Red")

.setTitle(`🏆 ${name}`)

.setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${server}**
🗺 Map: **${map}**
👥 Players: **0/${size}**
Status: **OPEN**
`)

.setImage(tournament.image);

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

);

tournament.panel = await msg.channel.send({
embeds:[embed],
components:[row]
});

}

/* ================= START ================= */

if(cmd==="start"){

const shuffled = shuffle(tournament.players);

tournament.matches=[];

for(let i=0;i<shuffled.length;i+=2){

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1] || "BYE",
winner:null
});

}

sendBracket(msg.channel);

}

/* ================= QUAL ================= */

if(cmd==="qual"){

const arg = args[0];

if(arg==="bye1" || arg==="bye2"){

let index = arg==="bye1" ? 0 : 1;

if(tournament.matches[index]){
tournament.matches[index].winner = tournament.matches[index].p1;
}

sendBracket(msg.channel);

return;
}

const user = msg.mentions.users.first();

const match = tournament.matches.find(
m=>m.p1===user.id || m.p2===user.id
);

match.winner = user.id;

sendBracket(msg.channel);

}

/* ================= ROOM CODE ================= */

if(cmd==="code"){

const code = args[0];
const user = msg.mentions.users.first();

const match = tournament.matches.find(
m=>m.p1===user.id || m.p2===user.id
);

const p1 = await client.users.fetch(match.p1);
const p2 = match.p2==="BYE" ? null : await client.users.fetch(match.p2);

const embed = new EmbedBuilder()

.setTitle("🎮 Match Room Code")

.setDescription(`
Match
${p1} vs ${p2 || "BYE"}

Server: **${tournament.server}**
Map: **${tournament.map}**

Room Code
\`\`\`
${code}
\`\`\`
`)

.setImage(tournament.image);

p1.send({embeds:[embed]});
if(p2) p2.send({embeds:[embed]});

msg.channel.send("📩 Code sent to players");

}

});

/* ================= BRACKET ================= */

function sendBracket(channel){

let text = `🏆 ROUND ${tournament.round}\n\n`;

tournament.matches.forEach((m,i)=>{

const p1 = m.p1==="BYE" ? "BYE" : `<@${m.p1}>`;
const p2 = m.p2==="BYE" ? "BYE" : `<@${m.p2}>`;

text+=`Match ${i+1}
${p1} VS ${p2}
${m.winner ? "✔ Complete":"⏳ Pending"}

`;

});

const embed = new EmbedBuilder()

.setTitle("📊 Tournament Bracket")

.setDescription(text)

.setImage(tournament.image);

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("next_round")
.setLabel("Next Round")
.setStyle(ButtonStyle.Primary)

);

channel.send({embeds:[embed],components:[row]});

}

/* ================= BUTTON EVENTS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return;

/* REGISTER */

if(interaction.customId==="register"){

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true});

if(tournament.players.length>=tournament.maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true});

tournament.players.push(interaction.user.id);

const embed = new EmbedBuilder()

.setColor("Red")

.setTitle(`🏆 ${tournament.name}`)

.setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
Status: **OPEN**
`)

.setImage(tournament.image);

tournament.panel.edit({embeds:[embed]});

interaction.reply({content:"Registered",ephemeral:true});

}

/* UNREGISTER */

if(interaction.customId==="unregister"){

tournament.players = tournament.players.filter(
id=>id!==interaction.user.id
);

interaction.reply({content:"Unregistered",ephemeral:true});

}

/* NEXT ROUND */

if(interaction.customId==="next_round"){

if(!allFinished())
return interaction.reply({content:"Matches unfinished",ephemeral:true});

let winners = tournament.matches.map(m=>m.winner);

if(winners.length===1){

const user = await client.users.fetch(winners[0]);

const embed = new EmbedBuilder()

.setTitle("🏆 TOURNAMENT WINNER")

.setDescription(`${user}`)

.setImage(tournament.image)

.setColor("Gold");

interaction.channel.send({embeds:[embed]});

tournament=null;

return;
}

tournament.round++;

tournament.matches=[];

for(let i=0;i<winners.length;i+=2){

tournament.matches.push({

p1:winners[i],
p2:winners[i+1] || "BYE",
winner:null

});

}

sendBracket(interaction.channel);

}

/* ================= TICKETS ================= */

if(interaction.customId.startsWith("ticket_")){

const type = interaction.customId.split("_")[1];

const channel = await interaction.guild.channels.create({

name:`${type}_${interaction.user.username}`,

type:ChannelType.GuildText,

parent:ticketCategory,

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
},

{
id:interaction.guild.roles.cache.find(r=>r.name===MOD_ROLE).id,
allow:[PermissionsBitField.Flags.ViewChannel]
}

]

});

const closeRow = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("🔒 Close Ticket")
.setStyle(ButtonStyle.Secondary)

);

channel.send({
content:`${interaction.user}`,
embeds:[new EmbedBuilder().setTitle(`Ticket: ${type}`).setColor("Green")],
components:[closeRow]
});

interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
});

}

/* CLOSE TICKET */

if(interaction.customId==="close_ticket"){

if(!interaction.member.roles.cache.some(r=>r.name===MOD_ROLE))
return interaction.reply({content:"Only moderators can close tickets",ephemeral:true});

interaction.channel.delete();

}

});

/* ================= WELCOME EVENT ================= */

client.on("guildMemberAdd", member=>{

if(!welcomeChannel) return;

const channel = member.guild.channels.cache.get(welcomeChannel);

const created = new Date(member.user.createdTimestamp).toDateString();
const age = Math.floor((Date.now()-member.user.createdTimestamp)/86400000);

const embed = new EmbedBuilder()

.setColor("#8e44ad")

.setTitle(`Welcome ${member.user.username} 👋`)

.setThumbnail(member.user.displayAvatarURL())

.setDescription(`
👋 Welcome **${member.user.username}**

🏆 ${member.guild.name}
Have fun here!
`)

.addFields(

{name:"🆔 User ID",value:member.id},

{name:"📅 Account Created",value:created},

{name:"⏳ Account Age",value:`${age} days`},

{name:"🎭 Display Name",value:member.displayName}

)

.setImage(banner())

.setFooter({text:"Enjoy the fun 😀"})

.setTimestamp();

channel.send({
content:`Welcome <@${member.id}>`,
embeds:[embed]
});

});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
