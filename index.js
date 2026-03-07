require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express");
const app = express();

app.get("/", (req,res)=>res.send("Bot Alive"));
app.listen(process.env.PORT || 3000);

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
} = require("discord.js");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
});

const PREFIX=";"

/* ================= IMAGES ================= */

const REGISTER_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
]

const BRACKET_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

const WINNER_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

const TICKET_IMAGE="https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"

function random(arr){
return arr[Math.floor(Math.random()*arr.length)]
}

/* ================= DATA ================= */

let players=[]
let bracket=[]
let currentMatch=0

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= WELCOME ================= */

client.on("guildMemberAdd",member=>{

const channel=member.guild.channels.cache.find(c=>c.name.includes("welcome"))
if(!channel) return

const created=`<t:${Math.floor(member.user.createdTimestamp/1000)}:D>`
const age=Math.floor((Date.now()-member.user.createdTimestamp)/86400000)

const embed=new EmbedBuilder()
.setTitle(`Welcome\n${member.user.username}`)
.setDescription(`👋

Welcome **${member.user.username}** to
🏆 **${member.guild.name}**
Have fun here!

🆔 **User ID**
${member.id}

📅 **Account Created**
${created}

⏳ **Account Age**
${age} days

🎭 **Display Name**
${member.displayName}`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setColor("Purple")

channel.send({content:`Welcome ${member}`,embeds:[embed]})

})

/* ================= COMMANDS ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args=message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd=args.shift().toLowerCase()

/* ================= CODE DM COMMAND ================= */

if(cmd==="code"){

const code=args[0]
const users=message.mentions.users

if(!code) return message.reply("Provide code.")
if(users.size<1) return message.reply("Mention players.")

const embed=new EmbedBuilder()
.setTitle("🏆 Tournament Match Code")
.setDescription(`🎮 Your match code:

\`\`\`${code}\`\`\`

Good luck in your match! 🍀`)
.setColor("Gold")

users.forEach(async user=>{

try{
await user.send({embeds:[embed]})
}catch{
console.log(`Couldn't DM ${user.username}`)
}

})

message.reply("📩 Code sent to players DM.")

}

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

players=[]
bracket=[]
currentMatch=0

const embed=new EmbedBuilder()
.setTitle("🏆 Tournament")
.setDescription(`🎮 Mode: 1v1
👥 Players: **0**
Status: **OPEN**`)
.setImage(random(REGISTER_IMAGES))
.setColor("Red")

const row=new ActionRowBuilder().addComponents(

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

/* ================= BYE ================= */

if(cmd==="bye"){
players.push("BYE")
message.reply("BYE slot added.")
}

/* ================= QUALIFIER ================= */

if(cmd==="qual"){

if(args[0]!=="bye1") return

const user=message.mentions.users.first()
if(!user) return message.reply("Mention user.")

players.push(user.id)

message.reply(`${user.username} added as qualifier.`)

}

/* ================= START ================= */

if(cmd==="start"){

if(players.length<2)
return message.reply("Need at least 2 players.")

players.sort(()=>Math.random()-0.5)

for(let i=0;i<players.length;i+=2){
bracket.push([players[i],players[i+1]])
}

let desc=""

for(const match of bracket){

let p1=match[0]==="BYE"?"BYE":(await client.users.fetch(match[0])).username
let p2=match[1]==="BYE"?"BYE":(await client.users.fetch(match[1])).username

desc+=`**${p1}** <:VS:1477014161484677150> **${p2}**\n`
}

const embed=new EmbedBuilder()
.setTitle("🏆 Tournament Bracket")
.setDescription(desc)
.setImage(random(BRACKET_IMAGES))
.setColor("Blue")

message.channel.send({embeds:[embed]})

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()
.setTitle("🎫 Ticket System")
.setDescription(`Select an option below:

🛡 **Support** → Need help or have a question
📋 **Apply** → Apply to become staff
🎁 **Reward** → Claim your reward`)
.setImage(TICKET_IMAGE)
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

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return

/* REGISTER */

if(interaction.customId==="register"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Already registered.",ephemeral:true})

players.push(interaction.user.id)

interaction.reply({content:"Registered!",ephemeral:true})

}

/* UNREGISTER */

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)

interaction.reply({content:"Unregistered.",ephemeral:true})

}

/* CREATE TICKETS */

if(
interaction.customId==="support_ticket" ||
interaction.customId==="apply_ticket" ||
interaction.customId==="reward_ticket"
){

const channel=await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:ChannelType.GuildText,
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

channel.send(`Hello ${interaction.user}, staff will assist you.`)

interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
})

}

})

client.login(process.env.TOKEN)
