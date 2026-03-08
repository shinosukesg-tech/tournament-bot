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

const PREFIX=";"

/* ================= ROLES ================= */

const MOD_ROLE="Moderator"
const STAFF_ROLE="Tournament Staff"

/* ================= IMAGES ================= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"

const BRACKET_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"

/* ================= DATA ================= */

let players=[]
let matches=[]
let winners=[]
let round=1
let maxPlayers=16

let serverName="Unknown"
let prizeName="Unknown"

let registerMessage=null

/* ================= WELCOME DATA ================= */

let welcomeData={}
if(fs.existsSync("./welcome.json")){
welcomeData=JSON.parse(fs.readFileSync("./welcome.json"))
}

function saveWelcome(){
fs.writeFileSync("./welcome.json",JSON.stringify(welcomeData,null,2))
}

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= AUTO WELCOME ================= */

client.on("guildMemberAdd", async member => {

let data = welcomeData[member.guild.id]
if(!data) return

let channel = member.guild.channels.cache.get(data)
if(!channel) return

const embed = new EmbedBuilder()

.setTitle("🎉 New Member Joined!")

.setThumbnail(member.user.displayAvatarURL({dynamic:true}))

.setDescription(`
👤 **User:** ${member.user}

🆔 **User ID:** \`${member.id}\`

📅 **Account Created:**  
<t:${Math.floor(member.user.createdTimestamp/1000)}:F>

📥 **Joined Server:**  
<t:${Math.floor(Date.now()/1000)}:F>

👥 **Member Count:** ${member.guild.memberCount}

🎊 Welcome to **${member.guild.name}**!
`)

.setColor("Green")

.setFooter({ text: `Welcome ${member.user.username}!` })

channel.send({embeds:[embed]})

})

/* ================= COMMAND HANDLER ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

message.delete().catch(()=>{})

/* ================= HELP ================= */

if(cmd==="help"){

const embed=new EmbedBuilder()

.setTitle("📜 Bot Commands")

.setColor("Blue")

.setDescription(`
🏆 **Tournament**
;1v1 <players> <server> <prize>
;start
;code <room> @player
;qual @player
;next

🎫 **Support**
;ticketpanel

⚙ **Setup**
;welcome #channel
`)

message.channel.send({embeds:[embed]})

}

/* ================= SET WELCOME ================= */

if(cmd==="welcome"){

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return

let channel=message.mentions.channels.first()

if(!channel) return

welcomeData[message.guild.id]=channel.id
saveWelcome()

message.channel.send(`Welcome channel set to ${channel}`)

}

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

if(!message.member.roles.cache.find(r=>r.name===STAFF_ROLE))
return

maxPlayers=parseInt(args[0]) || 16
serverName=args[1] || "Unknown"
prizeName=args[2] || "Unknown"

players=[]
matches=[]
winners=[]
round=1

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
🎮 **Server:** ${serverName}
🎁 **Prize:** ${prizeName}

👥 Players: **0/${maxPlayers}**
Status: **OPEN**
`)

.setImage(REGISTER_IMG)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji("✅")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setEmoji("❌")
.setStyle(ButtonStyle.Danger)

)

registerMessage=await message.channel.send({
embeds:[embed],
components:[row]
})

}

/* ================= START ================= */

if(cmd==="start"){

if(!message.member.roles.cache.find(r=>r.name===STAFF_ROLE))
return

let shuffled=[...players].sort(()=>Math.random()-0.5)

matches=[]

for(let i=0;i<shuffled.length;i+=2){

if(shuffled[i+1])
matches.push({p1:shuffled[i],p2:shuffled[i+1]})

}

sendBracket(message.channel)

}

/* ================= QUALIFY ================= */

if(cmd==="qual"){

let user=message.mentions.users.first()
if(!user) return

winners.push(user.id)

message.channel.send(`${user} qualified`)

}

/* ================= NEXT ROUND ================= */

if(cmd==="next"){

if(winners.length<2) return

let list=[...winners]

winners=[]
matches=[]
round++

for(let i=0;i<list.length;i+=2){

if(list[i+1])
matches.push({p1:list[i],p2:list[i+1]})

}

sendBracket(message.channel)

}

/* ================= CODE ================= */

if(cmd==="code"){

let room=args[0]
let user=message.mentions.users.first()

if(!room||!user) return

let match=matches.find(m=>m.p1==user.id||m.p2==user.id)
if(!match) return

let p1=await client.users.fetch(match.p1)
let p2=await client.users.fetch(match.p2)

const embed=new EmbedBuilder()

.setTitle("🎮 Match Room")

.setDescription(`
${p1.username} VS ${p2.username}

Room Code
\`\`\`
${room}
\`\`\`
`)

p1.send({embeds:[embed]}).catch(()=>{})
p2.send({embeds:[embed]}).catch(()=>{})

}

})

/* ================= BUTTON INTERACTIONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

/* REGISTER */

if(interaction.customId==="register"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Already joined",ephemeral:true})

if(players.length>=maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true})

players.push(interaction.user.id)

interaction.reply({content:"Registered",ephemeral:true})

}

/* UNREGISTER */

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)

interaction.reply({content:"Unregistered",ephemeral:true})

}

/* ================= TICKETS ================= */

if(["support","apply","reward"].includes(interaction.customId)){

let guild=interaction.guild

let category=guild.channels.cache.find(c=>c.name==="ShinTours Support")

if(!category){

category=await guild.channels.create({
name:"ShinTours Support",
type:ChannelType.GuildCategory
})

}

let modRole=guild.roles.cache.find(r=>r.name===MOD_ROLE)

let channel=await guild.channels.create({

name:`${interaction.customId}-${interaction.user.username}`,

type:ChannelType.GuildText,

parent:category.id,

permissionOverwrites:[
{
id:guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},
{
id:interaction.user.id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
},
{
id:modRole.id,
allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]
}
]

})

interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
})

}

})

/* ================= BRACKET ================= */

function sendBracket(channel){

let embed=new EmbedBuilder()

.setTitle(`Round ${round}`)

.setImage(BRACKET_IMG)

let desc=""

matches.forEach((m,i)=>{
desc+=`Match ${i+1}\n<@${m.p1}> VS <@${m.p2}>\n\n`
})

embed.setDescription(desc)

channel.send({embeds:[embed]})

}

client.login(process.env.TOKEN)
