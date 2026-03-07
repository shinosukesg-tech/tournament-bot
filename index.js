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

/* ================= EMOJIS ================= */

const VS = "<:VS:1477014161484677150>";
const TICK = "<:TICK:1467892699578236998>";

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

tournament.image = banner(); // change image when bracket starts

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

});

/* ================= BRACKET ================= */

function sendBracket(channel){

let text = `🏆 ROUND ${tournament.round}\n\n`;

tournament.matches.forEach((m,i)=>{

const p1 = m.p1==="BYE" ? "BYE" : `<@${m.p1}>`;
const p2 = m.p2==="BYE" ? "BYE" : `<@${m.p2}>`;

text+=`Match ${i+1}
${p1} ${VS} ${p2}
${m.winner ? TICK+" Completed":"⏳ Pending"}

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

/* NEXT ROUND */

if(interaction.customId==="next_round"){

if(!allFinished())
return interaction.reply({content:"Matches unfinished",ephemeral:true});

tournament.image = banner(); // change image each round

let winners = tournament.matches.map(m=>m.winner);

if(winners.length===1){

const user = await client.users.fetch(winners[0]);

const embed = new EmbedBuilder()

.setTitle("🏆 TOURNAMENT WINNER")
.setDescription(`${user}`)
.setThumbnail(user.displayAvatarURL({dynamic:true,size:128}))
.setImage(banner()) // new winner banner
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

});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
