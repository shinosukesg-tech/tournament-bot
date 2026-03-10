require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express")
const app = express()

app.get("/", (req,res)=>res.send("Bot Alive"))
app.listen(process.env.PORT || 3000)

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

const HELP_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"

const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg"

/* ================= FILES ================= */

const tournamentFile="./tournament.json"
const welcomeFile="./welcome.json"

/* ================= LOAD DATA ================= */

function load(file){
if(!fs.existsSync(file)) return {}
return JSON.parse(fs.readFileSync(file))
}

function save(file,data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

let data=load(tournamentFile)
let welcomeData=load(welcomeFile)

/* ================= TOURNAMENT ================= */

let players=data.players || []
let matches=data.matches || []
let winners=data.winners || []
let completedMatches=data.completedMatches || []
let round=data.round || 1
let maxPlayers=data.maxPlayers || 16

let server="Not Set"
let map="Not Set"
let rewards=[]

let registerMessage=null
let bracketMessage=null

/* ================= FOOTER ================= */

function footer(){
const d=new Date()
const time=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:true})
return {text:`ShinosukeSG | ${time}`,iconURL:FOOTER_IMG}
}

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= AUTO WELCOME ================= */

client.on("guildMemberAdd", async member=>{

let channelId=welcomeData[member.guild.id]
if(!channelId) return

let channel=member.guild.channels.cache.get(channelId)
if(!channel) return

const created=Math.floor(member.user.createdTimestamp/1000)

const embed=new EmbedBuilder()

.setTitle("👋 Welcome")
.setDescription(`Welcome ${member} to **${member.guild.name}**`)
.addFields(

{name:"🆔 User ID",value:member.id},
{name:"📅 Account Created",value:`<t:${created}:F>`}

)

.setThumbnail(member.user.displayAvatarURL())
.setFooter(footer())

channel.send({content:`Welcome ${member}`,embeds:[embed]})

})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

message.delete().catch(()=>{})

/* ================= HELP ================= */

if(cmd==="help"){

const embed=new EmbedBuilder()

.setTitle("🤖 Bot Commands")

.setDescription(`
🏆 **Tournament**
!1v1 <players> <server> <map> <reward1> <reward2> <reward3>
!start
!qual @player
!next
!bye
!code <code> @p1 @p2

🎫 **Tickets**
!ticketpanel

👋 **Welcome**
!welcome #channel
`)

.setImage(HELP_IMG)
.setFooter(footer())

return message.channel.send({embeds:[embed]})
}

/* ================= WELCOME SET ================= */

if(cmd==="welcome"){

let channel=message.mentions.channels.first()
if(!channel) return

welcomeData[message.guild.id]=channel.id
save(welcomeFile,welcomeData)

message.channel.send("Welcome channel saved")

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()

.setTitle("🎟 Ticket System")

.setDescription(`
🛡 Support
📋 Apply
🎁 Reward
`)

.setImage(TICKET_IMG)
.setFooter(footer())

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

)

message.channel.send({embeds:[embed],components:[row]})

}

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

let p=parseInt(args[0])
if(p<2 || p>32) return message.channel.send("Players must be 2-32")

maxPlayers=p
server=args[1]
map=args[2]

rewards=[args[3],args[4],args[5]]

players=[]
matches=[]
winners=[]
completedMatches=[]
round=1

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
Server: **${server}**
Map: **${map}**

👤 Players: 0/${maxPlayers}

Rewards
🥇 ${rewards[0]}
🥈 ${rewards[1]}
🥉 ${rewards[2]}
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
.setLabel(`0/${maxPlayers}`)
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

/* ================= CODE ================= */

if(cmd==="code"){

let code=args[0]

let p1=message.mentions.users.first()
let p2=message.mentions.users.last()

if(!p1 || !p2) return

const embed=new EmbedBuilder()

.setTitle("🎮 Match Code")

.setDescription(`
Players
${p1} ${VS} ${p2}

Server: **${server}**
Map: **${map}**

Code
\`\`\`
${code}
\`\`\`
`)

.setFooter(footer())

message.channel.send({embeds:[embed]})

}

/* ================= START ================= */

if(cmd==="start"){

if(players.length<2) return

let shuffled=[...players].sort(()=>Math.random()-0.5)

matches=[]

for(let i=0;i<shuffled.length;i+=2){

matches.push({p1:shuffled[i],p2:shuffled[i+1] || "BYE"})

}

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

sendBracket(message.channel)

}

/* ================= BYE ================= */

if(cmd==="bye"){

players.push("bye1")
players.push("bye2")

}

/* ================= QUAL ================= */

if(cmd==="qual"){

let u=args[0]

if(u==="bye1" || u==="bye2"){
winners.push(u)
}else{

let user=message.mentions.users.first()
if(!user) return

winners.push(user.id)

}

sendBracket(message.channel)

}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

/* ================= REGISTER ================= */

if(interaction.customId==="register"){

if(players.length>=maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true})

players.push(interaction.user.id)

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

interaction.reply({content:"Registered",ephemeral:true})

}

/* ================= UNREGISTER ================= */

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

interaction.reply({content:"Removed",ephemeral:true})

}

/* ================= TICKETS ================= */

if(["support","apply","reward"].includes(interaction.customId)){

const guild=interaction.guild
const modRole=guild.roles.cache.find(r=>r.name===MOD_ROLE)

const channel=await guild.channels.create({

name:`${interaction.customId}-${interaction.user.username}`,

type:ChannelType.GuildText,

permissionOverwrites:[

{ id:guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},

{ id:interaction.user.id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
},

{ id:modRole.id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
}

]

})

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close")
.setStyle(ButtonStyle.Danger)

)

channel.send({
content:`${interaction.user}`,
embeds:[new EmbedBuilder().setTitle("Ticket Opened").setFooter(footer())],
components:[row]
})

interaction.reply({content:`Ticket created ${channel}`,ephemeral:true})

}

/* ================= CLOSE ================= */

if(interaction.customId==="close_ticket"){

if(!interaction.member.roles.cache.find(r=>r.name===MOD_ROLE))
return interaction.reply({content:"Moderator only",ephemeral:true})

interaction.channel.delete()

}

})

/* ================= BRACKET ================= */

async function sendBracket(channel){

let desc=""

for(let i=0;i<matches.length;i++){

let p1=matches[i].p1==="BYE"?"BYE":(await client.users.fetch(matches[i].p1)).username
let p2=matches[i].p2==="BYE"?"BYE":(await client.users.fetch(matches[i].p2)).username

desc+=`Match ${i+1}\n${p1} ${VS} ${p2}\n\n`

}

const embed=new EmbedBuilder()

.setTitle(`🏆 Round ${round}`)
.setDescription(desc)
.setImage(BRACKET_IMG)
.setFooter(footer())

if(!bracketMessage){

bracketMessage=await channel.send({embeds:[embed]})

}else{

bracketMessage.edit({embeds:[embed]})

}

}

client.login(process.env.TOKEN)
