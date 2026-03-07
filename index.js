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
PermissionsBitField
} = require("discord.js");

const PREFIX=";"
const SERVER_NAME="ShinosukeSG"
const STAFF_ROLE="Tournament Hoster"
const TOUR_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
]

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
})

/* ================= UTIL ================= */

const shuffle=a=>[...a].sort(()=>Math.random()-0.5)

const isStaff=m =>
m.permissions.has(PermissionsBitField.Flags.Administrator) ||
m.roles.cache.some(r=>r.name===STAFF_ROLE)

/* ================= DATA ================= */

let tournament=null

function tourEmbed(){

return new EmbedBuilder()
.setColor("#ff003c")
.setTitle(`🏆 ${SERVER_NAME} Tournament`)
.setImage(BANNER)
.setDescription(`
🎮 Mode : **1v1**
🌍 Server : **${tournament.server}**
🗺 Map : **${tournament.map}**

👥 Players : **${tournament.players.length}/${tournament.size}**
`)
.setFooter({text:SERVER_NAME})
.setTimestamp()

}

/* ================= WELCOME ================= */

async function sendWelcome(member){

const channel=member.guild.channels.cache.find(c=>
c.name.toLowerCase().includes("welcome"))

if(!channel) return

const embed=new EmbedBuilder()

.setColor("#9b59ff")
.setTitle(`🎉 Welcome ${member.user.username}`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setDescription(`Welcome to **${SERVER_NAME}**`)
.addFields(
{name:"👤 User",value:`<@${member.id}>`},
{name:"🆔 ID",value:member.id},
{name:"📅 Account Created",value:member.user.createdAt.toDateString()}
)

channel.send({
content:`👋 Welcome <@${member.id}>`,
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

/* ===== HELP ===== */

if(cmd==="help"){

const embed=new EmbedBuilder()

.setColor("#00bfff")
.setTitle("📘 Tournament Commands")
.setDescription(`
🎮 **Tournament**
;1v1 <size> <server> <map>
;start
;qual @player
;bye
;del

🏠 **Utilities**
;welcome
;code ROOMCODE @player
`)

msg.channel.send({embeds:[embed]})

}

/* ===== WELCOME COMMAND ===== */

if(cmd==="welcome"){

let member=msg.mentions.members.first()||msg.member
sendWelcome(member)

}

/* ===== ROOM CODE ===== */

if(cmd==="code"){

const room=args[0]
const user=msg.mentions.users.first()

if(!room||!user) return msg.reply("Usage: ;code ROOM @player")

const embed=new EmbedBuilder()

.setColor("#ff003c")
.setTitle("🎮 Match Room Code")
.setDescription(`
🔑 ROOM CODE
\`\`\`
${room}
\`\`\`
🌍 Server : ${tournament?.server || "Unknown"}
🗺 Map : ${tournament?.map || "Unknown"}
`)
.setImage(BANNER)

user.send({embeds:[embed]}).catch(()=>{})

msg.channel.send("✅ Room code sent.")

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
.setStyle(ButtonStyle.Success)
.setEmoji("✅"),

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

tournament.matches=[]

for(let i=0;i<shuffled.length;i+=2){

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1]||null,
winner:null
})

}

let bracket=""

tournament.matches.forEach((m,i)=>{

bracket+=`🎮 Match ${i+1}\n<@${m.p1}> vs ${m.p2?`<@${m.p2}>`:"BYE"}\n\n`

})

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("next_round")
.setLabel("Next Round")
.setStyle(ButtonStyle.Primary)
.setEmoji("➡️")

)

msg.channel.send({
content:`📊 **Round 1 Bracket**\n\n${bracket}`,
components:[row]
})

}

/* ===== QUAL ===== */

if(cmd==="qual"){

if(!tournament) return

const user=msg.mentions.users.first()
if(!user) return

const match=tournament.matches.find(
m=>m.p1===user.id || m.p2===user.id
)

if(!match) return

match.winner=user.id

msg.channel.send(`✅ ${user.username} qualified.`)

}

/* ===== BYE ===== */

if(cmd==="bye"){

if(!tournament) return

tournament.matches.forEach(m=>{
if(!m.p2) m.winner=m.p1
})

msg.channel.send("⚡ BYE matches auto qualified.")

}

/* ===== DELETE ===== */

if(cmd==="del"){

tournament=null
msg.channel.send("🗑 Tournament deleted.")

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
.setStyle(ButtonStyle.Success)
.setEmoji("✅"),

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

/* ===== NEXT ROUND ===== */

if(i.customId==="next_round"){

const unfinished=tournament.matches.find(m=>!m.winner)

if(unfinished)
return i.reply({
content:"⚠ Finish all matches first.",
ephemeral:true
})

const winners=tournament.matches.map(m=>m.winner)

if(winners.length===1){

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("announce_winner")
.setLabel("Announce Winner")
.setStyle(ButtonStyle.Success)
.setEmoji("🏆")

)

return i.channel.send({
content:"🏁 **Final Finished**",
components:[row]
})

}

tournament.matches=[]

for(let x=0;x<winners.length;x+=2){

tournament.matches.push({
p1:winners[x],
p2:winners[x+1]||null,
winner:null
})

}

let bracket=""

tournament.matches.forEach((m,i2)=>{

bracket+=`🎮 Match ${i2+1}\n<@${m.p1}> vs ${m.p2?`<@${m.p2}>`:"BYE"}\n\n`

})

i.channel.send(`📊 **Next Round**\n\n${bracket}`)

i.reply({content:"Next round created.",ephemeral:true})

}

/* ===== ANNOUNCE WINNER ===== */

if(i.customId==="announce_winner"){

if(!tournament) return

const final=tournament.matches[0]

if(!final.winner)
return i.reply({content:"Final not decided.",ephemeral:true})

const user=await client.users.fetch(final.winner)

const embed=new EmbedBuilder()

.setColor("#FFD700")
.setTitle("🏆 TOURNAMENT WINNER")
.setThumbnail(user.displayAvatarURL({size:1024,dynamic:true}))
.setImage(BANNER)
.setDescription(`🎉 Congratulations <@${user.id}>`)

i.channel.send({embeds:[embed]})

tournament=null

}

})

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

client.login(process.env.TOKEN)

