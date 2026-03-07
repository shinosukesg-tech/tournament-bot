require("dotenv").config()

const express = require("express")
const app = express()

app.get("/",(req,res)=>res.send("Bot Alive"))
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

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
})

const PREFIX=";"

/* ================= EMOJIS ================= */

const VS = "<:VS:1477014161484677150>"
const TICK = "<:TICK:1467892699578236998>"

/* ================= IMAGES ================= */

const REGISTER_IMG = "https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"

const BRACKET_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

const WINNER_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

const TICKET_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"

function random(arr){
return arr[Math.floor(Math.random()*arr.length)]
}

/* ================= DATA ================= */

let players=[]
let bracket=[]
let winners=[]
let byeCount=0

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= WELCOME ================= */

client.on("guildMemberAdd", async member=>{

const channel = member.guild.channels.cache.find(c=>c.name.includes("welcome"))
if(!channel) return

const created = Math.floor(member.user.createdTimestamp/1000)
const ageDays = Math.floor((Date.now()-member.user.createdTimestamp)/86400000)

const embed = new EmbedBuilder()

.setTitle(`Welcome ${member.user.username}`)
.setDescription(`
👋 Welcome **${member.user.username}** to 🏆 **${member.guild.name}**

🆔 **User ID**
${member.id}

📅 **Account Created**
<t:${created}:D>

⏳ **Account Age**
${ageDays} days

🎭 **Display Name**
${member.displayName}
`)
.setThumbnail(member.user.displayAvatarURL())
.setColor("Purple")

channel.send({content:`Welcome ${member}`,embeds:[embed]})

})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).split(/ +/)
const cmd = args.shift().toLowerCase()

/* ================= TOURNAMENT ================= */

if(cmd==="1v1"){

players=[]
bracket=[]
winners=[]
byeCount=0

const embed = new EmbedBuilder()
.setTitle("🏆 Tournament")
.setDescription(`🎮 Mode: 1v1
👥 Players: **0**
Status: **OPEN**`)
.setImage(REGISTER_IMG)
.setColor("Red")

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)
)

message.channel.send({embeds:[embed],components:[row]})
}

/* ================= REGISTER ================= */

if(cmd==="start"){

let list=[...players]

for(let i=0;i<byeCount;i++){
list.push(`BYE_${i}`)
}

list.sort(()=>Math.random()-0.5)

bracket=[]

for(let i=0;i<list.length;i+=2){
bracket.push([list[i],list[i+1]])
}

let text=""

for(const match of bracket){

const p1 = match[0].startsWith?.("BYE") ? "BYE BOT" : (await client.users.fetch(match[0])).username
const p2 = match[1]?.startsWith?.("BYE") ? "BYE BOT" : (await client.users.fetch(match[1])).username

text+=`${p1} ${VS} ${p2}\n`
}

const embed = new EmbedBuilder()
.setTitle("🏆 Tournament Bracket")
.setDescription(text)
.setImage(random(BRACKET_IMAGES))

message.channel.send({embeds:[embed]})
}

/* ================= BYE BOT ================= */

if(cmd==="bye"){

byeCount++

message.reply(`🤖 BYE bot added (Total BYE: ${byeCount})`)
}

/* ================= QUALIFY ================= */

if(cmd==="qual"){

const user = message.mentions.users.first()

if(!user) return message.reply("Mention winner")

winners.push(user.id)

message.reply(`${TICK} ${user.username} qualified`)
}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed = new EmbedBuilder()
.setTitle("🎫 Ticket System")
.setDescription(`
🛡 **Support** → Need help or question
📋 **Apply** → Apply for staff
🎁 **Reward** → Claim reward
`)
.setImage(TICKET_IMG)
.setColor("Blue")

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("support_ticket")
.setLabel("Support")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("apply_ticket")
.setLabel("Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward_ticket")
.setLabel("Reward")
.setStyle(ButtonStyle.Primary)
)

message.channel.send({embeds:[embed],components:[row]})
}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

/* ================= REGISTER ================= */

if(interaction.customId==="register"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

players.push(interaction.user.id)

interaction.reply({content:`${TICK} Registered`,ephemeral:true})
}

/* ================= UNREGISTER ================= */

if(interaction.customId==="unregister"){

players = players.filter(p=>p!==interaction.user.id)

interaction.reply({content:"Removed from tournament",ephemeral:true})
}

/* ================= TICKETS ================= */

if(interaction.customId.includes("ticket")){

let category = interaction.guild.channels.cache.find(c=>c.name==="tickets")

if(!category){

category = await interaction.guild.channels.create({
name:"tickets",
type:ChannelType.GuildCategory
})

}

const channel = await interaction.guild.channels.create({

name:`ticket-${interaction.user.username}`,

type:ChannelType.GuildText,

parent:category.id,

permissionOverwrites:[

{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},

{
id:interaction.user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
}
]

})

channel.send(`Hello ${interaction.user}`)

interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
})

}

})

client.login(process.env.TOKEN)
