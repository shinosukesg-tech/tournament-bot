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

function getIST(){
return new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})
}

function autoDelete(msg,time=1000){
setTimeout(()=>msg.delete().catch(()=>{}),time)
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

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"

const FOOTER_ICON="https://cdn.discordapp.com/attachments/1471952333209604239/1480914400314392627/Screenshot_20260310_183459_Discord.jpg"

const WELCOME_CHANNEL="1465234114318696498"
const TICKET_CATEGORY="1480854630035357776"

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

client.once("ready",()=>console.log(`Logged in as ${client.user.tag}`))

function addFooter(embed){
embed.setFooter({
text:`Enjoy The Fun | ShinosukeSG | ${getIST()}`,
iconURL:FOOTER_ICON
})
return embed
}

/* WELCOME */

client.on("guildMemberAdd", async member=>{
const channel=member.guild.channels.cache.get(WELCOME_CHANNEL)
if(!channel) return

const created=member.user.createdAt
const now=new Date()
const ageDays=Math.floor((now - created)/(1000*60*60*24))

const embed=addFooter(
new EmbedBuilder()
.setColor("#a855f7")
.setTitle(`Welcome ${member.user.username}! 👋`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setDescription(`
Welcome **${member.user.username}**
to 🏆 **${member.guild.name}**

🆔 ${member.id}
⏳ ${ageDays} days old
`)
)

channel.send({content:`Welcome ${member}`,embeds:[embed]})
})

/* TICKET */

client.on("interactionCreate",async interaction=>{
if(!interaction.isButton()) return

if(interaction.customId==="create_ticket"){

const channel=await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:ChannelType.GuildText,
parent:TICKET_CATEGORY,
permissionOverwrites:[
{ id:interaction.guild.roles.everyone, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] },
{ id:MOD_ROLE, allow:[PermissionsBitField.Flags.ViewChannel] }
]
})

channel.send({
content:`${interaction.user}`,
embeds:[new EmbedBuilder().setTitle("Support Ticket")]
})

return interaction.reply({content:"Ticket created",ephemeral:true})
}

/* REGISTER */

if(interaction.customId==="register"){

if(tournament.started)
return interaction.reply({content:"Registration closed",ephemeral:true})

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

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

/* NEXT ROUND */

if(interaction.customId==="next_round"){

if(!interaction.member.roles.cache.has(MOD_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

await interaction.deferReply({ephemeral:true})

let next=[...tournament.qualified]
tournament.players=next
tournament.qualified=[]
tournament.round++

saveJSON("./tournament.json",tournament)

await createBracket(interaction.channel)

interaction.editReply({content:"Next round created"})
}

})

/* REGISTER PANEL */

async function sendRegister(channel){

const embed=addFooter(
new EmbedBuilder()
.setTitle("🏆 Tournament")
.setImage(REGISTER_IMG)
.setDescription(`
Players: ${tournament.players.length}/${tournament.max}
Server: ${tournament.server}
Map: ${tournament.map}
`)
)

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("unregister").setLabel("Unregister").setStyle(ButtonStyle.Danger)
)

let msg=await channel.send({embeds:[embed],components:[row]})
tournament.registerMsg=msg.id
saveJSON("./tournament.json",tournament)
}

async function updateRegister(channel){
if(!tournament.registerMsg) return
let msg=await channel.messages.fetch(tournament.registerMsg).catch(()=>null)
if(!msg) return

const embed=addFooter(
new EmbedBuilder()
.setTitle("🏆 Tournament")
.setImage(REGISTER_IMG)
.setDescription(`Players: ${tournament.players.length}/${tournament.max}`)
)

msg.edit({embeds:[embed]})
}

/* CREATE BRACKET */

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

/* SEND BRACKET */

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
embeds:[addFooter(new EmbedBuilder().setTitle(`Round ${tournament.round}`).setDescription(text).setImage(BRACKET_IMG))],
components:[row]
})

tournament.bracketMsg=msg.id
saveJSON("./tournament.json",tournament)
}

/* COMMANDS */

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
started:false,
registerMsg:null,
bracketMsg:null
}

saveJSON("./tournament.json",tournament)
sendRegister(msg.channel)
}

/* DELM */

if(cmd==="delm"){

if(!msg.member.roles.cache.has(STAFF_ROLE)) return

try{
if(tournament.registerMsg){
let m=await msg.channel.messages.fetch(tournament.registerMsg)
m.delete().catch(()=>{})
}
if(tournament.bracketMsg){
let m=await msg.channel.messages.fetch(tournament.bracketMsg)
m.delete().catch(()=>{})
}
}catch{}

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

let m=await msg.channel.send("Tournament deleted")
autoDelete(m)
}

})

client.login(process.env.TOKEN)
