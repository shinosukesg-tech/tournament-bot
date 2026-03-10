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

/* ================= EMOJIS ================= */

const CHECK="<:check:1480513506871742575>"
const CROSS="<:sg_cross:1480513567655592037>"
const VS="<:VS:1477014161484677150>"

/* ================= IMAGES ================= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"
const BRACKET_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg"

/* ================= FILES ================= */

const tournamentFile="./tournament.json"

function load(file){
if(!fs.existsSync(file)) return {}
return JSON.parse(fs.readFileSync(file))
}

function save(file,data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

let data=load(tournamentFile)

/* ================= TOURNAMENT ================= */

let players=data.players || []
let matches=data.matches || []
let winners=data.winners || []
let round=data.round || 1
let maxPlayers=data.maxPlayers || 16

let rewards=[]

let registerMessage=null

/* ================= FOOTER ================= */

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

client.on("ready",async()=>{

console.log(`Logged in as ${client.user.tag}`)

/* REGISTER SLASH COMMANDS */

const commands=[

new SlashCommandBuilder()
.setName("start")
.setDescription("Start the tournament"),

new SlashCommandBuilder()
.setName("qual")
.setDescription("Qualify player")
.addUserOption(o=>o.setName("player").setDescription("Player").setRequired(true)),

new SlashCommandBuilder()
.setName("next")
.setDescription("Next round"),

new SlashCommandBuilder()
.setName("code")
.setDescription("Send room code")
.addStringOption(o=>o.setName("room").setDescription("Room code").setRequired(true))
.addUserOption(o=>o.setName("p1").setDescription("Player 1").setRequired(true))
.addUserOption(o=>o.setName("p2").setDescription("Player 2").setRequired(true))

].map(c=>c.toJSON())

const rest=new REST({version:"10"}).setToken(process.env.TOKEN)

await rest.put(
Routes.applicationCommands(client.user.id),
{body:commands}
)

console.log("Slash commands loaded")

})

/* ================= MESSAGE COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

message.delete().catch(()=>{})

/* ================= START ================= */

if(cmd==="start"){

if(players.length<2) return message.channel.send("Not enough players")

matches=[]

let shuffled=[...players].sort(()=>Math.random()-0.5)

for(let i=0;i<shuffled.length;i+=2){

matches.push({
p1:shuffled[i],
p2:shuffled[i+1] || "BYE"
})

}

save(tournamentFile,{players,matches,winners,round,maxPlayers})

sendBracket(message.channel)

}

/* ================= QUAL ================= */

if(cmd==="qual"){

let user=message.mentions.users.first()
if(!user) return

winners.push(user.id)

if(winners.length===matches.length){

setTimeout(()=>{
nextRound(message.channel)
},5000)

}

}

/* ================= NEXT ================= */

if(cmd==="next"){
nextRound(message.channel)
}

/* ================= CODE ================= */

if(cmd==="code"){

let code=args[0]
let p1=message.mentions.users.first()
let p2=message.mentions.users.last()

if(!code||!p1||!p2) return

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

message.channel.send({embeds:[embed]})

}

})

/* ================= SLASH COMMANDS ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return

/* START */

if(interaction.commandName==="start"){

if(players.length<2)
return interaction.reply("Not enough players")

matches=[]

let shuffled=[...players].sort(()=>Math.random()-0.5)

for(let i=0;i<shuffled.length;i+=2){

matches.push({
p1:shuffled[i],
p2:shuffled[i+1] || "BYE"
})

}

save(tournamentFile,{players,matches,winners,round,maxPlayers})

sendBracket(interaction.channel)

interaction.reply("Tournament started")

}

/* QUAL */

if(interaction.commandName==="qual"){

let user=interaction.options.getUser("player")

winners.push(user.id)

interaction.reply(`${user.username} qualified`)

if(winners.length===matches.length){

setTimeout(()=>{
nextRound(interaction.channel)
},5000)

}

}

/* NEXT */

if(interaction.commandName==="next"){

nextRound(interaction.channel)

interaction.reply("Next round")

}

/* CODE */

if(interaction.commandName==="code"){

let code=interaction.options.getString("room")
let p1=interaction.options.getUser("p1")
let p2=interaction.options.getUser("p2")

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

interaction.reply({embeds:[embed]})

}

})

/* ================= NEXT ROUND ================= */

async function nextRound(channel){

if(winners.length===1){

let first=await client.users.fetch(winners[0])

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Winner")

.setThumbnail(first.displayAvatarURL())

.setDescription(`🥇 **${first.username}**`)

.setFooter(footer())

channel.send({embeds:[embed]})

players=[]
matches=[]
winners=[]
round=1

save(tournamentFile,{players,matches,winners,round,maxPlayers})

return

}

players=[...winners]
winners=[]
matches=[]
round++

for(let i=0;i<players.length;i+=2){

matches.push({
p1:players[i],
p2:players[i+1] || "BYE"
})

}

save(tournamentFile,{players,matches,winners,round,maxPlayers})

sendBracket(channel)

}

/* ================= BRACKET ================= */

async function sendBracket(channel){

let desc=""

for(let i=0;i<matches.length;i++){

let p1=matches[i].p1==="BYE"?"BYE":(await client.users.fetch(matches[i].p1)).username
let p2=matches[i].p2==="BYE"?"BYE":(await client.users.fetch(matches[i].p2)).username

desc+=`Match ${i+1}
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

client.login(process.env.TOKEN)
