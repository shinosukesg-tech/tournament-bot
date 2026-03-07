require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express");
const app = express();
app.get("/", (req,res)=>res.send("Bot Alive"));
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

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
});

const PREFIX = "!";
const TICK = "<:TICK:1467892699578236998>";
const VS = "<:VS:1477014161484677150>";

/* ================= TOURNAMENT DATA ================= */

let tour = {
players:[],
matches:[],
started:false,
info:{}
};

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`);
});

/* ================= WELCOME ================= */

client.on("guildMemberAdd", member=>{
const ch = member.guild.systemChannel;
if(!ch) return;

const embed = new EmbedBuilder()
.setTitle("WELCOME")
.setDescription(`Welcome ${member}`)
.setThumbnail(member.user.displayAvatarURL())
.setColor("Green");

ch.send({embeds:[embed]});
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return;
if(!message.content.startsWith(PREFIX)) return;

const args = message.content.slice(PREFIX.length).split(/ +/);
const cmd = args.shift().toLowerCase();

/* ================= TICKET PANEL ================= */

if(cmd === "ticketpanel"){

if(!message.member.roles.cache.some(r=>r.name==="Moderator"))
return message.reply("Moderator only");

const embed = new EmbedBuilder()
.setTitle("🎫 Ticket System")
.setDescription(`
Select an option below:

🛡 Support → Need help or have a question
📋 Apply → Apply to become staff
🎁 Reward → Claim your reward
`)
.setImage("https://media.discordapp.net/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png")
.setColor("#5865F2");

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("support")
.setLabel("Support")
.setEmoji("🛡")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("apply")
.setLabel("Apply")
.setEmoji("📋")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward")
.setLabel("Reward")
.setEmoji("🎁")
.setStyle(ButtonStyle.Primary)

);

message.channel.send({embeds:[embed],components:[row]});
}

/* ================= REGISTER ================= */

if(cmd === "register"){

if(tour.started) return;

if(!tour.players.includes(message.author.id)){
tour.players.push(message.author.id);
message.reply("Registered");
}

}

/* ================= TOURNAMENT ================= */

if(cmd === "tour"){

if(!message.member.roles.cache.some(r=>r.name==="Tournament Hoster"))
return message.reply("Tournament Hoster only");

const players = args[0];
const server = args[1];
const map = args[2];
const reward = args.slice(3).join(" ");

tour.info = {players,server,map,reward};

const embed = new EmbedBuilder()
.setTitle("ShinTours Tournament")
.setDescription(`
Players: **${players}**
Server: **${server}**
Map: **${map}**
Reward: **${reward}**

Type **!register** to join
`)
.setColor("Blue");

message.channel.send({embeds:[embed]});
}

/* ================= START ================= */

if(cmd === "start"){

tour.started = true;

let shuffled = tour.players.sort(()=>Math.random()-0.5);

for(let i=0;i<shuffled.length;i+=2){

tour.matches.push({
p1:shuffled[i],
p2:shuffled[i+1] || null,
winner:null
});

}

sendBracket(message.channel);
}

/* ================= QUALIFY ================= */

if(cmd === "qual"){

const user = message.mentions.users.first();
if(!user) return;

let match = tour.matches.find(
m=>m.p1===user.id || m.p2===user.id
);

if(match){
match.winner=user.id;
message.channel.send(`${TICK} ${user.username} qualified`);
}

}

});

/* ================= BRACKET ================= */

function sendBracket(channel){

let text="";

tour.matches.forEach((m,i)=>{

let t1 = m.winner===m.p1?` ${TICK}`:"";
let t2 = m.winner===m.p2?` ${TICK}`:"";

text+=`Match ${i+1}
<@${m.p1}>${t1} ${VS} <@${m.p2}>${t2}

`;

});

const embed = new EmbedBuilder()
.setTitle("Tournament Bracket")
.setDescription(text)
.setColor("Blue");

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("next_round")
.setLabel("Next Round")
.setStyle(ButtonStyle.Success)

);

channel.send({embeds:[embed],components:[row]});
}

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return;

/* ================= NEXT ROUND ================= */

if(interaction.customId==="next_round"){

if(tour.matches.some(m=>!m.winner))
return interaction.reply({content:"Matches unfinished",ephemeral:true});

let winners = tour.matches.map(m=>m.winner);

if(winners.length===1){

const winner = await client.users.fetch(winners[0]);

const embed = new EmbedBuilder()
.setTitle("🏆 TOURNAMENT WINNER")
.setDescription(`${winner}`)
.setThumbnail(winner.displayAvatarURL({size:512}))
.setImage(winner.displayAvatarURL({size:1024}))
.setColor("Gold");

interaction.channel.send({embeds:[embed]});

tour={players:[],matches:[],started:false,info:{}};
return;
}

tour.matches=[];

for(let i=0;i<winners.length;i+=2){

tour.matches.push({
p1:winners[i],
p2:winners[i+1]||null,
winner:null
});

}

sendBracket(interaction.channel);

interaction.reply({content:"Next round created",ephemeral:true});

}

/* ================= TICKET BUTTONS ================= */

if(["support","apply","reward"].includes(interaction.customId)){

const name = interaction.user.username;

const ch = await interaction.guild.channels.create({
name:`ticket-${name}`,
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
},
{
id:interaction.guild.roles.cache.find(r=>r.name==="Moderator").id,
allow:[PermissionsBitField.Flags.ViewChannel]
}
]
});

const close = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close Ticket")
.setStyle(ButtonStyle.Danger)
);

ch.send({
content:`${interaction.user} ticket opened`,
components:[close]
});

interaction.reply({content:`Ticket created ${ch}`,ephemeral:true});
}

/* ================= CLOSE ================= */

if(interaction.customId==="close_ticket"){

interaction.channel.delete();

}

});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
