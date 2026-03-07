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
ChannelType,
PermissionsBitField
} = require("discord.js");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
});

const PREFIX="!";

const VS="<:VS:1477014161484677150>";
const TICK="<:TICK:1467892699578236998>";

/* ================= IMAGES ================= */

const BRACKET_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"
];

/* ================= DATA ================= */

let tournament={
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

/* ================= WELCOME ================= */

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

/* ---------- WELCOME ---------- */

if(cmd==="welcome"){

const embed=new EmbedBuilder()
.setTitle("WELCOME")
.setDescription(`Welcome to **${message.guild.name}**`)
.setThumbnail(message.author.displayAvatarURL())
.setColor("Green");

message.channel.send({embeds:[embed]});

}

/* ---------- CODE ---------- */

if(cmd==="code"){

let code=args[0];
let user=message.mentions.users.first();

if(!code||!user)
return message.reply("Usage: !code CODE @player");

let match=tournament.matches.find(
m=>m.p1===user.id||m.p2===user.id
);

if(!match) return message.reply("Player not in match");

let opponentId=match.p1===user.id?match.p2:match.p1;

const p1=await client.users.fetch(user.id);
const p2=await client.users.fetch(opponentId);

const embed=new EmbedBuilder()
.setTitle("Tournament Room Code")
.setDescription(`Room Code:\n\`\`\`${code}\`\`\``)
.setColor("Blue");

p1.send({embeds:[embed]});
p2.send({embeds:[embed]});

const msg=await message.channel.send("Code sent to both players");
setTimeout(()=>msg.delete().catch(()=>{}),2000);

}

/* ---------- TICKET PANEL ---------- */

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
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("apply")
.setLabel("Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward")
.setLabel("Reward")
.setStyle(ButtonStyle.Primary)

);

message.channel.send({embeds:[embed],components:[row]});

}

/* ---------- TOURNAMENT PANEL ---------- */

if(cmd==="tour"){

const players=parseInt(args[0]);
tournament.players=[];
tournament.matches=[];
tournament.started=false;
tournament.maxPlayers=players;

const embed=new EmbedBuilder()
.setTitle("ShinTours Tournament")
.setDescription(`Players: **${players}**`)
.setImage(BRACKET_IMAGES[Math.floor(Math.random()*BRACKET_IMAGES.length)])
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

/* ---------- START ---------- */

if(cmd==="start"){

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

/* ---------- QUAL ---------- */

if(cmd==="qual"){

let user=message.mentions.users.first();
if(!user) return;

let match=tournament.matches.find(
m=>m.p1===user.id||m.p2===user.id
);

if(match){
match.winner=user.id;

const msg=await message.channel.send(`${TICK} ${user.username} qualified`);
setTimeout(()=>msg.delete().catch(()=>{}),2000);
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
.setTitle("📊 LIVE BRACKET")
.setDescription(text)
.setImage(BRACKET_IMAGES[Math.floor(Math.random()*BRACKET_IMAGES.length)])
.setColor("Green");

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

tournament.players.push(interaction.user.id);
updateCounter();

interaction.reply({content:"Registered",ephemeral:true});

}

/* UNREGISTER */

if(interaction.customId==="unregister"){

tournament.players=tournament.players.filter(id=>id!==interaction.user.id);
updateCounter();

interaction.reply({content:"Unregistered",ephemeral:true});

}

/* NEXT ROUND */

if(interaction.customId==="next_round"){

if(tournament.matches.some(m=>!m.winner))
return interaction.reply({content:"Finish matches first",ephemeral:true});

let winners=tournament.matches.map(m=>m.winner);

if(winners.length===1){

const winner=await client.users.fetch(winners[0]);

const embed=new EmbedBuilder()
.setTitle("🏆 TOURNAMENT WINNER")
.setDescription(`${winner}`)
.setColor("Gold");

interaction.channel.send({embeds:[embed]});
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

}

/* TICKETS */

if(["support","apply","reward"].includes(interaction.customId)){

let name=interaction.user.username;

const channel=await interaction.guild.channels.create({
name:`${interaction.customId}_${name}`,
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

/* ================= COUNTER ================= */

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
