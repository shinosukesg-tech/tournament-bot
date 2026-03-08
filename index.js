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

const WINNER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"

const TICKET_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"

/* ================= DATA ================= */

let players=[]
let matches=[]
let winners=[]
let round=1
let maxPlayers=16

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

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

if(!message.member.roles.cache.some(r=>r.name===STAFF_ROLE))
return

maxPlayers=parseInt(args[0]) || 16

players=[]
matches=[]
winners=[]
round=1

const embed = new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
Players: **0/${maxPlayers}**
Status: **OPEN**
`)

.setImage(REGISTER_IMG)

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`0/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)

)

registerMessage = await message.channel.send({
embeds:[embed],
components:[row]
})

}

/* ================= START TOURNAMENT ================= */

if(cmd==="start"){

if(!message.member.roles.cache.some(r=>r.name===STAFF_ROLE))
return

if(players.length<2)
return message.reply("Not enough players")

let shuffled=[...players].sort(()=>Math.random()-0.5)

matches=[]

for(let i=0;i<shuffled.length;i+=2){

if(shuffled[i+1])
matches.push({
p1:shuffled[i],
p2:shuffled[i+1],
winner:null
})

}

sendBracket(message.channel)

}

/* ================= SEND ROOM CODE ================= */

if(cmd==="code"){

if(!message.member.roles.cache.some(r=>r.name===STAFF_ROLE))
return

let roomCode=args[0]
let player=message.mentions.users.first()

if(!roomCode || !player)
return message.reply("Usage: ;code <roomcode> @player")

let match=matches.find(m=>m.p1==player.id || m.p2==player.id)

if(!match)
return message.reply("Match not found")

let p1=await client.users.fetch(match.p1)
let p2=await client.users.fetch(match.p2)

const embed=new EmbedBuilder()

.setTitle("🎮 Match Room Code")

.setDescription(`
Match

**${p1.username} VS ${p2.username}**

Room Code
\`\`\`
${roomCode}
\`\`\`
`)

.setColor("Blue")

try{
await p1.send({embeds:[embed]})
await p2.send({embeds:[embed]})
}catch(e){}

message.channel.send(`Code sent to **${p1.username}** and **${p2.username}**`)

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()

.setTitle("🎫 Support Panel")

.setDescription(`
🛡 Support
📋 Apply
🎁 Reward
`)

.setImage(TICKET_IMG)

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

message.channel.send({
embeds:[embed],
components:[row]
})

}

})

/* ================= BUTTON INTERACTIONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

/* REGISTER */

if(interaction.customId==="register"){

if(players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

if(players.length>=maxPlayers)
return interaction.reply({content:"Tournament full",ephemeral:true})

players.push(interaction.user.id)

let disable = players.length>=maxPlayers

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success)
.setDisabled(disable),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`${players.length}/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true)

)

await registerMessage.edit({components:[row]})

interaction.reply({content:"Registered!",ephemeral:true})

}

/* ================= QUALIFY ================= */

if(interaction.customId.startsWith("qualify")){

if(!interaction.member.roles.cache.some(r=>r.name===STAFF_ROLE))
return interaction.reply({content:"Only Tournament Staff",ephemeral:true})

let parts=interaction.customId.split("_")
let index=parseInt(parts[1])
let side=parts[2]

let match=matches[index]

let win=side==="p1"?match.p1:match.p2

match.winner=win
winners.push(win)

updateBracket(interaction.channel)

interaction.reply({content:"Winner selected",ephemeral:true})

}

/* ================= TICKET CREATE ================= */

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

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close Ticket")
.setStyle(ButtonStyle.Danger)

)

channel.send({
content:`Hello ${interaction.user}`,
components:[row]
})

interaction.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
})

}

/* ================= CLOSE TICKET ================= */

if(interaction.customId==="close_ticket"){

if(!interaction.member.roles.cache.some(r=>r.name===MOD_ROLE))
return interaction.reply({content:"Only Moderator",ephemeral:true})

interaction.channel.delete()

}

})

/* ================= BRACKET ================= */

function sendBracket(channel){

let embed=new EmbedBuilder()

.setTitle(`Round ${round}`)

let desc=""

matches.forEach((m,i)=>{

desc+=`Match ${i+1}\n<@${m.p1}> VS <@${m.p2}>\n\n`

})

embed.setDescription(desc)

let rows=[]

matches.forEach((m,i)=>{

rows.push(

new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId(`qualify_${i}_p1`)
.setLabel("Qualify P1")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId(`qualify_${i}_p2`)
.setLabel("Qualify P2")
.setStyle(ButtonStyle.Primary)

)

)

})

channel.send({embeds:[embed],components:rows})

}

function updateBracket(channel){

if(winners.length===matches.length){

if(winners.length===1){

const embed=new EmbedBuilder()

.setTitle("🏆 Champion")

.setDescription(`<@${winners[0]}> wins the tournament!`)

.setImage(WINNER_IMG)

channel.send({embeds:[embed]})

return

}

round++

let list=[...winners]

winners=[]
matches=[]

for(let i=0;i<list.length;i+=2){

if(list[i+1])
matches.push({
p1:list[i],
p2:list[i+1],
winner:null
})

}

sendBracket(channel)

}

}

client.login(process.env.TOKEN)
