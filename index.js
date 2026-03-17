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

const PREFIX="!"

const VS="<:VS:1477014161484677150>"
const CHECK="<:check:1480513506871742575>"

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"

const FOOTER_ICON="https://cdn.discordapp.com/attachments/1471952333209604239/1480914400314392627/Screenshot_20260310_183459_Discord.jpg"

const WELCOME_CHANNEL="1465234114318696498"
const TICKET_CATEGORY="1480854630035357776"
const MOD_ROLE="1429913618211672125"

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

function addFooter(embed){
embed.setFooter({
text:`Enjoy The Fun | ShinosukeSG | ${getIST()}`,
iconURL:FOOTER_ICON
})
return embed
}

/* WELCOME */

client.on("guildMemberAdd",member=>{
const channel=member.guild.channels.cache.get(WELCOME_CHANNEL)
if(!channel) return

const embed=addFooter(
new EmbedBuilder()
.setColor("#a855f7")
.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL())
.setDescription(`Welcome **${member.user.username}** to **${member.guild.name}**`)
)

channel.send({content:`Welcome ${member}`,embeds:[embed]})
})

/* TICKET PANEL */

client.on("messageCreate",async msg=>{
if(msg.author.bot) return

if(msg.content==="!ticketpanel"){

const embed=new EmbedBuilder()
.setTitle("🎫 Support Ticket")
.setDescription("Press button to create ticket")

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("create_ticket")
.setLabel("Create Ticket")
.setStyle(ButtonStyle.Primary)
)

msg.channel.send({embeds:[embed],components:[row]})
}
})

/* INTERACTIONS */

client.on("interactionCreate",async interaction=>{
if(!interaction.isButton()) return

/* CREATE TICKET */

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

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close Ticket")
.setStyle(ButtonStyle.Danger)
)

channel.send({
content:`${interaction.user}`,
embeds:[new EmbedBuilder().setTitle("Support Ticket")],
components:[row]
})

return interaction.reply({content:"Ticket created",ephemeral:true})
}

/* CLOSE TICKET */

if(interaction.customId==="close_ticket"){
if(!interaction.member.roles.cache.has(MOD_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

return interaction.channel.delete()
}

/* REGISTER */

if(interaction.customId==="register"){

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

tournament.players.push(interaction.user.id)
saveJSON("./tournament.json",tournament)

await interaction.reply({content:"Registered",ephemeral:true})

if(tournament.players.length===tournament.max){
createBracket(interaction.channel)
}
}

/* UNREGISTER */

if(interaction.customId==="unregister"){

tournament.players=tournament.players.filter(p=>p!==interaction.user.id)
saveJSON("./tournament.json",tournament)

interaction.reply({content:"Unregistered",ephemeral:true})
}

/* PARTICIPANTS */

if(interaction.customId==="participants"){

let list=""

for(let id of tournament.players){
let u=await client.users.fetch(id)
list+=`${u.username}\n`
}

interaction.reply({content:list||"None",ephemeral:true})
}

/* NEXT ROUND (FIXED) */

if(interaction.customId==="next_round"){

if(!interaction.member.roles.cache.has(MOD_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

await interaction.deferReply({ephemeral:true})

if(!tournament.qualified || tournament.qualified.length < 2){
return interaction.editReply({content:"Not enough qualified players"})
}

/* finals */

if(tournament.qualified.length === 3){

let [f,s,t]=tournament.qualified

let first=await client.users.fetch(f)
let second=await client.users.fetch(s)
let third=await client.users.fetch(t)

const embed=addFooter(
new EmbedBuilder()
.setTitle("🏆 Tournament Results")
.setThumbnail(first.displayAvatarURL())
.setDescription(`
🥇 **${first.username}** — ${tournament.rewards[0]}
🥈 **${second.username}** — ${tournament.rewards[1]}
🥉 **${third.username}** — ${tournament.rewards[2]}
`)
)

await interaction.channel.send({embeds:[embed]})
return interaction.editReply({content:"Results announced"})
}

/* safe pairing */

let next=[...tournament.qualified]
if(next.length%2!==0) next.pop()

tournament.players=next
tournament.qualified=[]
tournament.round++

saveJSON("./tournament.json",tournament)

if(tournament.players.length<2){
return interaction.editReply({content:"Not enough players"})
}

await createBracket(interaction.channel)

return interaction.editReply({content:"Next round created"})
}

})

/* CREATE BRACKET */

async function createBracket(channel){

let shuffled=[...tournament.players].sort(()=>Math.random()-0.5)

tournament.matches=[]
tournament.qualified=[]

for(let i=0;i<shuffled.length;i+=2){
if(!shuffled[i+1]) break

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1],
winner:null
})
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

text+=`
${m.winner?CHECK:""}
Match ${i+1}
${p1.username} ${VS} ${p2.username}

`
}

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("next_round")
.setLabel("Next Round")
.setStyle(ButtonStyle.Primary)
)

const embed=addFooter(
new EmbedBuilder()
.setTitle(`Round ${tournament.round}`)
.setImage(BRACKET_IMG)
.setDescription(text)
)

channel.send({embeds:[embed],components:[row]})
}

/* COMMANDS */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

setTimeout(()=>msg.delete().catch(()=>{}),1000)

const args=msg.content.slice(PREFIX.length).split(" ")
const cmd=args.shift().toLowerCase()

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

if(cmd==="qual"){

let user=msg.mentions.users.first()
if(!user) return

if(!tournament.qualified.includes(user.id)){
tournament.qualified.push(user.id)
}

for(let m of tournament.matches){
if(m.p1===user.id||m.p2===user.id){
m.winner=user.id
}
}

saveJSON("./tournament.json",tournament)

sendBracket(msg.channel)
}

})

client.login(process.env.TOKEN)
