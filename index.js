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
REST,
Routes
}=require("discord.js")

const fs=require("fs")

/* ========= FILES ========= */

function loadJSON(file,def){
try{return JSON.parse(fs.readFileSync(file))}
catch{return def}
}

function saveJSON(file,data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

let tournament=loadJSON("./tournament.json",{
players:[],
matches:[],
qualified:[],
round:1,
max:0,
server:"",
map:"",
rewards:[],
messageId:null
})

/* ========= CLIENT ========= */

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

const PREFIX="!"

/* ========= EMOJIS ========= */

const VS="<:VS:1477014161484677150>"
const CHECK="<:check:1480513506871742575>"

/* ========= IMAGES ========= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480914400314392627/Screenshot_20260310_183459_Discord.jpg"

/* ========= FOOTER ========= */

function footer(embed,guild){
embed.setFooter({
text:`Enjoy The Fun | ${guild.name}`,
iconURL:FOOTER_IMG
})
}

/* ========= READY ========= */

client.once("ready",async()=>{

console.log(`Logged as ${client.user.tag}`)

try{

const rest=new REST({version:"10"}).setToken(process.env.TOKEN)

await rest.put(
Routes.applicationCommands(client.user.id),
{body:[]}
)

console.log("Slash commands synced")

}catch(e){console.log(e)}

})

/* ========= REGISTER PANEL ========= */

async function sendRegister(channel){

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")
.setImage(REGISTER_IMG)

.setDescription(`
Server: **${tournament.server}**
Map: **${tournament.map}**

👥 Players **${tournament.players.length}/${tournament.max}**

🏅 Rewards
🥇 ${tournament.rewards[0]}
🥈 ${tournament.rewards[1]}
🥉 ${tournament.rewards[2]}
`)

footer(embed,channel.guild)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("participants")
.setLabel("Participants")
.setStyle(ButtonStyle.Secondary)

)

let msg=await channel.send({embeds:[embed],components:[row]})

tournament.messageId=msg.id
saveJSON("./tournament.json",tournament)

}

/* ========= UPDATE PANEL ========= */

async function updatePanel(channel){

if(!tournament.messageId) return

let msg=await channel.messages.fetch(tournament.messageId).catch(()=>null)
if(!msg) return

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")
.setImage(REGISTER_IMG)

.setDescription(`
Server: **${tournament.server}**
Map: **${tournament.map}**

👥 Players **${tournament.players.length}/${tournament.max}**

🏅 Rewards
🥇 ${tournament.rewards[0]}
🥈 ${tournament.rewards[1]}
🥉 ${tournament.rewards[2]}
`)

footer(embed,channel.guild)

msg.edit({embeds:[embed]})

}

/* ========= BUTTONS ========= */

client.on("interactionCreate",async i=>{

if(!i.isButton()) return

/* REGISTER */

if(i.customId==="register"){

if(tournament.players.includes(i.user.id))
return i.reply({content:"Already registered",ephemeral:true})

tournament.players.push(i.user.id)

saveJSON("./tournament.json",tournament)

await updatePanel(i.channel)

i.reply({content:`${CHECK} Registered`,ephemeral:true})

if(tournament.players.length==tournament.max){

createBracket(i.channel)

}

}

/* UNREGISTER */

if(i.customId==="unregister"){

tournament.players=tournament.players.filter(x=>x!==i.user.id)

saveJSON("./tournament.json",tournament)

updatePanel(i.channel)

i.reply({content:"Unregistered",ephemeral:true})

}

/* PARTICIPANTS */

if(i.customId==="participants"){

let names=await Promise.all(
tournament.players.map(async id=>{
let u=await client.users.fetch(id)
return u.username
})
)

i.reply({
content:`👥 Participants\n\n${names.join("\n")||"None"}`,
ephemeral:true
})

}

})

/* ========= PREFIX COMMANDS ========= */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).split(" ")
const cmd=args.shift().toLowerCase()

/* CREATE TOUR */

if(cmd==="tour"){

tournament.max=parseInt(args[0])
tournament.server=args[1]
tournament.map=args[2]
tournament.rewards=[args[3],args[4],args[5]]

tournament.players=[]
tournament.matches=[]
tournament.qualified=[]
tournament.round=1

saveJSON("./tournament.json",tournament)

sendRegister(msg.channel)

}

/* HELP */

if(cmd==="helpm"){

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Bot Commands")

.setDescription(`
🎮 **Tournament**
\`!tour players server map r1 r2 r3\`

🏁 **Qualify**
\`!qual @player\`

🏠 **Room Code**
\`!code CODE @p1 @p2\`

📊 **Bracket auto generated when full**
`)

.setImage(BRACKET_IMG)

footer(embed,msg.guild)

msg.channel.send({embeds:[embed]})

}

/* QUAL */

if(cmd==="qual"){

let user=msg.mentions.users.first()
if(!user) return

tournament.qualified.push(user.id)

saveJSON("./tournament.json",tournament)

msg.channel.send(`${CHECK} **${user.username}** qualified`)

checkRound(msg.channel)

}

/* CODE */

if(cmd==="code"){

let code=args[0]
let p1=msg.mentions.users.first()
let p2=msg.mentions.users.last()

const embed=new EmbedBuilder()

.setTitle("🎮 Match Room")

.setDescription(`
${p1.username} ${VS} ${p2.username}

Room Code
\`\`\`
${code}
\`\`\`
`)

footer(embed,msg.guild)

msg.channel.send({embeds:[embed]})

p1.send({embeds:[embed]}).catch(()=>{})
p2.send({embeds:[embed]}).catch(()=>{})

}

})

/* ========= BRACKET ========= */

function createBracket(channel){

let arr=[...tournament.players].sort(()=>Math.random()-0.5)

tournament.matches=[]

for(let i=0;i<arr.length;i+=2){

tournament.matches.push({
p1:arr[i],
p2:arr[i+1]
})

}

saveJSON("./tournament.json",tournament)

sendBracket(channel)

}

function sendBracket(channel){

let text=""

tournament.matches.forEach((m,i)=>{

text+=`Match ${i+1}
<@${m.p1}> ${VS} <@${m.p2}>

`

})

const embed=new EmbedBuilder()

.setTitle(`Round ${tournament.round}`)
.setImage(BRACKET_IMG)
.setDescription(text)

footer(embed,channel.guild)

channel.send({embeds:[embed]})

}

/* ========= ROUND CHECK ========= */

function checkRound(channel){

if(tournament.qualified.length===tournament.matches.length){

if(tournament.qualified.length===1){

announceWinner(channel)

return
}

tournament.players=[...tournament.qualified]
tournament.qualified=[]
tournament.round++

createBracket(channel)

}

}

/* ========= WINNER ========= */

async function announceWinner(channel){

let first=await client.users.fetch(tournament.players[0])
let second=await client.users.fetch(tournament.players[1]||tournament.players[0])
let third=await client.users.fetch(tournament.players[2]||tournament.players[0])

const embed=new EmbedBuilder()

.setTitle(`🏆 ${first.username} WINS`)
.setThumbnail(first.displayAvatarURL())

.setDescription(`
🥇 **${first.username}**
${tournament.rewards[0]}

🥈 ${second.username}
${tournament.rewards[1]}

🥉 ${third.username}
${tournament.rewards[2]}
`)

footer(embed,channel.guild)

channel.send({embeds:[embed]})

}

/* ========= LOGIN ========= */

client.login(process.env.TOKEN)
