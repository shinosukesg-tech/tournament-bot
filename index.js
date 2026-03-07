require("dotenv").config();

/* ================= UPTIME ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Alive"));
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

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const MOD_ROLE = "Moderator";
const SERVER_NAME = "ShinosukeSG";

const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
});

let tournament = null;

/* ================= UTIL ================= */

const isStaff = (member)=>
member.permissions.has(PermissionsBitField.Flags.Administrator) ||
member.roles.cache.some(r=>r.name===STAFF_ROLE);

const shuffle = (arr)=>[...arr].sort(()=>Math.random()-0.5);

const allFinished = () =>
tournament && tournament.matches.every(m=>m.winner);

/* ================= WELCOME ================= */

client.on("guildMemberAdd", async(member)=>{

const channel = member.guild.channels.cache.find(c=>c.name==="welcome");
if(!channel) return;

const created = member.user.createdAt;

const days = Math.floor(
(Date.now()-created.getTime())/(1000*60*60*24)
);

const position =
member.guild.members.cache
.sort((a,b)=>a.joinedTimestamp-b.joinedTimestamp)
.map(m=>m.id)
.indexOf(member.id)+1;

const embed = new EmbedBuilder()
.setColor("#9b59ff")
.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setDescription(`Welcome **${member.user.username}** to 🏆 • **${SERVER_NAME}**! 🎉
Have an awesome time with us!`)
.addFields(
{name:"🆔 User ID",value:member.id},
{name:"📅 Account Created",value:`${created.toLocaleDateString()}\n(${days} days ago)`},
{name:"⏳ Account Age",value:`${days} days`,inline:true},
{name:"👑 Server Join Position",value:`${position}th member`,inline:true},
{name:"🎭 Display Name",value:member.displayName}
)
.setFooter({text:`Join the fun • 🏆 • ${SERVER_NAME} • ${member.guild.memberCount} members`})
.setTimestamp();

channel.send({
content:`Welcome <@${member.id}> 👋`,
embeds:[embed]
});

});

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg=>{

if(msg.author.bot || !msg.content.startsWith(PREFIX)) return;

const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
const cmd = args.shift().toLowerCase();

/* ===== TICKET PANEL ===== */

if(cmd==="ticketpanel" && args[0]==="add"){

const embed = new EmbedBuilder()
.setColor("#5865F2")
.setTitle("🎫 Ticket System")
.setDescription(`
Select an option below:

🛡 Support → Need help or have a question
📋 Apply → Apply to become staff
🎁 Reward → Claim your reward
`)
.setImage(BANNER);

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

msg.channel.send({embeds:[embed],components:[row]});
}

/* ===== CREATE TOURNAMENT ===== */

if(cmd==="1v1"){

if(!isStaff(msg.member)) return;

const size=parseInt(args[0]);
const server=args[1];
const map=args[2];

tournament={
size,
server,
map,
players:[],
matches:[],
round:1
};

msg.channel.send("Tournament created.");
}

/* ===== START ===== */

if(cmd==="start"){

if(!tournament) return;

const shuffled=shuffle(tournament.players);

for(let i=0;i<shuffled.length;i+=2){

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1],
winner:null
});

}

msg.channel.send("Bracket started.");
}

/* ===== QUAL ===== */

if(cmd==="qual"){

if(!tournament) return;

const user = msg.mentions.users.first();
if(!user) return;

const match=tournament.matches.find(
m=>m.p1===user.id || m.p2===user.id
);

if(!match) return;

match.winner=user.id;

msg.channel.send(`${user.username} qualified.`);
}

/* ===== ROOM CODE ===== */

if(cmd==="code"){

if(!tournament) return;

const room=args[0];
const user=msg.mentions.users.first();

if(!room || !user) return;

const match=tournament.matches.find(
m=>m.p1===user.id || m.p2===user.id
);

if(!match) return;

const opponentId = match.p1===user.id ? match.p2 : match.p1;

const embed=new EmbedBuilder()
.setColor("#ff003c")
.setTitle("🎮 MATCH ROOM")
.setDescription(`
🏆 ${SERVER_NAME}

ROOM CODE
\`\`\`${room}\`\`\`

🌍 ${tournament.server}
🗺 ${tournament.map}
`);

await user.send({embeds:[embed]}).catch(()=>{});

if(opponentId){

const opponent=await client.users.fetch(opponentId);
opponent.send({embeds:[embed]}).catch(()=>{});

}

msg.channel.send("Room code sent.");
}

/* ===== DELETE ===== */

if(cmd==="del"){

tournament=null;
msg.channel.send("Tournament deleted.");

}

});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i=>{

if(!i.isButton()) return;

/* ===== CREATE TICKET ===== */

if(["support","apply","reward"].includes(i.customId)){

const channel = await i.guild.channels.create({
name:`ticket-${i.user.username}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{ id:i.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{ id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel]},
{
id:i.guild.roles.cache.find(r=>r.name===MOD_ROLE)?.id,
allow:[PermissionsBitField.Flags.ViewChannel]
}
]
});

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close Ticket")
.setStyle(ButtonStyle.Danger)

);

channel.send({
content:`Ticket created by <@${i.user.id}>`,
components:[row]
});

i.reply({content:"Ticket created!",ephemeral:true});

}

if(i.customId==="close_ticket"){

await i.reply({content:"Closing ticket...",ephemeral:true});

setTimeout(()=>{
i.channel.delete().catch(()=>{});
},1500);

}

/* ===== NEXT ROUND ===== */

if(i.customId==="next"){

if(!allFinished()) return;

const winners = tournament.matches.map(m=>m.winner);

tournament.matches=[];
tournament.round++;

for(let i=0;i<winners.length;i+=2){

tournament.matches.push({
p1:winners[i],
p2:winners[i+1],
winner:null
});

}

i.reply({content:"Next round started.",ephemeral:true});
}

/* ===== ANNOUNCE WINNER ===== */

if(i.customId==="announce"){

try{

const winnerId=tournament.matches[0].winner;
if(!winnerId) return;

const user=await client.users.fetch(winnerId);

const embed=new EmbedBuilder()
.setColor("#FFD700")
.setTitle("🏆 TOURNAMENT WINNER")
.setThumbnail(user.displayAvatarURL({dynamic:true}))
.setDescription(`Congratulations <@${winnerId}>`)
.setImage(BANNER);

await i.channel.send({embeds:[embed]});

tournament=null;

}catch(err){
console.log(err);
}

}

});

client.login(process.env.TOKEN);
