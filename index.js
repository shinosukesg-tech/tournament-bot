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
PermissionsBitField,
SlashCommandBuilder,
REST,
Routes
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

/* ================= COMMAND CONTROL ================= */

let disabledChannels = new Set()

/* ================= EMOJIS ================= */

const CHECK="<:check:1480513506871742575>"
const CROSS="<:sg_cross:1480513567655592037>"
const VS="<:VS:1477014161484677150>"

/* ================= IMAGES ================= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"
const TICKET_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const BRACKET_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"
const HELP_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg"

/* ================= FILES ================= */

const tournamentFile="./tournament.json"
const welcomeFile="./welcome.json"

/* ================= LOAD SAVE ================= */

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

/* ================= FOOTER IST ================= */

function footer(){

const time = new Date().toLocaleTimeString("en-IN",{
timeZone:"Asia/Kolkata",
hour:"2-digit",
minute:"2-digit",
hour12:true
})

return {
text:`ShinosukeSG | ${time} IST`,
iconURL:FOOTER_IMG
}

}

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= DELETE NON EMBED BOT MESSAGES ================= */

client.on("messageCreate",msg=>{
if(msg.author.bot && msg.embeds.length===0){
msg.delete().catch(()=>{})
}
})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

message.delete().catch(()=>{})

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

let p=parseInt(args[0])
if(p<2 || p>32) return

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

👤 Players: ${players.length}/${maxPlayers}

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
.setLabel(`${players.length}/${maxPlayers}`)
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

/* ================= START BRACKET ================= */

if(cmd==="start"){

matches=[]
completedMatches=[]
winners=[]

let shuffled=[...players].sort(()=>Math.random()-0.5)

for(let i=0;i<shuffled.length;i+=2){

matches.push({
p1:shuffled[i],
p2:shuffled[i+1] || "BYE"
})

}

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

sendBracket(message.channel)

}

/* ================= QUALIFY ================= */

if(cmd==="qual"){

let player=message.mentions.users.first()
if(!player) return

winners.push(player.id)

let matchIndex=matches.findIndex(m=>m.p1===player.id || m.p2===player.id)

if(matchIndex!==-1){
completedMatches.push(matchIndex)
}

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

sendBracket(message.channel)

/* AUTO NEXT ROUND */

if(winners.length===matches.length){

setTimeout(()=>{
nextRound(message.channel)
},5000)

}

}

/* ================= ROOM CODE ================= */

if(cmd==="code"){

let code=args[0]
let p1=message.mentions.users.first()
let p2=message.mentions.users.last()

if(!code || !p1 || !p2) return

const embed=new EmbedBuilder()

.setTitle("🎮 Match Room Code")
.setDescription(`
${p1.username} ${VS} ${p2.username}

Room Code
\`\`\`
${code}
\`\`\`
`)
.setFooter(footer())

p1.send({embeds:[embed]}).catch(()=>{})
p2.send({embeds:[embed]}).catch(()=>{})

}

/* ================= NEXT ================= */

if(cmd==="next"){
nextRound(message.channel)
}

})

/* ================= NEXT ROUND ================= */

async function nextRound(channel){

if(winners.length===1){

let first = await client.users.fetch(winners[0])

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Winner")
.setThumbnail(first.displayAvatarURL())
.setDescription(`🥇 **${first.username}**`)
.setFooter(footer())

channel.send({embeds:[embed]})

players=[]
matches=[]
winners=[]
completedMatches=[]
round=1

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

return
}

players=[...winners]
winners=[]
matches=[]
completedMatches=[]
round++

for(let i=0;i<players.length;i+=2){

matches.push({
p1:players[i],
p2:players[i+1] || "BYE"
})

}

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

sendBracket(channel)

}

/* ================= BRACKET ================= */

async function sendBracket(channel){

let desc=""

for(let i=0;i<matches.length;i++){

let p1=matches[i].p1==="BYE"?"BYE":(await client.users.fetch(matches[i].p1)).username
let p2=matches[i].p2==="BYE"?"BYE":(await client.users.fetch(matches[i].p2)).username

desc+=`**Match ${i+1}**
${p1} ${VS} ${p2}

`

}

const embed=new EmbedBuilder()

.setTitle(`🏆 Round ${round}`)
.setDescription(desc)
.setImage(BRACKET_IMG)
.setFooter(footer())

channel.send({embeds:[embed]})

}

/* ================= REGISTER BUTTON ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

if(interaction.customId==="register"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

players.push(interaction.user.id)

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

updateRegister()

interaction.reply({content:"Registered",ephemeral:true})

}

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

updateRegister()

interaction.reply({content:"Removed",ephemeral:true})

}

})

/* ================= REGISTER UPDATE ================= */

function updateRegister(){

if(!registerMessage) return

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
Server: **${server}**
Map: **${map}**

👤 Players: ${players.length}/${maxPlayers}

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
.setLabel(`${players.length}/${maxPlayers}`)
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

client.login(process.env.TOKEN)
