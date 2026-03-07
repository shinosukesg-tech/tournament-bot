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
GatewayIntentBits.MessageContent,
GatewayIntentBits.DirectMessages
],
partials:["CHANNEL"]
});

const PREFIX="!";

/* ================= DATA ================= */

let tournament={
players:[],
matches:[],
started:false,
maxPlayers:0,
registerMessage:null
};

const VS="<:VS:1477014161484677150>";
const TICK="<:TICK:1467892699578236998>";

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`);
});

/* ================= AUTO WELCOME ================= */

client.on("guildMemberAdd",member=>{

const channel=member.guild.systemChannel;
if(!channel) return;

const embed=new EmbedBuilder()
.setTitle("WELCOME")
.setDescription(`Welcome ${member}`)
.setThumbnail(member.user.displayAvatarURL())
.setColor("Green");

channel.send({embeds:[embed]});

});

/* ================= COMMANDS ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return;
if(!message.content.startsWith(PREFIX)) return;

const args=message.content.slice(PREFIX.length).trim().split(/ +/);
const cmd=args.shift().toLowerCase();

/* ================= WELCOME ================= */

if(cmd==="welcome"){

const embed=new EmbedBuilder()
.setTitle("WELCOME")
.setDescription(`Welcome to **${message.guild.name}**`)
.setThumbnail(message.author.displayAvatarURL())
.setColor("Green");

message.channel.send({embeds:[embed]});

}

/* ================= CODE ================= */

if(cmd==="code"){

let code=args[0];
let user=message.mentions.users.first();

if(!code||!user) return message.reply("Usage: !code CODE @player");

let match=tournament.matches.find(
m=>m.p1===user.id||m.p2===user.id
);

if(!match) return message.reply("Player not in match");

let opponentId=match.p1===user.id?match.p2:match.p1;

const p1=await client.users.fetch(user.id);
const p2=await client.users.fetch(opponentId);

const embed=new EmbedBuilder()
.setTitle("Tournament Room Code")
.setDescription(`Code: **${code}**`)
.setColor("Blue");

p1.send({embeds:[embed]});
p2.send({embeds:[embed]});

message.channel.send("Code sent to both players");

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()
.setTitle("🎫 Ticket System")
.setDescription(`
🛡 Support
📋 Apply
🎁 Reward
`)
.setColor("#5865F2");

const row=new ActionRowBuilder().addComponents(

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

/* ================= TOURNAMENT PANEL ================= */

if(cmd==="tour"){

const players=parseInt(args[0]);
const server=args[1];
const map=args[2];
const reward=args.slice(3).join(" ");

tournament.players=[];
tournament.matches=[];
tournament.started=false;
tournament.maxPlayers=players;

const images=[
"https://media.discordapp.net/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://media.discordapp.net/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://media.discordapp.net/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
];

const embed=new EmbedBuilder()
.setTitle("ShinTours Tournament")
.setDescription(`
Players: **${players}**
Server: **${server}**
Map: **${map}**
Reward: **${reward}**
`)
.setImage(images[Math.floor(Math.random()*images.length)])
.setColor("Blue");

const row=new ActionRowBuilder().addComponents(

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

const msg=await message.channel.send({embeds:[embed],components:[row]});
tournament.registerMessage=msg;

}

/* ================= START ================= */

if(cmd==="start"){

if(tournament.players.length<2)
return message.reply("Not enough players");

tournament.started=true;

let shuffled=tournament.players.sort(()=>Math.random()-0.5);

for(let i=0;i<shuffled.length;i+=2){

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1]||"BYE",
winner:null
});

}

sendBracket(message.channel);

}

/* ================= BYE ================= */

if(cmd==="bye"){

tournament.matches.forEach(m=>{
if(m.p2==="BYE"){
m.winner=m.p1;
}
});

message.channel.send("BYE players qualified");

}

/* ================= QUAL ================= */

if(cmd==="qual"){

let arg=args[0];

if(arg==="bye1"){
tournament.matches[0].winner=tournament.matches[0].p1;
message.channel.send("Bye1 qualified");
return;
}

if(arg==="bye2"){
tournament.matches[1].winner=tournament.matches[1].p1;
message.channel.send("Bye2 qualified");
return;
}

let user=message.mentions.users.first();
if(!user) return;

let match=tournament.matches.find(
m=>m.p1===user.id||m.p2===user.id
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

tournament.matches.forEach((m,i)=>{

let tick1=m.winner===m.p1?` ${TICK}`:"";
let tick2=m.winner===m.p2?` ${TICK}`:"";

text+=`Match ${i+1}
<@${m.p1}>${tick1} ${VS} ${m.p2==="BYE"?"BYE":`<@${m.p2}>${tick2}`}

`;

});

const embed=new EmbedBuilder()
.setTitle("Tournament Bracket")
.setDescription(text)
.setColor("Blue");

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("next_round")
.setLabel("Next Round")
.setStyle(ButtonStyle.Success)

);

channel.send({embeds:[embed],components:[row]});

}

/* ================= BUTTONS ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

/* REGISTER */

if(interaction.customId==="register"){

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true});

if(tournament.players.length>=tournament.maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true});

tournament.players.push(interaction.user.id);

updateCounter();

interaction.reply({content:"Registered",ephemeral:true});

}

/* UNREGISTER */

if(interaction.customId==="unregister"){

if(!tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Not registered",ephemeral:true});

tournament.players=tournament.players.filter(id=>id!==interaction.user.id);

updateCounter();

interaction.reply({content:"Unregistered",ephemeral:true});

}

/* NEXT ROUND */

if(interaction.customId==="next_round"){

if(tournament.matches.some(m=>!m.winner))
return interaction.reply({content:"Finish all matches first",ephemeral:true});

let winners=tournament.matches.map(m=>m.winner);

if(winners.length===1){

const winner=await client.users.fetch(winners[0]);

const embed=new EmbedBuilder()
.setTitle("🏆 TOURNAMENT WINNER")
.setDescription(`${winner}`)
.setThumbnail(winner.displayAvatarURL({size:512}))
.setImage(winner.displayAvatarURL({size:1024}))
.setColor("Gold");

interaction.channel.send({embeds:[embed]});

tournament={players:[],matches:[],started:false,maxPlayers:0};

return;

}

tournament.matches=[];

for(let i=0;i<winners.length;i+=2){

tournament.matches.push({
p1:winners[i],
p2:winners[i+1]||"BYE",
winner:null
});

}

sendBracket(interaction.channel);

interaction.reply({content:"Next round created",ephemeral:true});

}

/* TICKETS */

let type=interaction.customId;

if(["support","apply","reward"].includes(type)){

let name=interaction.user.username;

const channel=await interaction.guild.channels.create({
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

/* ================= UPDATE COUNTER ================= */

async function updateCounter(){

if(!tournament.registerMessage) return;

const row=new ActionRowBuilder().addComponents(

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
