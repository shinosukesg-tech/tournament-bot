require("dotenv").config();
const express = require("express");
const {
Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle,
PermissionFlagsBits
} = require("discord.js");
const fs = require("fs");

/* ================= UPTIME ================= */

const app = express();
app.get("/", (req,res)=>res.send("Bot Online"));
app.listen(process.env.PORT || 3000);

/* ================= CLIENT ================= */

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]});

/* ================= CONFIG ================= */

const PREFIX="!";

const STAFF_ROLE="Tournament Staff";
const MOD_ROLE="Moderator";

/* ================= EMOJIS ================= */

const VS="<:VS:1477014161484677150>";
const CHECK="<:check:1480513506871742575>";
const CROSS="<:sg_cross:1480513567655592037>";

/* ================= IMAGES ================= */

const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png";
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480914400314392627/Screenshot_20260310_183459_Discord.jpg";
const REGISTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg";

/* ================= FILES ================= */

const files={
tournament:"./tournament.json",
ticket:"./ticket.json",
welcome:"./welcome.json"
};

Object.values(files).forEach(f=>{
if(!fs.existsSync(f)) fs.writeFileSync(f,JSON.stringify({}))
});

function load(f){
try{return JSON.parse(fs.readFileSync(f))}
catch{return{}}
}

function save(f,d){
fs.writeFileSync(f,JSON.stringify(d,null,2))
}

/* ================= HELPERS ================= */

function footer(){
return{
text:`ShinosukeSG | ${new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata"})} IST`,
iconURL:FOOTER_IMG
}
}

function isStaff(member){
return member.roles.cache.some(r=>[STAFF_ROLE,MOD_ROLE].includes(r.name)) || member.permissions.has(PermissionFlagsBits.Administrator)
}

/* ================= READY ================= */

client.on("ready",async()=>{

console.log(`Bot ready ${client.user.tag}`);

const commands=[

new SlashCommandBuilder()
.setName("help")
.setDescription("Show help"),

new SlashCommandBuilder()
.setName("ticketpanel")
.setDescription("Send ticket panel")

].map(c=>c.toJSON());

const rest=new REST({version:"10"}).setToken(process.env.TOKEN);

try{
await rest.put(
Routes.applicationCommands(client.user.id),
{body:commands}
);
}catch(e){console.log(e)}

});

/* ================= WELCOME ================= */

client.on("guildMemberAdd",member=>{

let data=load(files.welcome);

const embed=new EmbedBuilder()

.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setColor("#6E4AFF")

.setDescription(`Welcome **${member.user.username}** to **${member.guild.name}**`)

.addFields(
{name:"User ID",value:member.id},
{name:"Account Created",value:member.user.createdAt.toDateString()},
{name:"Display Name",value:member.displayName}
)

.setFooter(footer());

const channel=member.guild.systemChannel;

if(channel) channel.send({content:`Welcome <@${member.id}>`,embeds:[embed]});

data[member.id]={joined:new Date()};
save(files.welcome,data);

});

/* ================= MESSAGE COMMANDS ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return;
if(!message.content.startsWith(PREFIX)) return;

const args=message.content.slice(PREFIX.length).split(/ +/);
const cmd=args.shift().toLowerCase();

/* ================= HELP ================= */

if(cmd==="help"){

const embed=new EmbedBuilder()

.setTitle("Tournament Commands")

.setDescription(`
!tour <players> <server> <map> <reward1> <reward2> <reward3>

!start
!winner
!ticketpanel
`)

.setFooter(footer());

return message.channel.send({embeds:[embed]});

}

/* ================= TOURNAMENT PANEL ================= */

if(cmd==="tour" && isStaff(message.member)){

const maxPlayers=parseInt(args[0]);
const server=args[1];
const map=args[2];
const r1=args[3];
const r2=args[4];
const r3=args[5];

if(!maxPlayers) return message.reply("Enter player count");

let tData=load(files.tournament);

tData.current={
maxPlayers,
server,
map,
rewards:[r1,r2,r3],
players:[]
};

save(files.tournament,tData);

const embed=new EmbedBuilder()

.setTitle("🏆 1v1 Tournament")

.setImage(REGISTER_IMG)

.addFields(
{name:"Players",value:`0 / ${maxPlayers}`,inline:true},
{name:"Server",value:server,inline:true},
{name:"Map",value:map,inline:true},
{name:"Rewards",value:`🥇 ${r1}\n🥈 ${r2}\n🥉 ${r3}`}
)

.setFooter(footer());

const row=new ActionRowBuilder()

.addComponents(

new ButtonBuilder()
.setCustomId("join")
.setLabel("Register")
.setStyle(ButtonStyle.Success)
.setEmoji(CHECK),

new ButtonBuilder()
.setCustomId("leave")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)
.setEmoji(CROSS)

);

message.channel.send({embeds:[embed],components:[row]});

}

/* ================= START ================= */

if(cmd==="start" && isStaff(message.member)){

let tData=load(files.tournament);

if(!tData.current) return message.reply("No tournament");

const players=tData.current.players;

let desc="";

for(let i=0;i<players.length;i+=2){

const p1=await client.users.fetch(players[i]);
const p2=players[i+1]?await client.users.fetch(players[i+1]):"BYE";

desc+=`${p1} ${VS} ${p2}\n\n`;

}

const embed=new EmbedBuilder()

.setTitle("Tournament Bracket")

.setDescription(desc)

.setImage(BRACKET_IMG)

.setFooter(footer());

message.channel.send({embeds:[embed]});

}

/* ================= WINNER ================= */

if(cmd==="winner" && isStaff(message.member)){

const p1=message.mentions.users.at(0);
const p2=message.mentions.users.at(1);
const p3=message.mentions.users.at(2);

let tData=load(files.tournament);

const embed=new EmbedBuilder()

.setTitle("🏆 WINNERS")

.setThumbnail(p1.displayAvatarURL())

.setDescription(`🥇 ${p1}`)

.addFields(
{name:"🥈 Second",value:`${p2}\n${tData.current.rewards[1]}`},
{name:"🥉 Third",value:`${p3}\n${tData.current.rewards[2]}`}
)

.setFooter(footer());

message.channel.send({embeds:[embed]});

}

});

/* ================= BUTTONS ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

let tData=load(files.tournament);

if(!tData.current) return interaction.reply({content:"No tournament",ephemeral:true});

const players=tData.current.players;

/* JOIN */

if(interaction.customId==="join"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true});

if(players.length>=tData.current.maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true});

players.push(interaction.user.id);

save(files.tournament,tData);

return interaction.reply({content:`${CHECK} Registered`,ephemeral:true});

}

/* LEAVE */

if(interaction.customId==="leave"){

if(!players.includes(interaction.user.id))
return interaction.reply({content:"Not registered",ephemeral:true});

tData.current.players=players.filter(p=>p!==interaction.user.id);

save(files.tournament,tData);

return interaction.reply({content:`${CROSS} Unregistered`,ephemeral:true});

}

});

/* ================= LOGIN ================= */

process.on("unhandledRejection",console.error);
process.on("uncaughtException",console.error);

client.login(process.env.TOKEN);
