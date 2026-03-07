require("dotenv").config();

/* ================= UPTIME ================= */

const express = require("express");
const app = express();
app.get("/", (req,res)=>res.send("Alive"));
app.listen(process.env.PORT || 3000);

/* ================= DISCORD ================= */

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
PermissionsBitField,
ChannelType
} = require("discord.js");

const PREFIX = ";"
const STAFF_ROLE = "Tournament Hoster"
const MOD_ROLE = "Moderator"
const SERVER_NAME = "ShinosukeSG"

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
})

/* ================= SHUFFLE IMAGES ================= */

const TOUR_IMAGES = [

"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",

"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",

"https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png",

"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"

]

function randomImage(){
return TOUR_IMAGES[Math.floor(Math.random()*TOUR_IMAGES.length)]
}

/* ================= UTIL ================= */

const isStaff = m =>
m.permissions.has(PermissionsBitField.Flags.Administrator) ||
m.roles.cache.some(r=>r.name===STAFF_ROLE)

const shuffle = arr => [...arr].sort(()=>Math.random()-0.5)

/* ================= TOURNAMENT ================= */

let tournament = null

function tournamentEmbed(){

return new EmbedBuilder()

.setColor("#ff003c")

.setTitle(`🏆 ${SERVER_NAME} Tournament`)

.setDescription(`
🎮 Mode : **1v1**
🌍 Server : **${tournament.server}**
🗺 Map : **${tournament.map}**

👥 Players : **${tournament.players.length}/${tournament.size}**
`)

.setImage(randomImage())

.setTimestamp()

}

/* ================= WELCOME ================= */

client.on("guildMemberAdd", async member=>{

const channel = member.guild.channels.cache.find(
c=>c.name.includes("welcome")
)

if(!channel) return

const created = member.user.createdAt

const days = Math.floor((Date.now()-created)/(1000*60*60*24))

const embed = new EmbedBuilder()

.setColor("#9b59ff")

.setTitle(`Welcome ${member.user.username} 👋`)

.setThumbnail(member.user.displayAvatarURL({dynamic:true,size:1024}))

.setDescription(`
Welcome **${member.user.username}** to 🏆 **${SERVER_NAME}** 🎉
Have an awesome time with us!
`)

.addFields(

{name:"🆔 User ID",value:member.id},

{name:"📅 Account Created",value:created.toDateString()},

{name:"⏳ Account Age",value:`${days} days`},

{name:"🎭 Display Name",value:member.displayName}

)

.setFooter({text:`${SERVER_NAME} • ${member.guild.memberCount} members`})

channel.send({

content:`Welcome <@${member.id}>`,

embeds:[embed]

})

})

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args = msg.content.slice(PREFIX.length).split(/ +/)
const cmd = args.shift().toLowerCase()

/* ===== TICKET PANEL ===== */

if(cmd==="ticketpanel"){

const embed = new EmbedBuilder()

.setColor("#5865F2")

.setTitle("🎫 Ticket System")

.setDescription(`
🛡 **Support** → Need help

📋 **Apply** → Staff application

🎁 **Reward** → Claim reward
`)

.setImage(randomImage())

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("support")
.setLabel("Support")
.setEmoji("🛡")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("apply")
.setLabel("Apply")
.setEmoji("📋")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward")
.setLabel("Reward")
.setEmoji("🎁")
.setStyle(ButtonStyle.Primary)

)

msg.channel.send({embeds:[embed],components:[row]})

}

/* ===== CREATE TOURNAMENT ===== */

if(cmd==="1v1"){

if(!isStaff(msg.member)) return

const size=parseInt(args[0])
const server=args[1]
const map=args[2]

tournament={
size,
server,
map,
players:[]
}

msg.channel.send({embeds:[tournamentEmbed()]})

}

/* ===== START ===== */

if(cmd==="start"){

if(!tournament) return

tournament.players = shuffle(tournament.players)

msg.channel.send("Tournament started.")

}

/* ===== ROOM CODE ===== */

if(cmd==="code"){

if(!tournament) return

const room=args[0]
const user=msg.mentions.users.first()

if(!room || !user) return

const embed=new EmbedBuilder()

.setColor("#ff003c")

.setTitle("🎮 MATCH ROOM")

.setDescription(`
🏆 ${SERVER_NAME}

ROOM CODE
\`\`\`${room}\`\`\`

🌍 ${tournament.server}
🗺 ${tournament.map}
`)

await user.send({embeds:[embed]}).catch(()=>{})

msg.channel.send("Room code sent.")

}

/* ===== DELETE ===== */

if(cmd==="del"){

tournament=null

msg.channel.send("Tournament deleted.")

}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i=>{

if(!i.isButton()) return

/* ===== CREATE TICKET ===== */

if(["support","apply","reward"].includes(i.customId)){

let name = `${i.customId}-${i.user.username}`

const channel = await i.guild.channels.create({

name:name,

type:ChannelType.GuildText,

permissionOverwrites:[

{ id:i.guild.id,deny:["ViewChannel"] },

{ id:i.user.id,allow:["ViewChannel"] },

{
id:i.guild.roles.cache.find(r=>r.name===MOD_ROLE)?.id,
allow:["ViewChannel"]
}

]

})

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()

.setCustomId("close")

.setLabel("Close Ticket")

.setStyle(ButtonStyle.Danger)

)

channel.send({

content:`Ticket opened by <@${i.user.id}>`,

components:[row]

})

i.reply({content:"Ticket created!",ephemeral:true})

}

/* ===== CLOSE ===== */

if(i.customId==="close"){

await i.reply({content:"Closing...",ephemeral:true})

setTimeout(()=>{

i.channel.delete().catch(()=>{})

},1500)

}

})

client.login(process.env.TOKEN)
