require("dotenv").config()

const express=require("express")
const app=express()
app.get("/",(req,res)=>res.send("Bot Running"))
app.listen(process.env.PORT||3000)

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
PermissionsBitField,
ChannelType
}=require("discord.js")

const fs=require("fs")

function loadJSON(file,def){
try{return JSON.parse(fs.readFileSync(file))}
catch{return def}
}
function saveJSON(file,data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}
function autoDelete(msg,t=1000){
setTimeout(()=>msg.delete().catch(()=>{}),t)
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
started:false,
registerMsg:null,
bracketMsg:null
})

const PREFIX="!"
const STAFF_ROLE="1476446112675004640"
const MOD_ROLE="1429913618211672125"

const VS="<:VS:1477014161484677150>"
const CHECK="<:check:1480513506871742575>"

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

client.once("ready",()=>console.log("Bot Ready"))

/* ================= REGISTER PANEL ================= */

async function sendRegister(channel){

const embed=new EmbedBuilder()
.setTitle("🏆 ShinTours Tournament")
.setDescription(`
🌐 Server: ${tournament.server}
🗺 Map: ${tournament.map}

👥 Players: ${tournament.players.length}/${tournament.max}

🥇 ${tournament.rewards[0]}
🥈 ${tournament.rewards[1]}
🥉 ${tournament.rewards[2]}
`)

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("unregister").setLabel("Unregister").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("participants").setLabel("Participants").setStyle(ButtonStyle.Secondary)
)

let msg=await channel.send({embeds:[embed],components:[row]})
tournament.registerMsg=msg.id
saveJSON("./tournament.json",tournament)
}

async function updateRegister(channel){
if(!tournament.registerMsg) return
let msg=await channel.messages.fetch(tournament.registerMsg).catch(()=>null)
if(!msg) return

const embed=new EmbedBuilder()
.setTitle("🏆 ShinTours Tournament")
.setDescription(`
🌐 Server: ${tournament.server}
🗺 Map: ${tournament.map}

👥 Players: ${tournament.players.length}/${tournament.max}

🥇 ${tournament.rewards[0]}
🥈 ${tournament.rewards[1]}
🥉 ${tournament.rewards[2]}
`)

msg.edit({embeds:[embed]})
}

/* ================= BRACKET ================= */

async function createBracket(channel){

tournament.started=true

let shuffled=[...tournament.players].sort(()=>Math.random()-0.5)

tournament.matches=[]
tournament.qualified=[]

for(let i=0;i<shuffled.length;i+=2){
if(!shuffled[i+1]) break
tournament.matches.push({p1:shuffled[i],p2:shuffled[i+1],winner:null})
}

saveJSON("./tournament.json",tournament)
sendBracket(channel)
}

async function sendBracket(channel){

let text=""

for(const [i,m] of tournament.matches.entries()){
let p1=await client.users.fetch(m.p1)
let p2=await client.users.fetch(m.p2)

text+=`${m.winner?CHECK:""} Match ${i+1}\n${p1.username} ${VS} ${p2.username}\n\n`
}

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("next_round").setLabel("Next Round").setStyle(ButtonStyle.Primary)
)

let msg=await channel.send({
embeds:[new EmbedBuilder().setTitle(`Round ${tournament.round}`).setDescription(text)],
components:[row]
})

tournament.bracketMsg=msg.id
saveJSON("./tournament.json",tournament)
}

/* ================= INTERACTIONS ================= */

client.on("interactionCreate",async interaction=>{
if(!interaction.isButton()) return

/* REGISTER */

if(interaction.customId==="register"){
if(tournament.started)
return interaction.reply({content:"Registration closed",ephemeral:true})

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already joined",ephemeral:true})

tournament.players.push(interaction.user.id)
saveJSON("./tournament.json",tournament)

updateRegister(interaction.channel)

interaction.reply({content:"Registered",ephemeral:true})

if(tournament.players.length===tournament.max){
createBracket(interaction.channel)
}
}

/* UNREGISTER */

if(interaction.customId==="unregister"){
if(tournament.started)
return interaction.reply({content:"Registration closed",ephemeral:true})

tournament.players=tournament.players.filter(p=>p!==interaction.user.id)
saveJSON("./tournament.json",tournament)

updateRegister(interaction.channel)

interaction.reply({content:"Unregistered",ephemeral:true})
}

/* PARTICIPANTS */

if(interaction.customId==="participants"){

let list=""

for(let id of tournament.players){
let u=await client.users.fetch(id)
list+=`${u.username}\n`
}

interaction.reply({content:list||"No players",ephemeral:true})
}

/* NEXT ROUND */

if(interaction.customId==="next_round"){

if(!interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

if(tournament.qualified.length<2)
return interaction.reply({content:"No qualified players",ephemeral:true})

let next=[...tournament.qualified]
tournament.players=next
tournament.qualified=[]
tournament.round++

saveJSON("./tournament.json",tournament)

createBracket(interaction.channel)

interaction.reply({content:"Next round started",ephemeral:true})
}

})

/* ================= COMMANDS ================= */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

msg.delete().catch(()=>{})

const args=msg.content.slice(1).split(" ")
const cmd=args.shift().toLowerCase()

/* TOUR */

if(cmd==="tour"){
if(!msg.member.roles.cache.has(STAFF_ROLE)) return

tournament={
players:[],
matches:[],
qualified:[],
round:1,
max:parseInt(args[0]),
server:args[1],
map:args[2],
rewards:[args[3],args[4],args[5]],
started:false
}

saveJSON("./tournament.json",tournament)
sendRegister(msg.channel)
}

/* QUAL */

if(cmd==="qual"){
if(!msg.member.roles.cache.has(STAFF_ROLE)) return

let user=msg.mentions.users.first()
if(!user) return

if(!tournament.qualified.includes(user.id))
tournament.qualified.push(user.id)

for(let m of tournament.matches
