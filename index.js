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
maxPlayers:0,
registerMessage:null
};

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return;
if(!message.content.startsWith(PREFIX)) return;

const args = message.content.slice(PREFIX.length).trim().split(/ +/);
const cmd = args.shift().toLowerCase();

/* ================= TOURNAMENT PANEL ================= */

if(cmd === "tour"){

const players = parseInt(args[0]);
const server = args[1];
const map = args[2];
const reward = args.slice(3).join(" ");

tournament.players=[];
tournament.matches=[];
tournament.started=false;
tournament.maxPlayers = players;

const embed = new EmbedBuilder()
.setTitle("ShinTours Tournament")
.setDescription(`
Players: **${players}**
Server: **${server}**
Map: **${map}**
Reward: **${reward}**
`)
.setColor("Blue");

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`Players: 0/${players}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

);

const msg = await message.channel.send({embeds:[embed],components:[row]});
tournament.registerMessage = msg;

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

let advanced = 0;

tournament.matches.forEach(m=>{
if(!m.p2 && !m.winner){
m.winner = m.p1;
advanced++;
}
});

message.channel.send(`Auto qualified ${advanced} BYE players`);

}

/* ================= QUAL ================= */

if(cmd === "qual"){

let arg = args[0];

if(arg === "bye1"){
if(tournament.matches[0]){
tournament.matches[0].winner = tournament.matches[0].p1;
message.channel.send("Bye1 qualified");
}
return;
}

if(arg === "bye2"){
if(tournament.matches[1]){
tournament.matches[1].winner = tournament.matches[1].p1;
message.channel.send("Bye2 qualified");
}
return;
}

let user = message.mentions.users.first();
if(!user) return;

let match = tournament.matches.find(
m => m.p1 === user.id || m.p2 === user.id
);

if(match){
match.winner = user.id;
message.channel.send(`${user.username} qualified`);
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

text += `Match ${i+1}
<@${m.p1}> <:VS:1477014161484677150> <@${m.p2 || "BYE"}>

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

/* REGISTER */

if(interaction.customId === "register"){

if(tournament.started)
return interaction.reply({content:"Tournament started",ephemeral:true});

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true});

if(tournament.players.length >= tournament.maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true});

tournament.players.push(interaction.user.id);

updateCounter();

interaction.reply({content:"Registered",ephemeral:true});

}

/* UNREGISTER */

if(interaction.customId === "unregister"){

if(!tournament.players.includes(interaction.user.id))
return interaction.reply({content:"You are not registered",ephemeral:true});

tournament.players = tournament.players.filter(id=>id!==interaction.user.id);

updateCounter();

interaction.reply({content:"Unregistered",ephemeral:true});

}

});

/* ================= UPDATE COUNTER ================= */

async function updateCounter(){

if(!tournament.registerMessage) return;

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`Players: ${tournament.players.length}/${tournament.maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

);

await tournament.registerMessage.edit({components:[row]});

}

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
