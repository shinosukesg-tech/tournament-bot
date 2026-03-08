require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express");
const app = express();

app.get("/", (req,res)=>res.send("Bot Alive"));
app.listen(process.env.PORT || 3000);

/* ================= DISCORD ================= */

require("dotenv").config()

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

const BRACKET_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

const TICKET_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"

/* ================= DATA ================= */

let players=[]
let matches=[]
let winners=[]
let byeFill=false

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= WELCOME ================= */

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

.setTitle("🏆 ShinTours Bot")

.setDescription(`
🎮 **Tournament**

;1v1 → create tournament  
;start → start bracket  
;bye → fill empty slots with BYE bots  
;qual @user → qualify winner  
;code <roomcode> @player → send room code  

🎟 **Support**

;ticketpanel → send ticket panel
`)

.setColor("Grey")

message.channel.send({embeds:[embed]})

}

/* ================= TOURNAMENT PANEL ================= */

if(cmd==="1v1"){

players=[]
matches=[]
winners=[]
byeFill=false

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament")

.setDescription(`
🎮 Mode: 1v1
👤 Players: **0**
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
.setLabel("👤 0")
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

)

message.channel.send({
embeds:[embed],
components:[row]
})

}

/* ================= BYE ================= */

if(cmd==="bye"){
byeFill=true
message.reply("BYE bots will fill empty bracket slots")
}

/* ================= START ================= */

if(cmd==="start"){

if(players.length<2) return message.reply("Not enough players")

let list=[...players]

if(byeFill){

while(list.length%2!==0){
list.push("BYE")
}

}

list.sort(()=>Math.random()-0.5)

matches=[]

for(let i=0;i<list.length;i+=2){
matches.push([list[i],list[i+1]])
}

let text=""

for(const m of matches){

let p1=m[0]=="BYE"?"BYE BOT":(await client.users.fetch(m[0])).username
let p2=m[1]=="BYE"?"BYE BOT":(await client.users.fetch(m[1])).username

text+=`${p1} ${VS} ${p2}\n`
}

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Bracket")
.setDescription(text)
.setImage(BRACKET_IMAGES[0])

message.channel.send({embeds:[embed]})

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()

.setTitle("🎫 Ticket System")

.setDescription(`
Select an option below:

🛡 **Support** → Need help or have a question  
📋 **Apply** → Apply to become staff  
🎁 **Reward** → Claim your reward
`)

.setImage(TICKET_IMG)

.setColor("Blue")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("support_ticket")
.setLabel("🛡 Support")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("apply_ticket")
.setLabel("📋 Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward_ticket")
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

players.push(interaction.user.id)

const count=players.length

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 ${count}`)
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

const count=players.length

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 ${count}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

)

interaction.message.edit({components:[row]})

interaction.reply({content:"Removed from tournament",ephemeral:true})

}

/* ================= TICKET BUTTONS ================= */

if(interaction.customId.includes("ticket")){

const guild=interaction.guild

let category=guild.channels.cache.find(c=>c.name==="ShinTours Support")

if(!category){

category=await guild.channels.create({
name:"ShinTours Support",
type:ChannelType.GuildCategory
})

}

let name="support"

if(interaction.customId==="apply_ticket") name="apply"
if(interaction.customId==="reward_ticket") name="reward"

const modRole=guild.roles.cache.find(r=>r.name==="Moderator")

const channel=await guild.channels.create({

name:`${name}-${interaction.user.username}`,

type:ChannelType.GuildText,

parent:category.id,

permissionOverwrites:[

{
id:guild.id,
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

client.login(process.env.TOKEN)
