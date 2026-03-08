require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express");
const app = express();

app.get("/", (req,res)=>res.send("Bot Alive"));
app.listen(process.env.PORT || 3000);

process.on("unhandledRejection", console.error);

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
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

const PREFIX=";"

/* ================= EMOJIS ================= */

const VS="<:VS:1477014161484677150>"
const TICK="<:TICK:1467892699578236998>"

/* ================= IMAGES ================= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"

const TICKET_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"

/* ================= DATA ================= */

let players=[]
let matches=[]
let maxPlayers=0
let mapName=""
let serverName=""
let prize=""

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= WELCOME (UNCHANGED) ================= */

client.on("guildMemberAdd", async member=>{

const channel = member.guild.channels.cache.find(c=>c.name.includes("welcome"))
if(!channel) return

const age=Math.floor((Date.now()-member.user.createdTimestamp)/86400000)

const embed=new EmbedBuilder()

.setTitle(`Welcome ${member.user.username}`)

.setDescription(`
👋 Welcome **${member.user.username}**

🏆 **${member.guild.name}**

🆔 **User ID**
${member.id}

📅 **Account Created**
<t:${Math.floor(member.user.createdTimestamp/1000)}:D>

⏳ **Account Age**
${age} days

🎭 **Display Name**
${member.displayName}
`)

.setThumbnail(member.user.displayAvatarURL())

.setColor("Purple")

channel.send({
content:`Welcome ${member}`,
embeds:[embed]
})

})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args=message.content.slice(PREFIX.length).split(/ +/)
const cmd=args.shift().toLowerCase()

/* ================= HELP ================= */

if(cmd==="help"){

const embed=new EmbedBuilder()

.setTitle("🏆 ShinTours Tournament Bot")

.setDescription(`
🎮 Tournament

;1v1 <players> <server> <map> <prize>
;start
;code <roomcode> @player

🎟 Support

;ticketpanel
`)

.setColor("Grey")

message.channel.send({embeds:[embed]})

message.delete().catch(()=>{})
}

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

players=[]
maxPlayers=parseInt(args[0]) || 16
serverName=args[1] || "Asia"
mapName=args[2] || "Random"
prize=args[3] || "Custom"

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
🎮 Mode: **1v1**

🌍 Server: **${serverName}**
🗺 Map: **${mapName}**
🎁 Prize: **${prize}**

👤 Registered: **0/${maxPlayers}**

Status: **OPEN**
`)

.setImage(REGISTER_IMG)

.setColor("Red")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 0/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

)

message.channel.send({embeds:[embed],components:[row]})

message.delete().catch(()=>{})
}

/* ================= CODE ================= */

if(cmd==="code"){

const code=args[0]
const player=message.mentions.users.first()

if(!code || !player) return

const match=matches.find(m=>m.includes(player.id))
if(!match) return

const opponentID=match.find(p=>p!==player.id)
const opponent=await client.users.fetch(opponentID)

const embed=new EmbedBuilder()

.setTitle("🏆 Match Room Code")

.setDescription(`
Opponent: **${opponent.username}**

Room Code

\`\`\`
${code}
\`\`\`

Server: **${serverName}**
Map: **${mapName}**

Good luck!
`)

player.send({embeds:[embed]}).catch(()=>{})
opponent.send({embeds:[embed]}).catch(()=>{})

message.reply(`${TICK} Code sent`)

message.delete().catch(()=>{})
}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()

.setTitle("🎫 Ticket System")

.setDescription(`
Select an option below:

🛡 **Support →** Need help or have a question
📋 **Apply →** Apply to become staff
🎁 **Reward →** Claim your reward
`)

.setImage(TICKET_IMG)

.setColor("Blue")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("support")
.setLabel("🛡 Support")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("apply")
.setLabel("📋 Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward")
.setLabel("🎁 Reward")
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

if(players.length>=maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true})

players.push(interaction.user.id)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 ${players.length}/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

)

interaction.message.edit({components:[row]})

interaction.reply({content:`${TICK} Registered`,ephemeral:true})

}

/* ================= UNREGISTER ================= */

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 ${players.length}/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

)

interaction.message.edit({components:[row]})

interaction.reply({content:"Removed",ephemeral:true})

}

/* ================= TICKET CREATION ================= */

if(["support","apply","reward"].includes(interaction.customId)){

let category=interaction.guild.channels.cache.find(
c=>c.name==="ShinTours Support"
)

if(!category){

category=await interaction.guild.channels.create({
name:"ShinTours Support",
type:ChannelType.GuildCategory
})

}

const modRole=interaction.guild.roles.cache.find(
r=>r.name==="Moderator"
)

const channel=await interaction.guild.channels.create({

name:`${interaction.customId}-${interaction.user.username}`,

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
},

{
id:modRole?.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
}

]

})

channel.send(`Hello ${interaction.user} 👋
Staff will assist you soon.`)

interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
})

}

})

/* ================= LOGIN ================= */

client.login(process.env.TOKEN)
