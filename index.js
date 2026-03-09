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
} = require("discord.js")

const fs = require("fs")

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

const PREFIX="!"

/* ================= ROLES ================= */

const MOD_ROLE="Moderator"
const STAFF_ROLE="Tournament Staff"

/* ================= EMOJIS ================= */

const CHECK="<:check:1480513506871742575>"
const CROSS="<:sg_cross:1480513567655592037>"
const VS="<:VS:1477014161484677150>"
const DONE="<:check:1480513506871742575>"

/* ================= IMAGES ================= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"
const TICKET_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const BRACKET_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"

const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg"

/* ================= TOURNAMENT SAVE ================= */

let tournamentFile="./tournament.json"

function loadTournament(){
if(!fs.existsSync(tournamentFile)) return {}
return JSON.parse(fs.readFileSync(tournamentFile))
}

function saveTournament(data){
fs.writeFileSync(tournamentFile,JSON.stringify(data,null,2))
}

let data=loadTournament()

let players=data.players || []
let matches=data.matches || []
let winners=data.winners || []
let completedMatches=data.completedMatches || []
let round=data.round || 1
let maxPlayers=data.maxPlayers || 16

let server=data.server || "Unknown"
let map=data.map || "Unknown"
let reward1=data.reward1 || "-"
let reward2=data.reward2 || "-"
let reward3=data.reward3 || "-"

let registerMessage=null
let bracketMessage=null

/* ================= FOOTER ================= */

function footer(){
const d=new Date()
const time=d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:true})
return {text:`ShinosukeSG | ${time}`,iconURL:FOOTER_IMG}
}

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()

.setTitle("🎫 Shin Support Tickets")

.setDescription(`
🛡 **Support**
📋 **Apply**
🎁 **Reward**
`)
.setImage(TICKET_IMG)
.setFooter(footer())

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

)

message.channel.send({embeds:[embed],components:[row]})

}

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

if(!message.member.roles.cache.find(r=>r.name===STAFF_ROLE)) return

players=[]
matches=[]
winners=[]
completedMatches=[]
round=1

maxPlayers=parseInt(args[0])||16
server=args[1] || "Unknown"
map=args[2] || "Unknown"
reward1=args[3] || "-"
reward2=args[4] || "-"
reward3=args[5] || "-"

saveTournament({players,matches,winners,completedMatches,round,maxPlayers,server,map,reward1,reward2,reward3})

const embed=new EmbedBuilder()

.setTitle("🏆 ShinTours Tournament")

.setDescription(`
🌍 **Server:** ${server}
🗺 **Map:** ${map}

🎁 **Rewards**
🥇 ${reward1}
🥈 ${reward2}
🥉 ${reward3}

👤 **Players:** ${players.length}/${maxPlayers}

Hosted by **${STAFF_ROLE}**
`)
.setImage(REGISTER_IMG)
.setFooter(footer())

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji(CHECK)
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 ${players.length}/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setEmoji(CROSS)
.setStyle(ButtonStyle.Danger)

)

registerMessage=await message.channel.send({embeds:[embed],components:[row]})

}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

/* ================= REGISTER ================= */

if(interaction.customId==="register"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

players.push(interaction.user.id)

saveTournament({players,matches,winners,completedMatches,round,maxPlayers,server,map,reward1,reward2,reward3})

updateRegister()

interaction.reply({content:"Registered",ephemeral:true})

}

/* ================= UNREGISTER ================= */

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)

saveTournament({players,matches,winners,completedMatches,round,maxPlayers,server,map,reward1,reward2,reward3})

updateRegister()

interaction.reply({content:"Removed",ephemeral:true})

}

/* ================= TICKETS ================= */

if(["support","apply","reward"].includes(interaction.customId)){

const guild=interaction.guild
const modRole=guild.roles.cache.find(r=>r.name===MOD_ROLE)

let category=guild.channels.cache.find(c=>c.name==="Shin Support" && c.type===ChannelType.GuildCategory)

if(!category){
category=await guild.channels.create({
name:"Shin Support",
type:ChannelType.GuildCategory
})
}

const channel=await guild.channels.create({

name:`${interaction.customId}-${interaction.user.username}`,
type:ChannelType.GuildText,
parent:category.id,

permissionOverwrites:[
{
id:guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},
{
id:interaction.user.id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
},
{
id:modRole?.id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
}
]

})

const embed=new EmbedBuilder()
.setTitle(`🎫 ${interaction.customId} Ticket`)
.setDescription(`User: ${interaction.user}`)
.setImage(TICKET_IMG)
.setFooter(footer())

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close Ticket")
.setStyle(ButtonStyle.Danger)
)

await channel.send({content:`${interaction.user}`,embeds:[embed],components:[row]})

interaction.reply({content:`Ticket created: ${channel}`,ephemeral:true})

}

/* ================= CLOSE ================= */

if(interaction.customId==="close_ticket"){

if(!interaction.member.roles.cache.find(r=>r.name===MOD_ROLE))
return interaction.reply({content:"Moderator only.",ephemeral:true})

interaction.channel.delete()

}

})

/* ================= UPDATE REGISTER ================= */

function updateRegister(){

if(!registerMessage) return

const embed=new EmbedBuilder()

.setTitle("🏆 ShinTours Tournament")

.setDescription(`
🌍 **Server:** ${server}
🗺 **Map:** ${map}

🎁 **Rewards**
🥇 ${reward1}
🥈 ${reward2}
🥉 ${reward3}

👤 **Players:** ${players.length}/${maxPlayers}

Hosted by **${STAFF_ROLE}**
`)
.setImage(REGISTER_IMG)
.setFooter(footer())

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji(CHECK)
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 ${players.length}/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setEmoji(CROSS)
.setStyle(ButtonStyle.Danger)

)

registerMessage.edit({embeds:[embed],components:[row]}).catch(()=>{})

}

/* ================= BRACKET ================= */

async function sendBracket(channel){

let desc=""

for(let i=0;i<matches.length;i++){

let p1=matches[i].p1==="BYE"?"BYE":(await client.users.fetch(matches[i].p1)).username
let p2=matches[i].p2==="BYE"?"BYE":(await client.users.fetch(matches[i].p2)).username

let tick = completedMatches.includes(i) ? ` ${DONE}` : ""

desc+=`**Match ${i+1}${tick}**\n${p1} ${VS} ${p2}\n\n`

}

const embed=new EmbedBuilder()

.setTitle(`🏆 Round ${round}`)
.setDescription(desc)
.setImage(BRACKET_IMG)
.setFooter(footer())

if(!bracketMessage){

bracketMessage=await channel.send({embeds:[embed]})

}else{

bracketMessage.edit({embeds:[embed]}).catch(()=>{})

}

}

client.login(process.env.TOKEN)
