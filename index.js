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

const PREFIX=";"
const STAFF_ROLE="Tournament Hoster"
const MOD_ROLE="Moderator"
const SERVER_NAME="ShinosukeSG"

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
})

/* ================= IMAGES ================= */

const TOUR_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
]

function randomImage(){
return TOUR_IMAGES[Math.floor(Math.random()*TOUR_IMAGES.length)]
}

/* ================= UTIL ================= */

const isStaff=m=>
m.permissions.has(PermissionsBitField.Flags.Administrator) ||
m.roles.cache.some(r=>r.name===STAFF_ROLE)

const shuffle=a=>[...a].sort(()=>Math.random()-0.5)

/* ================= TOURNAMENT ================= */

let tournament=null

function tourEmbed(){

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

/* ================= WELCOME SYSTEM ================= */

async function sendWelcome(member){

const channel=member.guild.channels.cache.find(c=>c.name.includes("welcome"))
if(!channel) return

const created=member.user.createdAt
const days=Math.floor((Date.now()-created)/(1000*60*60*24))

const embed=new EmbedBuilder()

.setColor("#9b59ff")
.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true,size:1024}))
.setDescription(`
Welcome **${member.user.username}** to 🏆 **${SERVER_NAME}**
Have fun here!
`)
.addFields(
{name:"🆔 User ID",value:member.id},
{name:"📅 Account Created",value:created.toDateString()},
{name:"⏳ Account Age",value:`${days} days`},
{name:"🎭 Display Name",value:member.displayName}
)

channel.send({
content:`Welcome <@${member.id}>`,
embeds:[embed]
})

}

client.on("guildMemberAdd",sendWelcome)

/* ================= COMMANDS ================= */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).split(/ +/)
const cmd=args.shift().toLowerCase()

/* ===== FORCE WELCOME COMMAND ===== */

if(cmd==="welcome"){

const user=msg.mentions.members.first()||msg.member
sendWelcome(user)

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
players:[],
matches:[]
}

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji("🎮")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("playercount")
.setLabel(`Players 0/${size}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)

)

msg.channel.send({
embeds:[tourEmbed()],
components:[row]
})

}

/* ===== START ===== */

if(cmd==="start"){

if(!tournament) return

const shuffled=shuffle(tournament.players)

for(let i=0;i<shuffled.length;i+=2){

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1],
winner:null
})

}

msg.channel.send("Bracket started.")

}

/* ===== QUAL ===== */

if(cmd==="qual"){

const user=msg.mentions.users.first()
if(!user) return

const match=tournament.matches.find(
m=>m.p1===user.id || m.p2===user.id
)

if(!match) return

match.winner=user.id

msg.channel.send(`${user.username} qualified.`)

}

/* ===== ROOM CODE ===== */

if(cmd==="code"){

const room=args[0]
const user=msg.mentions.users.first()
if(!room||!user) return

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

user.send({embeds:[embed]}).catch(()=>{})

msg.channel.send("Room code sent.")

}

/* ===== DELETE ===== */

if(cmd==="del"){

tournament=null
msg.channel.send("Tournament deleted.")

}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate",async i=>{

if(!i.isButton()) return

/* ===== REGISTER ===== */

if(i.customId==="register"){

if(!tournament)
return i.reply({content:"No tournament.",ephemeral:true})

if(tournament.players.includes(i.user.id))
return i.reply({content:"Already registered.",ephemeral:true})

if(tournament.players.length>=tournament.size)
return i.reply({content:"Tournament full.",ephemeral:true})

tournament.players.push(i.user.id)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji("🎮")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("playercount")
.setLabel(`Players ${tournament.players.length}/${tournament.size}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)

)

await i.update({
embeds:[tourEmbed()],
components:[row]
})

}

/* ===== ANNOUNCE WINNER BUTTON ===== */

if(i.customId==="announce_winner"){

if(!tournament) return

const winner=tournament.matches[0]?.winner
if(!winner) return

const user=await client.users.fetch(winner)

const embed=new EmbedBuilder()

.setColor("#FFD700")
.setTitle("🏆 TOURNAMENT WINNER")
.setThumbnail(user.displayAvatarURL({dynamic:true,size:1024}))
.setDescription(`Congratulations <@${winner}>`)
.setImage(randomImage())

i.channel.send({embeds:[embed]})

tournament=null

}

})

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Bot ready as ${client.user.tag}`)
})

client.login(process.env.TOKEN)
