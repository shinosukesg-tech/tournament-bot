require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express");
const app = express();
app.get("/", (req,res)=>res.send("Alive"));
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

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
});

/* ================= VARIABLES ================= */

let welcomeChannel = null;
let tournament = null;

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`);
});

/* ================= UTIL ================= */

function isStaff(member){
return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
member.roles.cache.some(r=>r.name===STAFF_ROLE);
}

function shuffle(arr){
return [...arr].sort(()=>Math.random()-0.5);
}

function allFinished(){
return tournament.matches.every(m=>m.winner);
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg=>{

if(msg.author.bot) return;
if(!msg.content.startsWith(PREFIX)) return;

const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
const cmd = args.shift().toLowerCase();

/* ================= WELCOME SET ================= */

if(cmd==="welcome"){

if(!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

welcomeChannel = msg.channel.id;

msg.channel.send("✅ Welcome channel set.");

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel" && args[0]==="add"){

const embed = new EmbedBuilder()

.setColor("Blue")

.setTitle("🎟 Ticket System")

.setDescription(`
🛡 **Support** → Need help
📋 **Apply** → Staff application
🎁 **Reward** → Claim reward
`)

.setImage("https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png");

const row = new ActionRowBuilder().addComponents(

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

if(!size || !server || !map) return msg.reply("Usage: ;1v1 size server map name");

tournament = {

name,
server,
map,
maxPlayers:size,
players:[],
matches:[],
round:1

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
`);

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

const panel = await msg.channel.send({embeds:[embed],components:[row]});

tournament.panel = panel;

}

/* ================= START ================= */

if(cmd==="start"){

if(!tournament) return;

if(tournament.players.length<2)
return msg.reply("Not enough players");

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

if(!tournament) return;

const arg = args[0];

if(arg==="bye1"){

const match = tournament.matches.find(m=>m.p2==="BYE");

if(match){
match.winner = match.p1;
msg.channel.send("BYE player qualified");
}

return;
}

const user = msg.mentions.users.first();
if(!user) return;

const match = tournament.matches.find(
m=>m.p1===user.id || m.p2===user.id
);

if(match){

match.winner = user.id;

msg.channel.send(`${user.username} qualified`);

}

}

/* ================= ROOM CODE ================= */

if(cmd==="code"){

if(!isStaff(msg.member)) return;

const room = args[0];
const user = msg.mentions.users.first();

if(!room || !user) return msg.reply("Usage: ;code ROOMCODE @player");

const embed = new EmbedBuilder()

.setTitle("🎮 Match Room Code")

.setDescription(`
Your match room code is:

**${room}**

Good luck! 🍀
`)

.setColor("Green");

user.send({embeds:[embed]});

msg.channel.send(`📩 Room code sent to ${user}`);

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

.setColor("Green");

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

if(!tournament) return;

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true});

if(tournament.players.length>=tournament.maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true});

tournament.players.push(interaction.user.id);

interaction.reply({content:"Registered",ephemeral:true});

}

/* UNREGISTER */

if(interaction.customId==="unregister"){

if(!tournament) return;

tournament.players = tournament.players.filter(id=>id!==interaction.user.id);

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

.setThumbnail(user.displayAvatarURL())

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
const user = interaction.user;

const name = `${type}_${user.username}`.toLowerCase();

const channel = await interaction.guild.channels.create({

name,

type:ChannelType.GuildText,

permissionOverwrites:[

{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},

{
id:user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
}

]

});

channel.send(`Hello ${user}, staff will assist you.`);

interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
});

}

});

/* ================= WELCOME EVENT ================= */

client.on("guildMemberAdd", member=>{

if(!welcomeChannel) return;

const channel = member.guild.channels.cache.get(welcomeChannel);
if(!channel) return;

const ageDays = Math.floor(
(Date.now()-member.user.createdTimestamp)/86400000
);

const embed = new EmbedBuilder()

.setColor("#8e44ad")

.setAuthor({
name:`Welcome ${member.user.username}`,
iconURL:member.user.displayAvatarURL()
})

.setThumbnail(member.user.displayAvatarURL())

.setDescription(`
Welcome **${member.user.username}**
to 🏆 **${member.guild.name}**
Have fun here!
`)

.addFields(

{name:"🆔 User ID",value:member.id},

{name:"⏳ Account Age",value:`${ageDays} days`},

{name:"🎭 Display Name",value:member.displayName}

)

.setFooter({text:`${member.guild.memberCount} members`})

.setTimestamp();

channel.send({
content:`Welcome <@${member.id}>`,
embeds:[embed]
});

});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
