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
SlashCommandBuilder,
Routes
}=require("discord.js")

const {REST}=require("@discordjs/rest")
const fs=require("fs")

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
started:false,
registerMsg:null
})

const STAFF_ROLE="1476446112675004640"

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers
]
})

/* ================= SLASH COMMAND REGISTER ================= */

const commands=[
new SlashCommandBuilder()
.setName("tour")
.setDescription("Create tournament")
.addIntegerOption(o=>o.setName("max").setRequired(true))
.addStringOption(o=>o.setName("server").setRequired(true))
.addStringOption(o=>o.setName("map").setRequired(true))
.addStringOption(o=>o.setName("first").setRequired(true))
.addStringOption(o=>o.setName("second").setRequired(true))
.addStringOption(o=>o.setName("third").setRequired(true)),

new SlashCommandBuilder()
.setName("qual")
.setDescription("Qualify player")
.addUserOption(o=>o.setName("player").setRequired(true)),

new SlashCommandBuilder()
.setName("code")
.setDescription("Send room code")
.addStringOption(o=>o.setName("code").setRequired(true))
.addUserOption(o=>o.setName("player").setRequired(true)),

new SlashCommandBuilder()
.setName("delm")
.setDescription("Delete tournament"),

new SlashCommandBuilder()
.setName("helpm")
.setDescription("Help menu")
]

const rest=new REST({version:"10"}).setToken(process.env.TOKEN)

client.once("ready",async ()=>{
console.log("Bot Ready")

await rest.put(
Routes.applicationCommands(client.user.id),
{body:commands}
)
})

/* ================= REGISTER PANEL ================= */

async function sendRegister(channel){

const embed=new EmbedBuilder()
.setTitle("🏆 ShinTours Tournament")
.setDescription(`
🌐 ${tournament.server}
🗺 ${tournament.map}

👥 ${tournament.players.length}/${tournament.max}

🥇 ${tournament.rewards[0]}
🥈 ${tournament.rewards[1]}
🥉 ${tournament.rewards[2]}
`)

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("unregister").setLabel("Unregister").setStyle(ButtonStyle.Danger)
)

let msg=await channel.send({embeds:[embed],components:[row]})
tournament.registerMsg=msg.id
saveJSON("./tournament.json",tournament)
}

/* ================= BRACKET ================= */

async function createBracket(channel){

tournament.started=true
tournament.matches=[]
tournament.qualified=[]

let arr=[...tournament.players].sort(()=>Math.random()-0.5)

for(let i=0;i<arr.length;i+=2){
if(!arr[i+1]) break
tournament.matches.push({p1:arr[i],p2:arr[i+1],winner:null})
}

saveJSON("./tournament.json",tournament)

let text=""

for(const [i,m] of tournament.matches.entries()){
let p1=await client.users.fetch(m.p1)
let p2=await client.users.fetch(m.p2)

text+=`Match ${i+1}\n${p1.username} vs ${p2.username}\n\n`
}

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("next").setLabel("Next Round").setStyle(ButtonStyle.Primary)
)

await channel.send({
embeds:[new EmbedBuilder().setTitle(`Round ${tournament.round}`).setDescription(text)],
components:[row]
})
}

/* ================= INTERACTIONS ================= */

client.on("interactionCreate",async interaction=>{

/* BUTTONS */

if(interaction.isButton()){

if(interaction.customId==="register"){
if(tournament.started)
return interaction.reply({content:"Closed",ephemeral:true})

if(!tournament.players.includes(interaction.user.id)){
tournament.players.push(interaction.user.id)
saveJSON("./tournament.json",tournament)
}

interaction.reply({content:"Joined",ephemeral:true})

if(tournament.players.length===tournament.max){
createBracket(interaction.channel)
}
}

if(interaction.customId==="unregister"){
tournament.players=tournament.players.filter(p=>p!==interaction.user.id)
saveJSON("./tournament.json",tournament)
interaction.reply({content:"Removed",ephemeral:true})
}

if(interaction.customId==="next"){
if(!interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

if(tournament.qualified.length<2)
return interaction.reply({content:"Not enough qualified",ephemeral:true})

tournament.players=[...tournament.qualified]
tournament.qualified=[]
tournament.round++

saveJSON("./tournament.json",tournament)
createBracket(interaction.channel)

interaction.reply({content:"Next round",ephemeral:true})
}
}

/* SLASH COMMANDS */

if(interaction.isChatInputCommand()){

/* TOUR */

if(interaction.commandName==="tour"){
if(!interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

tournament={
players:[],
matches:[],
qualified:[],
round:1,
max:interaction.options.getInteger("max"),
server:interaction.options.getString("server"),
map:interaction.options.getString("map"),
rewards:[
interaction.options.getString("first"),
interaction.options.getString("second"),
interaction.options.getString("third")
],
started:false
}

saveJSON("./tournament.json",tournament)
sendRegister(interaction.channel)

interaction.reply({content:"Tournament created",ephemeral:true})
}

/* QUAL */

if(interaction.commandName==="qual"){
if(!interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

let user=interaction.options.getUser("player")

if(!tournament.qualified.includes(user.id))
tournament.qualified.push(user.id)

for(let m of tournament.matches){
if(m.p1===user.id||m.p2===user.id){
m.winner=user.id
}
}

saveJSON("./tournament.json",tournament)

interaction.reply({content:`Qualified ${user.username}`,ephemeral:true})
}

/* CODE */

if(interaction.commandName==="code"){
if(!interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

let code=interaction.options.getString("code")
let user=interaction.options.getUser("player")

let match=tournament.matches.find(m=>m.p1===user.id||m.p2===user.id)
if(!match)
return interaction.reply({content:"Match not found",ephemeral:true})

let p1=await client.users.fetch(match.p1)
let p2=await client.users.fetch(match.p2)

p1.send(`Room Code: ${code}`).catch(()=>{})
p2.send(`Room Code: ${code}`).catch(()=>{})

interaction.reply({content:"Code sent",ephemeral:true})
}

/* DELM */

if(interaction.commandName==="delm"){
if(!interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

tournament={
players:[],
matches:[],
qualified:[],
round:1,
max:0,
server:"",
map:"",
rewards:[],
started:false
}

saveJSON("./tournament.json",tournament)

interaction.reply({content:"Tournament deleted",ephemeral:true})
}

/* HELP */

if(interaction.commandName==="helpm"){
interaction.reply({
content:`
🏆 Commands:
/tour - create tournament
/qual - qualify player
/code - send room code
/delm - delete tournament
`,
ephemeral:true
})
}

}

})

client.login(process.env.TOKEN)
