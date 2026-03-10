require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express")
const app = express()

app.get("/", (req,res)=>res.send("Bot Alive"))
app.listen(process.env.PORT || 3000)

/* ================= DISCORD ================= */

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
ChannelType,
PermissionsBitField
} = require("discord.js")

const fs = require("fs")

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

const PREFIX="!"

/* ================= ROLES ================= */

const MOD_ROLE="Moderator"

/* ================= EMOJIS ================= */

const CHECK="<:check:1480513506871742575>"
const CROSS="<:sg_cross:1480513567655592037>"
const VS="<:VS:1477014161484677150>"

/* ================= IMAGES ================= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"
const TICKET_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const BRACKET_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg"

/* ================= FILES ================= */

const tournamentFile="./tournament.json"

function load(file){
if(!fs.existsSync(file)) return {}
return JSON.parse(fs.readFileSync(file))
}

function save(file,data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

let data=load(tournamentFile)

/* ================= TOURNAMENT ================= */

let players=data.players || []
let matches=data.matches || []
let winners=data.winners || []
let completedMatches=data.completedMatches || []
let round=data.round || 1
let maxPlayers=data.maxPlayers || 16

let server="Not Set"
let map="Not Set"
let rewards=[]

let registerMessage=null

/* ================= FOOTER ================= */

function footer(){

const time = new Date().toLocaleTimeString("en-IN",{
timeZone:"Asia/Kolkata",
hour:"2-digit",
minute:"2-digit",
hour12:true
})

return {
text:`ShinosukeSG | ${time} IST`,
iconURL:FOOTER_IMG
}

}

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

message.delete().catch(()=>{})

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()

.setTitle("🎟 ShinTours Ticket System")

.setDescription(`
🎧 Support
📝 Apply
🎁 Reward
`)

.setImage(TICKET_IMG)
.setFooter(footer())

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("support_ticket")
.setLabel("Support")
.setEmoji("🎧")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("apply_ticket")
.setLabel("Apply")
.setEmoji("📝")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward_ticket")
.setLabel("Reward")
.setEmoji("🎁")
.setStyle(ButtonStyle.Danger)

)

message.channel.send({embeds:[embed],components:[row]})

}

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

maxPlayers=parseInt(args[0])

server=args[1]
map=args[2]

rewards=[args[3],args[4],args[5]]

players=[]
matches=[]
winners=[]
completedMatches=[]
round=1

save(tournamentFile,{players,matches,winners,completedMatches,round,maxPlayers})

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
Server: **${server}**
Map: **${map}**

👤 Players: 0/${maxPlayers}

🥇 ${rewards[0]}
🥈 ${rewards[1]}
🥉 ${rewards[2]}
`)

.setImage(REGISTER_IMG)
.setFooter(footer())

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji(CHECK)
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`0/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setEmoji(CROSS)
.setStyle(ButtonStyle.Danger)

)

registerMessage=await message.channel.send({embeds:[embed],components:[row]})

}

})

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

/* ================= REGISTER ================= */

if(interaction.customId==="register"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

players.push(interaction.user.id)

updateRegister()

interaction.reply({content:"Registered",ephemeral:true})

}

/* ================= UNREGISTER ================= */

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)

updateRegister()

interaction.reply({content:"Removed",ephemeral:true})

}

/* ================= CREATE TICKET ================= */

if(["support_ticket","apply_ticket","reward_ticket"].includes(interaction.customId)){

const guild=interaction.guild

const modRole=guild.roles.cache.find(r=>r.name===MOD_ROLE)

let category=guild.channels.cache.find(c=>c.name==="ShinTours Support")

if(!category){

category=await guild.channels.create({
name:"ShinTours Support",
type:ChannelType.GuildCategory
})

}

let type=interaction.customId.replace("_ticket","")

const channel=await guild.channels.create({

name:`${type}-${interaction.user.username}`,

type:ChannelType.GuildText,

parent:category.id,

permissionOverwrites:[

{ id:guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},

{ id:interaction.user.id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
},

{ id:modRole.id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
}

]

})

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close Ticket")
.setEmoji("🔒")
.setStyle(ButtonStyle.Danger)

)

const embed=new EmbedBuilder()

.setTitle("🎫 Ticket Opened")
.setDescription(`User: ${interaction.user}`)
.setFooter(footer())

channel.send({embeds:[embed],components:[row]})

interaction.reply({
content:`✅ Ticket created: ${channel}`,
ephemeral:true
})

}

/* ================= CLOSE TICKET ================= */

if(interaction.customId==="close_ticket"){

if(!interaction.member.roles.cache.find(r=>r.name===MOD_ROLE))
return interaction.reply({content:"Moderator only",ephemeral:true})

interaction.channel.delete()

}

})

/* ================= UPDATE REGISTER ================= */

function updateRegister(){

if(!registerMessage) return

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
Server: **${server}**
Map: **${map}**

👤 Players: ${players.length}/${maxPlayers}

🥇 ${rewards[0]}
🥈 ${rewards[1]}
🥉 ${rewards[2]}
`)

.setImage(REGISTER_IMG)
.setFooter(footer())

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji(CHECK)
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`${players.length}/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setEmoji(CROSS)
.setStyle(ButtonStyle.Danger)

)

registerMessage.edit({embeds:[embed],components:[row]}).catch(()=>{})

}

client.login(process.env.TOKEN)
