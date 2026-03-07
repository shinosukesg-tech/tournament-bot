require("dotenv").config()

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
ButtonStyle
} = require("discord.js")

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

const PREFIX = ";"

/* ================= CUSTOM EMOJIS ================= */

const VS = "<:VS:1477014161484677150>"
const TICK = "<:TICK:1467892699578236998>"

/* ================= IMAGES ================= */

const REGISTER_IMAGES = [
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
]

const BRACKET_IMAGES = [
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

const WINNER_IMAGES = [
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

function random(arr){
return arr[Math.floor(Math.random()*arr.length)]
}

/* ================= DATA ================= */

let players = []
let bracket = []
let winners = []
let matchIndex = 0
let matchesFinished = false

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).split(/ +/)
const cmd = args.shift().toLowerCase()

/* ================= REGISTER PANEL ================= */

if(cmd === "1v1"){

players=[]
bracket=[]
winners=[]
matchIndex=0
matchesFinished=false

const embed = new EmbedBuilder()
.setTitle("🏆 Tournament")
.setDescription(`🎮 Mode: 1v1
🌍 Server: 44
🗺 Map: rid
👥 Players: **0/16**
Status: **OPEN**`)
.setImage(random(REGISTER_IMAGES))
.setColor("Red")

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)
)

message.channel.send({embeds:[embed],components:[row]})
}

/* ================= BYE ================= */

if(cmd === "bye"){

if(!players.includes(message.author.id))
return message.reply("You are not registered.")

players = players.filter(p=>p!==message.author.id)

message.reply("You left the tournament.")
}

/* ================= START ================= */

if(cmd === "start"){

if(players.length <2)
return message.reply("Need at least 2 players")

players.sort(()=>Math.random()-0.5)

bracket=[]

for(let i=0;i<players.length;i+=2){
bracket.push([players[i],players[i+1]])
}

let text=""

for(const match of bracket){

const p1 = await client.users.fetch(match[0])
const p2 = await client.users.fetch(match[1])

text += `${p1.username} ${VS} ${p2.username}\n`
}

const embed = new EmbedBuilder()
.setTitle("🏆 Tournament Bracket")
.setDescription(text)
.setImage(random(BRACKET_IMAGES))
.setColor("Purple")

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("qualify")
.setLabel("Qualify")
.setStyle(ButtonStyle.Primary)
.setDisabled(true)
)

message.channel.send({embeds:[embed],components:[row]})
}

/* ================= QUALIFY COMMAND ================= */

if(cmd === "qual"){

const user = message.mentions.users.first()
if(!user) return message.reply("Mention player")

winners.push(user.id)

message.reply(`${TICK} ${user.username} qualified`)
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

const embed = new EmbedBuilder()
.setTitle("🏆 Tournament")
.setDescription(`🎮 Mode: 1v1
🌍 Server: 44
🗺 Map: rid
👥 Players: **${players.length}/16**
Status: **OPEN**`)
.setImage(random(REGISTER_IMAGES))
.setColor("Red")

interaction.update({embeds:[embed]})
}

/* ================= UNREGISTER ================= */

if(interaction.customId==="unregister"){

if(!players.includes(interaction.user.id))
return interaction.reply({content:"Not registered",ephemeral:true})

players = players.filter(p=>p!==interaction.user.id)

const embed = new EmbedBuilder()
.setTitle("🏆 Tournament")
.setDescription(`🎮 Mode: 1v1
🌍 Server: 44
🗺 Map: rid
👥 Players: **${players.length}/16**
Status: **OPEN**`)
.setImage(random(REGISTER_IMAGES))
.setColor("Red")

interaction.update({embeds:[embed]})
}

/* ================= QUALIFY BUTTON ================= */

if(interaction.customId==="qualify"){

if(!matchesFinished)
return interaction.reply({content:"Matches not finished yet",ephemeral:true})

players = winners
winners=[]
matchIndex=0

interaction.reply("Next round created")
}

})

client.login(process.env.TOKEN)
