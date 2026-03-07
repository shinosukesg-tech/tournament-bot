require("dotenv").config();

/* ================= UPTIME SERVER ================= */

const express = require("express");
const app = express();

app.get("/", (req,res)=>{
res.send("Bot Online");
});

app.listen(3000,()=>{
console.log("Uptime server running");
});

/* ================= DISCORD ================= */

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
ChannelType,
PermissionsBitField
} = require("discord.js");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
});

const PREFIX = "!";

/* ================= TOURNAMENT DATA ================= */

let tournament = {
players:[],
matches:[],
started:false,
maxPlayers:0
};

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`);
});

/* ================= AUTO WELCOME ================= */

client.on("guildMemberAdd", member=>{

const channel = member.guild.systemChannel;
if(!channel) return;

const embed = new EmbedBuilder()
.setTitle("WELCOME")
.setDescription(`Welcome ${member}`)
.setThumbnail(member.user.displayAvatarURL())
.setColor("Green");

channel.send({embeds:[embed]});

});

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return;
if(!message.content.startsWith(PREFIX)) return;

const args = message.content.slice(PREFIX.length).trim().split(/ +/);
const cmd = args.shift().toLowerCase();

/* ================= TOURNAMENT PANEL ================= */

if(cmd === "tour"){

const players = args[0];
const server = args[1];
const map = args[2];
const reward = args.slice(3).join(" ");

tournament.players=[];
tournament.matches=[];
tournament.started=false;
tournament.maxPlayers = players;

const images = [
"https://media.discordapp.net/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://media.discordapp.net/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://media.discordapp.net/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
];

const embed = new EmbedBuilder()
.setTitle("ShinTours Tournament")
.setDescription(`
Players: **${players}**
Server: **${server}**
Map: **${map}**
Reward: **${reward}**
`)
.setImage(images[Math.floor(Math.random()*images.length)])
.setColor("Blue");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success)
);

message.channel.send({embeds:[embed],components:[row]});

}

/* ================= START ================= */

if(cmd === "start"){

if(tournament.players.length < 2)
return message.reply("Not enough players");

tournament.started = true;

let shuffled = tournament.players.sort(()=>Math.random()-0.5);

for(let i=0;i<shuffled.length;i+=2){

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1] || null,
winner:null
});

}

sendBracket(message.channel);

}

/* ================= BYE ================= */

if(cmd === "bye"){

tournament.matches.forEach(m=>{
if(!m.p2){
m.winner = m.p1
}
})

message.channel.send("BYE players advanced");

}

/* ================= QUAL ================= */

if(cmd === "qual"){

let arg = args[0];

if(arg === "bye1"){
tournament.matches[0].winner = tournament.matches[0].p1
message.channel.send("<:TICK:1467892699578236998> Bye1 qualified")
return
}

if(arg === "bye2"){
tournament.matches[1].winner = tournament.matches[1].p1
message.channel.send("<:TICK:1467892699578236998> Bye2 qualified")
return
}

let user = message.mentions.users.first();
if(!user) return;

let match = tournament.matches.find(
m => m.p1 === user.id || m.p2 === user.id
);

if(match){

match.winner = user.id;

message.channel.send(
`<:TICK:1467892699578236998> ${user.username} qualified`
);

}

}

/* ================= NEXT ROUND ================= */

if(cmd === "nextround"){

if(tournament.matches.some(m=>!m.winner))
return message.reply("Some matches unfinished");

let winners = tournament.matches.map(m=>m.winner);

if(winners.length === 1){

const winner = await client.users.fetch(winners[0]);

const embed = new EmbedBuilder()
.setTitle("🏆 TOURNAMENT WINNER")
.setDescription(`${winner}`)
.setThumbnail(winner.displayAvatarURL({size:512}))
.setImage(winner.displayAvatarURL({size:1024}))
.setColor("Gold");

message.channel.send({embeds:[embed]});

tournament = {players:[],matches:[],started:false};

return;
}

tournament.matches = [];

for(let i=0;i<winners.length;i+=2){

tournament.matches.push({
p1:winners[i],
p2:winners[i+1] || null,
winner:null
});

}

sendBracket(message.channel);

}

});

/* ================= BRACKET FUNCTION ================= */

function sendBracket(channel){

let text = "";

tournament.matches.forEach((m,i)=>{

let tick1 = m.winner === m.p1 ? " <:TICK:1467892699578236998>" : "";
let tick2 = m.winner === m.p2 ? " <:TICK:1467892699578236998>" : "";

text += `Match ${i+1}
<@${m.p1}>${tick1} <:VS:1477014161484677150> <@${m.p2}>${tick2}

`;

});

const embed = new EmbedBuilder()
.setTitle("Tournament Bracket")
.setDescription(text)
.setColor("Blue");

channel.send({embeds:[embed]});

}

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return;

/* REGISTER BUTTON */

if(interaction.customId === "register"){

if(tournament.started)
return interaction.reply({content:"Tournament started",ephemeral:true});

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true});

if(tournament.players.length >= tournament.maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true});

tournament.players.push(interaction.user.id);

interaction.reply({
content:`Registered (${tournament.players.length}/${tournament.maxPlayers})`,
ephemeral:true
});

return;

}

/* TICKET BUTTONS */

let name = interaction.user.username;
let type = interaction.customId;

if(["support","apply","reward"].includes(type)){

const channel = await interaction.guild.channels.create({
name:`${type}_${name}`,
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

channel.send(`${interaction.user} ticket opened`);

interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
});

}

});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
