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
Routes,
PermissionsBitField
}=require("discord.js")

const {REST}=require("@discordjs/rest")
const fs=require("fs")

/* ================= CONFIG ================= */

const STAFF_ROLE="1476446112675004640"
const GUILD_ID="1427721501737619669"
const WELCOME_CHANNEL="1465234114318696498"
const TICKET_CATEGORY="1480854630035357776"

/* ================= DATA ================= */

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
.setName("ticket")
.setDescription("Send ticket panel"),

new SlashCommandBuilder()
.setName("helpm")
.setDescription("Help menu")

]

const rest=new REST({version:"10"}).setToken(process.env.TOKEN)

/* ================= READY ================= */

client.once("ready",async ()=>{
console.log(`Logged in as ${client.user.tag}`)

await rest.put(
Routes.applicationGuildCommands(client.user.id,GUILD_ID),
{body:commands.map(c=>c.toJSON())}
)

console.log("Slash commands ready ✅")
})

/* ================= WELCOME ================= */

client.on("guildMemberAdd",member=>{
const ch=member.guild.channels.cache.get(WELCOME_CHANNEL)
if(!ch) return

const embed=new EmbedBuilder()
.setDescription(`Welcome **${member.user.username}** 🎉`)
.setThumbnail(member.user.displayAvatarURL())

ch.send({embeds:[embed]}).catch(()=>{})
})

/* ================= TOURNAMENT ================= */

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
new ButtonBuilder().setCustomId("unregister").setLabel("Unregister").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("participants").setLabel("Participants").setStyle(ButtonStyle.Secondary)
)

let msg=await channel.send({embeds:[embed],components:[row]})
tournament.registerMsg=msg.id
saveJSON("./tournament.json",tournament)
}

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

channel.send({
embeds:[new EmbedBuilder().setTitle(`Round ${tournament.round}`).setDescription(text)],
components:[row]
})
}

/* ================= INTERACTIONS ================= */

client.on("interactionCreate",async interaction=>{
try{

/* BUTTONS */

if(interaction.isButton()){

if(interaction.customId==="register"){
if(tournament.started)
return interaction.reply({content:"Closed",ephemeral:true})

if(!tournament.players.includes(interaction.user.id)){
tournament.players.push(interaction.user.id)
saveJSON("./tournament.json",tournament)
}

await interaction.reply({content:"Joined",ephemeral:true})

if(tournament.players.length===tournament.max){
createBracket(interaction.channel)
}
}

if(interaction.customId==="unregister"){
tournament.players=tournament.players.filter(p=>p!==interaction.user.id)
saveJSON("./tournament.json",tournament)

await interaction.reply({content:"Removed",ephemeral:true})
}

if(interaction.customId==="participants"){
let list=await Promise.all(
tournament.players.map(id=>client.users.fetch(id).then(u=>u.username))
)
await interaction.reply({content:list.join("\n")||"No players",ephemeral:true})
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

await interaction.reply({content:"Next round started",ephemeral:true})
}

if(interaction.customId==="open_ticket"){

const ch=await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
parent:TICKET_CATEGORY,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel]},
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel]},
{ id:STAFF_ROLE, allow:[PermissionsBitField.Flags.ViewChannel]}
]
})

await ch.send(`Ticket opened by ${interaction.user}`)
await interaction.reply({content:"Ticket created",ephemeral:true})
}

}

/* SLASH */

if(interaction.isChatInputCommand()){

if(interaction.commandName!=="helpm" && !interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

if(interaction.commandName==="tour"){

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
await sendRegister(interaction.channel)

return interaction.reply({content:"Tournament created",ephemeral:true})
}

if(interaction.commandName==="qual"){
const user=interaction.options.getUser("player")

if(!tournament.qualified.includes(user.id))
tournament.qualified.push(user.id)

for(let m of tournament.matches){
if(m.p1===user.id||m.p2===user.id){
m.winner=user.id
}
}

saveJSON("./tournament.json",tournament)
return interaction.reply({content:`Qualified ${user.username}`,ephemeral:true})
}

if(interaction.commandName==="code"){
const code=interaction.options.getString("code")
const user=interaction.options.getUser("player")

const match=tournament.matches.find(m=>m.p1===user.id||m.p2===user.id)
if(!match)
return interaction.reply({content:"Match not found",ephemeral:true})

const p1=await client.users.fetch(match.p1)
const p2=await client.users.fetch(match.p2)

p1.send(`Room Code: ${code}`).catch(()=>{})
p2.send(`Room Code: ${code}`).catch(()=>{})

return interaction.reply({content:"Code sent",ephemeral:true})
}

if(interaction.commandName==="delm"){
tournament={players:[],matches:[],qualified:[],round:1,max:0,server:"",map:"",rewards:[],started:false}
saveJSON("./tournament.json",tournament)

return interaction.reply({content:"Tournament deleted",ephemeral:true})
}

if(interaction.commandName==="ticket"){
const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("open_ticket").setLabel("Open Ticket").setStyle(ButtonStyle.Primary)
)

await interaction.channel.send({
embeds:[new EmbedBuilder().setTitle("Support").setDescription("Click below")],
components:[row]
})

return interaction.reply({content:"Panel sent",ephemeral:true})
}

if(interaction.commandName==="helpm"){
return interaction.reply({
content:`/tour /qual /code /delm /ticket`,
ephemeral:true
})
}

}

}catch(err){
console.error(err)
if(!interaction.replied){
interaction.reply({content:"Error occurred",ephemeral:true}).catch(()=>{})
}
}
})

client.login(process.env.TOKEN)
