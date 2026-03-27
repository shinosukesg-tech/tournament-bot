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

/* ================= CONFIG ================= */

const STAFF_ROLE="1476446112675004640"
const GUILD_ID="947185082643415140" // ✅ FIXED

const REGISTER_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1427721502698246195/1485228532442337401/IMG-20260315-WA0031.jpg"

/* ================= JSON ================= */

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
msgId:null
})

/* ================= CLIENT ================= */

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers
]
})

/* ================= COMMANDS ================= */

const commands=[

new SlashCommandBuilder()
.setName("tour")
.setDescription("Create tournament")
.addIntegerOption(o=>o.setName("p").setDescription("Players").setRequired(true))
.addStringOption(o=>o.setName("s").setDescription("Server").setRequired(true))
.addStringOption(o=>o.setName("m").setDescription("Map").setRequired(true))
.addStringOption(o=>o.setName("p1").setDescription("First Prize"))
.addStringOption(o=>o.setName("p2").setDescription("Second Prize"))
.addStringOption(o=>o.setName("p3").setDescription("Third Prize")),

new SlashCommandBuilder()
.setName("qual")
.setDescription("Qualify player")
.addUserOption(o=>o.setName("player").setRequired(true)),

new SlashCommandBuilder()
.setName("code")
.setDescription("Send room code")
.addUserOption(o=>o.setName("p1").setRequired(true))
.addUserOption(o=>o.setName("p2").setRequired(true))
.addStringOption(o=>o.setName("code").setRequired(true)),

new SlashCommandBuilder()
.setName("delm").setDescription("Delete tournament")

]

const rest=new REST({version:"10"}).setToken(process.env.TOKEN)

/* ================= READY ================= */

client.once("ready",async ()=>{
console.log(`Logged in as ${client.user.tag}`)

try{
// CLEAR OLD
await rest.put(
Routes.applicationGuildCommands(client.user.id,GUILD_ID),
{body:[]}
)

// REGISTER NEW
await rest.put(
Routes.applicationGuildCommands(client.user.id,GUILD_ID),
{body:commands.map(c=>c.toJSON())}
)

console.log("Commands refreshed ✅")
}catch(e){console.log(e)}
})

/* ================= PANEL ================= */

async function renderPanel(channel){

const embed=new EmbedBuilder()
.setTitle("🏆 Shin Tours 1v1")
.setDescription(`
🌐 ${tournament.server}
🗺 ${tournament.map}

👥 ${tournament.players.length}/${tournament.max}

${tournament.rewards[0]?`🥇 ${tournament.rewards[0]}\n`:""}
${tournament.rewards[1]?`🥈 ${tournament.rewards[1]}\n`:""}
${tournament.rewards[2]?`🥉 ${tournament.rewards[2]}\n`:""}
`)
.setImage(REGISTER_IMG)
.setFooter({text:"Join The Fun | ShinosukeSG",iconURL:FOOTER_IMG})

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Success).setDisabled(tournament.started),
new ButtonBuilder().setCustomId("players").setLabel(`Players: ${tournament.players.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
new ButtonBuilder().setCustomId("start").setLabel("Start").setStyle(ButtonStyle.Danger).setDisabled(tournament.started)
)

let msg=null

if(tournament.msgId){
msg=await channel.messages.fetch(tournament.msgId).catch(()=>null)
}

if(msg){
await msg.edit({embeds:[embed],components:[row]})
}else{
msg=await channel.send({embeds:[embed],components:[row]})
tournament.msgId=msg.id
}

saveJSON("./tournament.json",tournament)
}

/* ================= BRACKET ================= */

async function createBracket(channel){

tournament.started=true
tournament.matches=[]
tournament.qualified=[]

let arr=[...tournament.players].sort(()=>Math.random()-0.5)

for(let i=0;i<arr.length;i+=2){
if(!arr[i+1]) continue
tournament.matches.push({p1:arr[i],p2:arr[i+1]})
}

saveJSON("./tournament.json",tournament)
sendBracket(channel)
}

async function sendBracket(channel){

let msg=await channel.messages.fetch(tournament.msgId).catch(()=>null)
if(!msg) return

let text=""

for(const [i,m] of tournament.matches.entries()){
let p1=await client.users.fetch(m.p1).catch(()=>null)
let p2=await client.users.fetch(m.p2).catch(()=>null)

if(!p1||!p2) continue

text+=`Match ${i+1}\n${p1.username} <:VS:1477014161484677150> ${p2.username}\n\n`
}

await msg.edit({
embeds:[
new EmbedBuilder()
.setTitle(`🏆 Round ${tournament.round}`)
.setDescription(text || "No matches")
.setImage(BRACKET_IMG)
]
})
}

/* ================= INTERACTIONS ================= */

client.on("interactionCreate",async interaction=>{
try{

if(interaction.isButton()){

if(interaction.customId==="register"){

if(!tournament.players.includes(interaction.user.id)){

tournament.players.push(interaction.user.id)
saveJSON("./tournament.json",tournament)

await interaction.reply({content:"<:check:1480513506871742575> Registered",ephemeral:true})

}else{

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("confirm_unreg").setLabel("Unregister").setStyle(ButtonStyle.Danger)
)

return interaction.reply({
content:"Do you want to unregister?",
components:[row],
ephemeral:true
})
}

await renderPanel(interaction.channel)

if(tournament.players.length===tournament.max){
setTimeout(()=>{
if(!tournament.started){
createBracket(interaction.channel)
}
},5000)
}

}

if(interaction.customId==="confirm_unreg"){

tournament.players=tournament.players.filter(p=>p!==interaction.user.id)
saveJSON("./tournament.json",tournament)

await interaction.update({content:"<:sg_cross:1480513567655592037> Unregistered",components:[]})

renderPanel(interaction.channel)
}

if(interaction.customId==="start"){

if(!interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

createBracket(interaction.channel)
await interaction.reply({content:"Started",ephemeral:true})
}

}

/* ================= SLASH ================= */

if(interaction.isChatInputCommand()){

await interaction.deferReply({ephemeral:true}).catch(()=>{})

if(interaction.commandName==="tour"){

tournament={
players:[],
matches:[],
qualified:[],
round:1,
max:interaction.options.getInteger("p"),
server:interaction.options.getString("s"),
map:interaction.options.getString("m"),
rewards:[
interaction.options.getString("p1"),
interaction.options.getString("p2"),
interaction.options.getString("p3")
],
started:false,
msgId:null
}

saveJSON("./tournament.json",tournament)
await renderPanel(interaction.channel)

return interaction.editReply("✅ Panel created")
}

if(interaction.commandName==="qual"){

const user=interaction.options.getUser("player")

if(!tournament.qualified.includes(user.id))
tournament.qualified.push(user.id)

if(tournament.qualified.length===tournament.matches.length){

tournament.players=[...tournament.qualified]
tournament.qualified=[]
tournament.round++

saveJSON("./tournament.json",tournament)

createBracket(interaction.channel)
}

return interaction.editReply(`<:check:1480513506871742575> ${user.username}`)
}

if(interaction.commandName==="code"){

const p1=interaction.options.getUser("p1")
const p2=interaction.options.getUser("p2")
const code=interaction.options.getString("code")

const msg=`
🎮 MATCH ROOM DETAILS

Room Code:
\`\`\`${code}\`\`\`

🌐 ${tournament.server}
🗺 ${tournament.map}
`

p1.send(msg).catch(()=>{})
p2.send(msg).catch(()=>{})

return interaction.editReply("📩 Sent")
}

if(interaction.commandName==="delm"){
tournament={players:[],matches:[],qualified:[],round:1,max:0}
saveJSON("./tournament.json",tournament)

return interaction.editReply("Deleted")
}

}

}catch(err){
console.log(err)
if(!interaction.replied){
interaction.reply({content:"Error",ephemeral:true}).catch(()=>{})
}
}
})

/* ================= AUTO DELETE ================= */

client.on("messageCreate",msg=>{
if(msg.author.bot) return
setTimeout(()=>msg.delete().catch(()=>{}),1000)
})

client.login(process.env.TOKEN)
