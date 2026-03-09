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

/* ================= EMOJIS ================= */

const CHECK="<:check:1480513506871742575>"
const CROSS="<:sg_cross:1480513567655592037>"
const VS="<:VS:1477014161484677150>"
const DONE="✅"

/* ================= IMAGES ================= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png"
const TICKET_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const BRACKET_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"

/* ================= DATA ================= */

let players=[]
let matches=[]
let winners=[]
let completedMatches=[]
let round=1
let maxPlayers=16

let serverName="Unknown"
let mapName="Unknown"
let prizeName="Unknown"

let registerMessage=null
let bracketMessage=null

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

const days=Math.floor((Date.now()-member.user.createdTimestamp)/86400000)

const embed=new EmbedBuilder()

.setColor("Purple")
.setAuthor({name:`Welcome ${member.user.username}`})
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))

.setDescription(`
👋 Welcome **${member.user.username}**

🏆 **${member.guild.name}**

🆔 **User ID**
${member.id}

📅 **Account Created**
${new Date(member.user.createdTimestamp).toDateString()}

⏳ **Account Age**
${days} days

🎭 **Display Name**
${member.displayName}
`)

channel.send({content:`Welcome ${member}`,embeds:[embed]})

})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

message.delete().catch(()=>{})

/* ================= WELCOME SET ================= */

if(cmd==="welcome"){

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return

let channel=message.mentions.channels.first()
if(!channel) return

welcomeData[message.guild.id]=channel.id
saveWelcome()

message.channel.send({embeds:[
new EmbedBuilder().setColor("Green").setDescription("✅ Welcome channel set")
]})

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()

.setTitle("🎫 Ticket System")

.setDescription(`
🛡 **Support** → Need help
📋 **Apply** → Staff application
🎁 **Reward** → Claim reward
`)

.setImage(TICKET_IMG)

const row=new ActionRowBuilder().addComponents(

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

message.channel.send({embeds:[embed],components:[row]})

}

/* ================= TOURNAMENT CREATE ================= */

if(cmd==="1v1"){

if(!message.member.roles.cache.find(r=>r.name===STAFF_ROLE)) return

maxPlayers=parseInt(args[0])||16
serverName=args[1]||"Unknown"
mapName=args[2]||"Unknown"
prizeName=args[3]||"Unknown"

players=[]
matches=[]
winners=[]
completedMatches=[]
round=1

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")

.setDescription(`
🌍 Server: ${serverName}
🗺 Map: ${mapName}
🎁 Reward: ${prizeName}

👤 Players: 0/${maxPlayers}
Hosted by **${STAFF_ROLE}**
`)

.setImage(REGISTER_IMG)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji(CHECK)
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 0/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setEmoji(CROSS)
.setStyle(ButtonStyle.Danger)

)

registerMessage=await message.channel.send({embeds:[embed],components:[row]})

}

/* ================= START ================= */

if(cmd==="start"){

if(players.length<2) return message.channel.send("Not enough players")

let shuffled=[...players].sort(()=>Math.random()-0.5)

matches=[]
completedMatches=[]

for(let i=0;i<shuffled.length;i+=2){

if(shuffled[i+1]){
matches.push({p1:shuffled[i],p2:shuffled[i+1]})
}else{
matches.push({p1:shuffled[i],p2:"BYE"})
}

}

sendBracket(message.channel)

}

/* ================= QUAL ================= */

if(cmd==="qual"){

let user=message.mentions.users.first()
if(!user) return

let matchIndex = matches.findIndex(m=>m.p1==user.id||m.p2==user.id)
if(matchIndex===-1) return

if(!completedMatches.includes(matchIndex)){
completedMatches.push(matchIndex)
}

winners.push(user.id)

sendBracket(message.channel)

}

/* ================= NEXT ================= */

if(cmd==="next"){

if(winners.length<=1){

let win=await client.users.fetch(winners[0])

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Winner")
.setThumbnail(win.displayAvatarURL({dynamic:true}))
.setDescription(`🎉 Winner: **${win.username}**`)

message.channel.send({embeds:[embed]})
return
}

let list=[...winners]

winners=[]
matches=[]
completedMatches=[]
round++

for(let i=0;i<list.length;i+=2){

if(list[i+1]){
matches.push({p1:list[i],p2:list[i+1]})
}else{
matches.push({p1:list[i],p2:"BYE"})
}

}

sendBracket(message.channel)

}

/* ================= CODE ================= */

if(cmd==="code"){

let code=args[0]
let user=message.mentions.users.first()
if(!code||!user) return

let match=matches.find(m=>m.p1==user.id||m.p2==user.id)
if(!match) return

let p1=await client.users.fetch(match.p1)
let p2=match.p2==="BYE"?null:await client.users.fetch(match.p2)

const embed=new EmbedBuilder()

.setTitle("🎮 Match Room Code")

.setDescription(`
${p1.username} ${VS} ${p2?.username||"BYE"}

Room Code
\`\`\`
${code}
\`\`\`
`)

.setImage(BRACKET_IMG)

p1.send({embeds:[embed]}).catch(()=>{})
if(p2) p2.send({embeds:[embed]}).catch(()=>{})

}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return

if(interaction.customId==="register"){

if(players.includes(interaction.user.id)) return

players.push(interaction.user.id)
updateRegister()

interaction.reply({content:"Registered",ephemeral:true})

}

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)
updateRegister()

interaction.reply({content:"Removed",ephemeral:true})

}

})

/* ================= UPDATE PANEL ================= */

function updateRegister(){

if(!registerMessage) return

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setEmoji(CHECK)
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("count")
.setLabel(`👤 ${players.length}/${maxPlayers}`)
.setStyle(ButtonStyle.Secondary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setEmoji(CROSS)
.setStyle(ButtonStyle.Danger)

)

registerMessage.edit({components:[row]}).catch(()=>{})

}

/* ================= BRACKET ================= */

async function sendBracket(channel){

let desc=""

for(let i=0;i<matches.length;i++){

let p1=matches[i].p1==="BYE"?"BYE":(await client.users.fetch(matches[i].p1)).username
let p2=matches[i].p2==="BYE"?"BYE":(await client.users.fetch(matches[i].p2)).username

let tick = completedMatches.includes(i) ? ` ${DONE}` : ""

desc+=`**Match ${i+1}${tick}**\n${p1} ${VS} ${p2}\n\n`

}

const embed=new EmbedBuilder()

.setTitle(`🏆 Round ${round}`)
.setDescription(desc)
.setImage(BRACKET_IMG)

if(!bracketMessage){
bracketMessage=await channel.send({embeds:[embed]})
}else{
bracketMessage.edit({embeds:[embed]}).catch(()=>{})
}

}

client.login(process.env.TOKEN)
