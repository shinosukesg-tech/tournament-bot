require("dotenv").config()

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
ButtonStyle
} = require("discord.js")

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]})

const PREFIX=";"
const SERVER_NAME="ShinosukeSG"

/* ================= CUSTOM EMOJIS ================= */

const VS = "<:VS:1477014161484677150>"
const TICK = "<:TICK:1467892699578236998>"

/* ================= TOURNAMENT IMAGES ================= */

const TOUR_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"
]

function randomImage(){
return TOUR_IMAGES[Math.floor(Math.random()*TOUR_IMAGES.length)]
}

/* ================= TOURNAMENT DATA ================= */

let tournament=null

/* ================= AUTO WELCOME ================= */

function accountAge(date){
return Math.floor((Date.now()-date.getTime())/86400000)+" days"
}

client.on("guildMemberAdd",async member=>{

const channel=member.guild.channels.cache.find(c=>c.name.includes("welcome"))
if(!channel) return

const embed=new EmbedBuilder()

.setColor("#8b5cf6")
.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setDescription(`Welcome **${member.user.username}** to 🏆 **${SERVER_NAME}**\nHave fun here!`)
.addFields(
{name:"🆔 User ID",value:member.id},
{name:"📅 Account Created",value:member.user.createdAt.toDateString()},
{name:"⏳ Account Age",value:accountAge(member.user.createdAt)},
{name:"🎭 Display Name",value:member.displayName}
)

channel.send({
content:`Welcome <@${member.id}>`,
embeds:[embed]
})

})

/* ================= COMMAND HANDLER ================= */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).split(" ")
const cmd=args.shift().toLowerCase()

/* ===== CREATE TOURNAMENT ===== */

if(cmd==="1v1"){

let size=parseInt(args[0])
let server=args[1]
let map=args[2]

let img=randomImage()

tournament={
size,
server,
map,
players:[],
matches:[],
image:img,
round:1
}

const embed=new EmbedBuilder()

.setColor("Red")
.setTitle(`🏆 ${SERVER_NAME} Tournament`)
.setImage(img)
.setDescription(`
🎮 Mode: 1v1
🌍 Server: ${server}
🗺 Map: ${map}

👥 Players: 0/${size}
`)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel("Players 0/"+size)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)

)

msg.channel.send({embeds:[embed],components:[row]})

}

/* ===== START TOURNAMENT ===== */

if(cmd==="start"){

if(!tournament) return msg.reply("No tournament running")

let shuffled=[...tournament.players].sort(()=>Math.random()-0.5)

tournament.matches=[]

for(let i=0;i<shuffled.length;i+=2){

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1]||null,
winner:null
})

}

sendBracket(msg.channel)

}

/* ===== QUALIFY PLAYER ===== */

if(cmd==="qual"){

if(!tournament) return

if(args[0]==="bye1"){

let match=tournament.matches.find(m=>!m.p2)

if(match){

match.winner=match.p1
msg.channel.send(`${TICK} BYE player advanced`)

}

return
}

let user=msg.mentions.users.first()
if(!user) return

let match=tournament.matches.find(m=>m.p1===user.id||m.p2===user.id)

if(match){

match.winner=user.id
msg.channel.send(`${TICK} ${user.username} qualified`)

}

}

/* ===== BYE ADVANCE ===== */

if(cmd==="bye"){

if(!tournament) return

tournament.matches.forEach(m=>{
if(!m.p2) m.winner=m.p1
})

msg.channel.send(`${TICK} BYE players advanced`)

}

/* ===== ROOM CODE ===== */

if(cmd==="code"){

let room=args[0]
let user=msg.mentions.users.first()

if(!room||!user) return msg.reply("Usage: ;code ROOMCODE @player")

const embed=new EmbedBuilder()

.setColor("Green")
.setTitle("Match Room")
.setDescription(`ROOM CODE\n\`\`\`\n${room}\n\`\`\``)

user.send({embeds:[embed]}).catch(()=>{})

msg.channel.send(`${TICK} Room code sent`)

}

})

/* ================= BRACKET FUNCTION ================= */

function sendBracket(channel){

let text=""

tournament.matches.forEach((m,i)=>{

text+=`**Match ${i+1}**\n<@${m.p1}> ${VS} ${m.p2?`<@${m.p2}>`:"BYE"}\n\n`

})

const embed=new EmbedBuilder()

.setColor("Blue")
.setTitle(`Round ${tournament.round}`)
.setDescription(text)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("next")
.setLabel("Next Round")
.setStyle(ButtonStyle.Primary)

)

channel.send({embeds:[embed],components:[row]})

}

/* ================= BUTTONS ================= */

client.on("interactionCreate",async i=>{

if(!i.isButton()) return

/* ===== REGISTER ===== */

if(i.customId==="register"){

if(!tournament)
return i.reply({content:"No tournament running",ephemeral:true})

if(tournament.players.includes(i.user.id))
return i.reply({content:"Already registered",ephemeral:true})

tournament.players.push(i.user.id)

const embed=new EmbedBuilder()

.setColor("Red")
.setTitle(`🏆 ${SERVER_NAME} Tournament`)
.setImage(tournament.image)
.setDescription(`
🎮 Mode: 1v1
🌍 Server: ${tournament.server}
🗺 Map: ${tournament.map}

👥 Players: ${tournament.players.length}/${tournament.size}
`)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`Players ${tournament.players.length}/${tournament.size}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)

)

i.update({embeds:[embed],components:[row]})

}

/* ===== NEXT ROUND ===== */

if(i.customId==="next"){

let unfinished=tournament.matches.find(m=>!m.winner)

if(unfinished)
return i.reply({content:"Finish all matches first",ephemeral:true})

let winners=tournament.matches.map(m=>m.winner)

if(winners.length===1){

const embed=new EmbedBuilder()

.setColor("Gold")
.setTitle("🏆 Tournament Winner")
.setDescription(`${TICK} Winner: <@${winners[0]}>`)

return i.channel.send({embeds:[embed]})

}

tournament.round++

tournament.matches=[]

for(let x=0;x<winners.length;x+=2){

tournament.matches.push({
p1:winners[x],
p2:winners[x+1]||null,
winner:null
})

}

sendBracket(i.channel)

i.reply({content:"Next round created",ephemeral:true})

}

})

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

client.login(process.env.TOKEN)
