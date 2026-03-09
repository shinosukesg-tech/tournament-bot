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

const PREFIX="!"

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
let mapName="Unknown"
let prizeName="Unknown"

let registerMessage=null

/* ================= WELCOME ================= */

let welcomeData={}
if(fs.existsSync("./welcome.json")){
welcomeData=JSON.parse(fs.readFileSync("./welcome.json"))
}

function saveWelcome(){
fs.writeFileSync("./welcome.json",JSON.stringify(welcomeData,null,2))
}

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

channel.send({embeds:[embed]})

})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

message.delete().catch(()=>{})

/* ================= HELP ================= */

if(cmd==="help"){

const embed=new EmbedBuilder()

.setTitle("📜 Tournament Bot Commands")

.setColor("Blue")

.setDescription(`
🏆 **Tournament Commands**

🎮 **Create Tournament**
\`!1v1 <players> <server> <map> <reward>\`

▶ **Start Tournament**
\`!start\`

🎯 **Qualify Player**
\`!qual @player\`

🤖 **Add BYE**
\`!qual bye1\`

🔁 **Next Round**
\`!next\`

🎟 **Support Panel**
\`!ticketpanel\`

⚙ **Set Welcome**
\`!welcome #channel\`
`)

.setImage(BRACKET_IMG)

message.channel.send({embeds:[embed]})

}

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

if(!message.member.roles.cache.find(r=>r.name===STAFF_ROLE))
return

maxPlayers=parseInt(args[0]) || 16
serverName=args[1] || "Unknown"
mapName=args[2] || "Unknown"
prizeName=args[3] || "Unknown"

players=[]
matches=[]
winners=[]
round=1

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
🌍 **Server:** ${serverName}
🗺 **Map:** ${mapName}
🎁 **Reward:** ${prizeName}

👤 **Players:** 0/${maxPlayers}
`)

.setImage(REGISTER_IMG)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji("✅")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 0/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

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

if(shuffled[i+1]){

matches.push({
p1:shuffled[i],
p2:shuffled[i+1]
})

}else{

matches.push({
p1:shuffled[i],
p2:"BYE"
})

}

}

sendBracket(message.channel)

}

/* ================= QUALIFY ================= */

if(cmd==="qual"){

if(args[0]==="bye1"){
winners.push("BYE")
return
}

let user=message.mentions.users.first()
if(!user) return

winners.push(user.id)

}

/* ================= NEXT ROUND ================= */

if(cmd==="next"){

let list=[...winners]

winners=[]
matches=[]
round++

for(let i=0;i<list.length;i+=2){

if(list[i+1]){

matches.push({
p1:list[i],
p2:list[i+1]
})

}else{

matches.push({
p1:list[i],
p2:"BYE"
})

}

}

sendBracket(message.channel)

}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

if(interaction.customId==="register"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Joined",ephemeral:true})

players.push(interaction.user.id)

updateRegister()

interaction.reply({content:"Registered",ephemeral:true})

}

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)

updateRegister()

interaction.reply({content:"Removed",ephemeral:true})

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

/* ================= UPDATE REGISTER PANEL ================= */

function updateRegister(){

if(!registerMessage) return

let disable = players.length>=maxPlayers

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji("✅")
.setStyle(ButtonStyle.Success)
.setDisabled(disable),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 ${players.length}/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setEmoji("❌")
.setStyle(ButtonStyle.Danger)

)

registerMessage.edit({components:[row]})

}

/* ================= BRACKET ================= */

function sendBracket(channel){

let embed=new EmbedBuilder()

.setTitle(`🏆 Round ${round}`)

.setImage(BRACKET_IMG)

let desc=""

matches.forEach((m,i)=>{

let p1=m.p1==="BYE"?"🤖 BYE":`<@${m.p1}>`
let p2=m.p2==="BYE"?"🤖 BYE":`<@${m.p2}>`

desc+=`Match ${i+1}\n${p1} VS ${p2}\n\n`

})

embed.setDescription(desc)

channel.send({embeds:[embed]})

}

client.login(process.env.TOKEN)
