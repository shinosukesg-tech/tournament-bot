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
ChannelType
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
messageId:null,
bracketMessageId:null
})

let welcome=loadJSON("./welcome.json",{channel:null})

let commands=loadJSON("./commands.json",{prefix:"!"})

let ticket=loadJSON("./ticket.json",{
category:"1480854630035357776",
moderatorRole:"Moderator"
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

const PREFIX=commands.prefix||"!"

/* ========= STAFF ROLE ========= */

const STAFF_ROLE="Tournament Staff"

/* ========= EMOJIS ========= */

const VS="<:VS:1477014161484677150>"
const CHECK="<:check:1480513506871742575>"

/* ========= IMAGES ========= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480914400314392627/Screenshot_20260310_183459_Discord.jpg"

/* ========= TIME ========= */

function ist(){
return new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})
}

/* ========= FOOTER ========= */

function footer(embed,guild){
embed.setFooter({
text:`Enjoy The Fun | ShinosukeSG\n${ist()}`,
iconURL:FOOTER_IMG
})
}

/* ========= PROGRESS BAR ========= */

function progressBar(){

let done=tournament.qualified.length
let total=tournament.matches.length||1

let size=10
let filled=Math.round((done/total)*size)

return "█".repeat(filled)+"░".repeat(size-filled)+` ${done}/${total}`

}

/* ========= READY ========= */

client.once("ready",()=>{
console.log(`Logged as ${client.user.tag}`)
})

/* ========= REGISTER PANEL ========= */

async function sendRegister(channel){

const embed=new EmbedBuilder()

.setTitle("🏆 ShinTours Tournament Registration")
.setImage(REGISTER_IMG)

.setDescription(`
🎮 **Server:** ${tournament.server}
🗺 **Map:** ${tournament.map}

👥 **Players:** ${tournament.players.length}/${tournament.max}

🏅 **Rewards**

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

.setTitle("🏆 ShinTours Tournament Registration")
.setImage(REGISTER_IMG)

.setDescription(`
🎮 **Server:** ${tournament.server}
🗺 **Map:** ${tournament.map}

👥 **Players:** ${tournament.players.length}/${tournament.max}

🏅 **Rewards**

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

/* NEXT ROUND BUTTON */

if(i.customId==="nextRound"){

if(!i.member.roles.cache.find(r=>r.name===STAFF_ROLE))
return i.reply({content:"❌ Admin Only",ephemeral:true})

if(tournament.qualified.length!==tournament.matches.length)
return i.reply({content:"Round not finished yet",ephemeral:true})

tournament.players=[...tournament.qualified]
tournament.qualified=[]
tournament.round++

saveJSON("./tournament.json",tournament)

createBracket(i.channel)

i.reply({content:"Next round started",ephemeral:true})

}

})

/* ========= COMMANDS ========= */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).split(" ")
const cmd=args.shift().toLowerCase()

msg.delete().catch(()=>{})

/* HELP */

if(cmd==="helpm"){

const embed=new EmbedBuilder()

.setTitle("🏆 ShinTours Tournament Bot")

.setDescription(`
🎮 **Tournament Commands**

⚔ **Create Tournament**
\`!tour players server map r1 r2 r3\`

🏆 **Qualify Player**
\`!qual @player\`

🎮 **Send Room Code**
\`!code CODE @player\`

🎉 **Set Welcome Channel**
\`!welcome #channel\`

━━━━━━━━━━━━━━━━

🔥 **Fully Automatic Brackets**
📊 **Live Progress Bar**
🏆 **Auto Round System**

`)

.setImage(BRACKET_IMG)

footer(embed,msg.guild)

msg.channel.send({embeds:[embed]})

}

/* TOUR */

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

/* QUAL */

if(cmd==="qual"){

let user=msg.mentions.users.first()
if(!user) return

tournament.qualified.push(user.id)

saveJSON("./tournament.json",tournament)

updateBracket(msg.channel)

}

/* CODE */

if(cmd==="code"){

let code=args[0]
let p1=msg.mentions.users.first()

if(!p1) return

let match=tournament.matches.find(m=>m.p1==p1.id||m.p2==p1.id)

let p2id=match.p1==p1.id?match.p2:match.p1
let p2=await client.users.fetch(p2id)

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

async function sendBracket(channel){

let text=""

for(const [i,m] of tournament.matches.entries()){

let p1=(await client.users.fetch(m.p1)).username
let p2=(await client.users.fetch(m.p2)).username

let win=tournament.qualified.includes(m.p1)||tournament.qualified.includes(m.p2)

text+=`Match ${i+1} ${win?CHECK:""}
${p1} ${VS} ${p2}

`

}

text+=`\n📊 Progress\n${progressBar()}`

const embed=new EmbedBuilder()

.setTitle(`Round ${tournament.round}`)
.setImage(BRACKET_IMG)
.setDescription(text)

footer(embed,channel.guild)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("nextRound")
.setLabel("Next Round")
.setStyle(ButtonStyle.Primary)

)

let msg=await channel.send({embeds:[embed],components:[row]})

tournament.bracketMessageId=msg.id
saveJSON("./tournament.json",tournament)

}

async function updateBracket(channel){

if(!tournament.bracketMessageId) return

let msg=await channel.messages.fetch(tournament.bracketMessageId).catch(()=>null)
if(!msg) return

let text=""

for(const [i,m] of tournament.matches.entries()){

let p1=(await client.users.fetch(m.p1)).username
let p2=(await client.users.fetch(m.p2)).username

let win=tournament.qualified.includes(m.p1)||tournament.qualified.includes(m.p2)

text+=`Match ${i+1} ${win?CHECK:""}
${p1} ${VS} ${p2}

`

}

text+=`\n📊 Progress\n${progressBar()}`

const embed=new EmbedBuilder()

.setTitle(`Round ${tournament.round}`)
.setImage(BRACKET_IMG)
.setDescription(text)

footer(embed,channel.guild)

msg.edit({embeds:[embed]})

}

/* ========= LOGIN ========= */

client.login(process.env.TOKEN)
