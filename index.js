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

.setTitle("🏆 Tournament Registration")
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

.setTitle("🏆 Tournament Registration")
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

/* ========= WELCOME ========= */

client.on("guildMemberAdd",async member=>{

if(!welcome.channel) return

let ch=member.guild.channels.cache.get(welcome.channel)
if(!ch) return

const embed=new EmbedBuilder()

.setTitle(`Welcome ${member.user.username}! 👋`)
.setThumbnail(member.user.displayAvatarURL())

.setDescription(`
Welcome **${member.user.username}**
to 🏆 **${member.guild.name}**

Have an awesome time with us!
`)

.addFields(
{name:"🆔 User ID",value:member.user.id},
{name:"📅 Account Created",value:`${member.user.createdAt.toDateString()}`},
{name:"🎭 Display Name",value:member.displayName}
)

footer(embed,member.guild)

ch.send({embeds:[embed]})

})

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

/* TICKETS */

if(["support","apply","reward"].includes(i.customId)){

let name=i.customId+"-"+i.user.username

let channel=await i.guild.channels.create({
name:name,
type:ChannelType.GuildText,
parent:ticket.category,
permissionOverwrites:[
{
id:i.guild.id,
deny:["ViewChannel"]
},
{
id:i.user.id,
allow:["ViewChannel","SendMessages"]
},
{
id:i.guild.roles.cache.find(r=>r.name===ticket.moderatorRole)?.id,
allow:["ViewChannel","SendMessages"]
}
]
})

i.reply({content:`Ticket created: ${channel}`,ephemeral:true})

}

})

/* ========= COMMANDS ========= */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).split(" ")
const cmd=args.shift().toLowerCase()

/* SET WELCOME */

if(cmd==="welcome"){

let ch=msg.mentions.channels.first()
if(!ch) return msg.reply("Mention channel")

welcome.channel=ch.id
saveJSON("./welcome.json",welcome)

msg.reply("Welcome channel set")

}

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

msg.reply("Tournament created")

}

/* HELP */

if(cmd==="helpm"){

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Bot Help")

.setDescription(`
!tour players server map r1 r2 r3
!qual @player
!code CODE @player
!welcome #channel
`)

footer(embed,msg.guild)

msg.channel.send({embeds:[embed]})

}

/* QUAL */

if(cmd==="qual"){

let user=msg.mentions.users.first()
if(!user) return

if(!tournament.players.includes(user.id))
return msg.reply("Player not in tournament")

if(tournament.qualified.includes(user.id))
return msg.reply("Already qualified")

tournament.qualified.push(user.id)

saveJSON("./tournament.json",tournament)

updateBracket(msg.channel)

msg.reply("Player qualified")

}

/* CODE */

if(cmd==="code"){

let code=args[0]
let p1=msg.mentions.users.first()

if(!code||!p1) return msg.reply("Usage: !code CODE @player")

let match=tournament.matches.find(m=>m.p1==p1.id||m.p2==p1.id)

if(!match) return msg.reply("Match not found")

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

msg.reply("Room code sent to players")

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

let msg=await channel.send({embeds:[embed]})

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
