require("dotenv").config()

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
PermissionFlagsBits
}=require("discord.js")

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]})

const PREFIX=";"
const SERVER_NAME="ShinosukeSG"

/* ================= IMAGES ================= */

const TOUR_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
]

function getImage(){
return TOUR_IMAGES[Math.floor(Math.random()*TOUR_IMAGES.length)]
}

/* ================= DATA ================= */

let tournament=null

/* ================= WELCOME FUNCTION ================= */

async function sendWelcome(member){

const channel = member.guild.channels.cache.find(c=>c.name.includes("welcome"))
if(!channel) return

const embed=new EmbedBuilder()
.setColor("#a855f7")
.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setDescription(`Welcome **${member.user.username}** to 🏆 **${SERVER_NAME}** 🎉`)
.addFields(
{name:"🆔 User ID",value:member.id},
{name:"📅 Account Created",value:`${member.user.createdAt.toDateString()}`},
{name:"🎭 Display Name",value:`${member.displayName}`}
)

channel.send({embeds:[embed]})

}

/* AUTO WELCOME */

client.on("guildMemberAdd",sendWelcome)

/* ================= COMMANDS ================= */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).trim().split(/ +/)
const cmd=args.shift().toLowerCase()

/* ===== HELP ===== */

if(cmd==="help"){

const embed=new EmbedBuilder()
.setColor("Blue")
.setTitle("Bot Commands")
.setDescription(`
🎮 Tournament
;1v1 <size> <server> <map>
;start

🎟 Tickets
;ticketpanel

👋 Welcome
;welcome
`)

msg.channel.send({embeds:[embed]})

}

/* ===== WELCOME COMMAND ===== */

if(cmd==="welcome"){

const member=msg.mentions.members.first()||msg.member
sendWelcome(member)

}

/* ===== TICKET PANEL ===== */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()
.setColor("#5865F2")
.setTitle("🎫 Ticket System")
.setDescription(`
Select an option below:

🛡 **Support →** Need help or have a question  
📋 **Apply →** Apply to become staff  
🎁 **Reward →** Claim your reward
`)
.setImage("https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png")

const row=new ActionRowBuilder().addComponents(

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

msg.channel.send({embeds:[embed],components:[row]})

}

/* ===== CREATE TOURNAMENT ===== */

if(cmd==="1v1"){

const size=parseInt(args[0])
const server=args[1]
const map=args[2]

tournament={
size:size,
server:server,
map:map,
players:[]
}

const embed=new EmbedBuilder()
.setColor("Red")
.setTitle(`🏆 ${SERVER_NAME} Tournament`)
.setDescription(`
🎮 Mode : 1v1
🌍 Server : ${server}
🗺 Map : ${map}

👥 Players : 0/${size}
`)
.setImage(getImage())

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel("Players 0/"+size)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)

)

msg.channel.send({embeds:[embed],components:[row]})

}

/* ===== START ===== */

if(cmd==="start"){

if(!tournament){
msg.reply("No tournament running")
return
}

if(tournament.players.length<2){
msg.reply("Not enough players")
return
}

let shuffled=[...tournament.players].sort(()=>Math.random()-0.5)

let bracket=""

for(let i=0;i<shuffled.length;i+=2){

let p1=shuffled[i]
let p2=shuffled[i+1]||"BYE"

bracket+=`Match ${i/2+1}\n<@${p1}> vs ${p2==="BYE"?"BYE":`<@${p2}>`}\n\n`

}

msg.channel.send(`🏆 **Tournament Bracket**\n\n${bracket}`)

}

})

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate",async i=>{

if(!i.isButton()) return

/* ===== REGISTER ===== */

if(i.customId==="register"){

if(!tournament)
return i.reply({content:"No tournament running",ephemeral:true})

if(tournament.players.includes(i.user.id))
return i.reply({content:"Already registered",ephemeral:true})

tournament.players.push(i.user.id)

const embed=new EmbedBuilder()
.setColor("Red")
.setTitle(`🏆 ${SERVER_NAME} Tournament`)
.setDescription(`
🎮 Mode : 1v1
🌍 Server : ${tournament.server}
🗺 Map : ${tournament.map}

👥 Players : ${tournament.players.length}/${tournament.size}
`)
.setImage(getImage())

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`Players ${tournament.players.length}/${tournament.size}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)

)

i.update({embeds:[embed],components:[row]})

}

/* ===== TICKET BUTTONS ===== */

if(i.customId.endsWith("_ticket")){

let type=i.customId.split("_")[0]

const channel=await i.guild.channels.create({
name:`${type}_${i.user.username}`,
permissionOverwrites:[
{
id:i.guild.id,
deny:[PermissionFlagsBits.ViewChannel]
},
{
id:i.user.id,
allow:[PermissionFlagsBits.ViewChannel]
}
]
})

i.reply({content:`Ticket created: ${channel}`,ephemeral:true})

}

})

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

client.login(process.env.TOKEN)
