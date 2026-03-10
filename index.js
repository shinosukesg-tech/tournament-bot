require("dotenv").config()

/* ========= EXPRESS ========= */

const express=require("express")
const app=express()

app.get("/",(req,res)=>res.send("Bot Running"))
app.listen(process.env.PORT||3000)

/* ========= DISCORD ========= */

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
PermissionsBitField,
ChannelType,
REST,
Routes
}=require("discord.js")

const fs=require("fs")

const commands=require("./commands.json")
const welcomeData=require("./welcome.json")

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

const PREFIX="!"

/* ========= IDs ========= */

const WELCOME_CHANNEL="1465234114318696498"
const TICKET_CHANNEL="1460635938727399537"
const MOD_ROLE="1429913618211672125"

/* ========= EMOJIS ========= */

const CHECK="<:check:1480513506871742575>"
const CROSS="<:sg_cross:1480513567655592037>"
const VS="<:VS:1477014161484677150>"

/* ========= FILE ========= */

const file="./tournament.json"

function load(){
try{
return JSON.parse(fs.readFileSync(file))
}catch{
return {
players:[],
matches:[],
winners:[],
round:1,
maxPlayers:0,
rewards:[]
}
}
}

function save(d){
fs.writeFileSync(file,JSON.stringify(d,null,2))
}

let db=load()

let players=db.players
let matches=db.matches
let winners=db.winners
let round=db.round
let maxPlayers=db.maxPlayers
let rewards=db.rewards

/* ========= READY ========= */

client.once("ready",async()=>{

console.log(`Logged in as ${client.user.tag}`)

try{

const rest=new REST({version:"10"}).setToken(process.env.TOKEN)

await rest.put(
Routes.applicationCommands(client.user.id),
{body:commands.commands}
)

console.log("Slash commands loaded")

}catch(err){

console.error("Slash command error:",err)

}

})

/* ========= WELCOME ========= */

client.on("guildMemberAdd",member=>{

let ch=member.guild.channels.cache.get(WELCOME_CHANNEL)
if(!ch) return

const embed=new EmbedBuilder()

.setTitle(`${welcomeData.title} ${member.user.username}`)
.setThumbnail(member.user.displayAvatarURL())

.setDescription(`
${welcomeData.emoji}

Welcome **${member.user.username}** to
🏆 **${welcomeData.server}**

${welcomeData.message}

🆔 **User ID**
${member.id}

📅 **Account Created**
${member.user.createdAt.toDateString()}

⏳ **Account Age**
${Math.floor((Date.now()-member.user.createdTimestamp)/86400000)} days

🎭 **Display Name**
${member.displayName}
`)

ch.send({
content:`Welcome <@${member.id}>`,
embeds:[embed]
})

})

/* ========= INTERACTIONS ========= */

client.on("interactionCreate",async i=>{

/* BUTTONS */

if(i.isButton()){

/* CREATE TICKET */

if(i.customId==="ticket"){

let ch=await i.guild.channels.create({

name:`ticket-${i.user.username}`,

type:ChannelType.GuildText,

permissionOverwrites:[

{
id:i.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},

{
id:i.user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
},

{
id:MOD_ROLE,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
}

]

})

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close Ticket")
.setStyle(ButtonStyle.Danger)

)

ch.send({
content:`Ticket for <@${i.user.id}>`,
components:[row]
})

return i.reply({content:`Ticket created: ${ch}`,ephemeral:true})

}

/* CLOSE TICKET */

if(i.customId==="close_ticket"){

if(!i.member.roles.cache.has(MOD_ROLE))
return i.reply({content:"Moderator only",ephemeral:true})

i.channel.delete()

}

/* JOIN TOURNAMENT */

if(i.customId==="join"){

if(players.includes(i.user.id))
return i.reply({content:"Already joined",ephemeral:true})

if(players.length>=maxPlayers)
return i.reply({content:"Tournament full",ephemeral:true})

players.push(i.user.id)

save({players,matches,winners,round,maxPlayers,rewards})

return i.reply({content:`${CHECK} Registered`,ephemeral:true})

}

}

/* SLASH COMMANDS */

if(i.isChatInputCommand()){

runCommand(i.commandName,i.options,i)

}

})

/* ========= PREFIX COMMANDS ========= */

client.on("messageCreate",msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).trim().split(/ +/)
const cmd=args.shift().toLowerCase()

runCommand(cmd,args,msg)

})

/* ========= COMMAND SYSTEM ========= */

async function runCommand(cmd,args,ctx){

/* CREATE TOURNAMENT */

if(cmd==="tour"){

let p=args.players||args[0]
let server=args.server||args[1]
let map=args.map||args[2]
let r1=args.reward1||args[3]
let r2=args.reward2||args[4]
let r3=args.reward3||args[5]

maxPlayers=p
rewards=[r1,r2,r3]

players=[]
matches=[]
winners=[]
round=1

save({players,matches,winners,round,maxPlayers,rewards})

const embed=new EmbedBuilder()

.setTitle("Tournament Registration")

.setDescription(`
Server: **${server}**
Map: **${map}**

Players **${players.length}/${maxPlayers}**

Rewards
🥇 ${r1}
🥈 ${r2}
🥉 ${r3}
`)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("join")
.setLabel("Join")
.setStyle(ButtonStyle.Success)

)

if(ctx.reply)
ctx.reply({embeds:[embed],components:[row]})
else
ctx.channel.send({embeds:[embed],components:[row]})

}

/* START */

if(cmd==="start"){

matches=[]
winners=[]

let shuffled=[...players].sort(()=>Math.random()-0.5)

for(let i=0;i<shuffled.length;i+=2){

matches.push({
p1:shuffled[i],
p2:shuffled[i+1]||"BYE"
})

}

save({players,matches,winners,round,maxPlayers,rewards})

sendBracket(ctx.channel||ctx)

}

/* QUALIFY */

if(cmd==="qual"){

let user=args.player||args[0]||ctx.options?.getUser("player")

if(!user) return

let id=user.id||user

winners.push(id)

save({players,matches,winners,round,maxPlayers,rewards})

}

/* NEXT ROUND */

if(cmd==="next"){

nextRound(ctx.channel||ctx)

}

/* ROOM CODE */

if(cmd==="code"){

let room=args.room||args[0]
let p1=args.p1||args[1]
let p2=args.p2||args[2]

const embed=new EmbedBuilder()

.setTitle("Match Code")

.setDescription(`
${p1} ${VS} ${p2}

Room Code
\`\`\`
${room}
\`\`\`
`)

ctx.reply
?ctx.reply({embeds:[embed]})
:ctx.channel.send({embeds:[embed]})

}

/* TICKET PANEL */

if(cmd==="ticketpanel"){

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("ticket")
.setLabel("Open Ticket")
.setStyle(ButtonStyle.Primary)

)

ctx.reply
?ctx.reply({content:"Support Panel",components:[row]})
:ctx.channel.send({content:"Support Panel",components:[row]})

}

}

/* ========= BRACKET ========= */

async function sendBracket(channel){

let desc=""

for(let i=0;i<matches.length;i++){

let p1=matches[i].p1
let p2=matches[i].p2

desc+=`Match ${i+1}
<@${p1}> ${VS} <@${p2}>

`
}

const embed=new EmbedBuilder()

.setTitle(`Round ${round}`)
.setDescription(desc)

channel.send({embeds:[embed]})

}

/* ========= NEXT ROUND ========= */

async function nextRound(channel){

if(winners.length<=1) return

if(winners.length===1){

let first=await client.users.fetch(winners[0])
let second=await client.users.fetch(winners[1]||winners[0])
let third=await client.users.fetch(winners[2]||winners[0])

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Results")

.setThumbnail(first.displayAvatarURL())

.setDescription(`
🥇 **${first.username}**
${rewards[0]}

🥈 ${second.username}
${rewards[1]}

🥉 ${third.username}
${rewards[2]}
`)

channel.send({embeds:[embed]})

players=[]
matches=[]
winners=[]
round=1

save({players,matches,winners,round,maxPlayers,rewards})

}

}

/* ========= LOGIN ========= */

client.login(process.env.TOKEN)
