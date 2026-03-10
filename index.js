require("dotenv").config()

/* ========= EXPRESS ========= */

const express=require("express")
const app=express()

app.get("/",(req,res)=>res.send("Bot Running"))
app.listen(process.env.PORT||3000)

/* ========= DISCORD ========= */

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
PermissionsBitField,
ChannelType,
REST,
Routes
}=require("discord.js")

const fs=require("fs")

/* ========= FILES ========= */

const commands=require("./commands.json")

function loadJSON(file,def){
try{return JSON.parse(fs.readFileSync(file))}
catch{return def}
}

function saveJSON(file,data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

let tournament=loadJSON("./tournament.json",{
players:[],
matches:[],
qualified:[],
round:1,
max:0,
server:"",
map:"",
rewards:[]
})

let welcome=loadJSON("./welcome.json",{})

/* ========= CLIENT ========= */

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

const PREFIX="!"

/* ========= IDS ========= */

const WELCOME_CHANNEL="1465234114318696498"
const MOD_ROLE="1429913618211672125"

/* ========= EMOJIS ========= */

const CHECK="<:check:1480513506871742575>"
const CROSS="<:sg_cross:1480513567655592037>"
const VS="<:VS:1477014161484677150>"

/* ========= IMAGES ========= */

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480914400314392627/Screenshot_20260310_183459_Discord.jpg"

/* ========= FOOTER ========= */

function footer(embed,guild){
const time=new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata"})
embed.setFooter({
text:`Enjoy The Fun | ${guild.name} | ${time}`,
iconURL:FOOTER_IMG
})
}

/* ========= READY ========= */

client.once("ready",async()=>{

console.log(`Logged in as ${client.user.tag}`)

try{

const rest=new REST({version:"10"}).setToken(process.env.TOKEN)

await rest.put(
Routes.applicationCommands(client.user.id),
{body:commands.commands}
)

console.log("Slash commands loaded")

}catch(e){
console.log(e)
}

})

/* ========= WELCOME ========= */

client.on("guildMemberAdd",member=>{

let ch=member.guild.channels.cache.get(WELCOME_CHANNEL)
if(!ch) return

const embed=new EmbedBuilder()

.setTitle(`Welcome ${member.user.username}`)
.setThumbnail(member.user.displayAvatarURL())

.setDescription(`
Welcome to **${member.guild.name}**

User ID: ${member.id}
Account Created: ${member.user.createdAt.toDateString()}
`)

footer(embed,member.guild)

ch.send({embeds:[embed]})

})

/* ========= REGISTER PANEL ========= */

function sendRegister(channel){

let embed=new EmbedBuilder()

.setTitle("Tournament Registration")

.setImage(REGISTER_IMG)

.setDescription(`
Server: **${tournament.server}**
Map: **${tournament.map}**

Players **${tournament.players.length}/${tournament.max}**

Rewards
🥇 ${tournament.rewards[0]}
🥈 ${tournament.rewards[1]}
🥉 ${tournament.rewards[2]}
`)

footer(embed,channel.guild)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success)
.setDisabled(tournament.players.length>=tournament.max),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("participants")
.setLabel("Participants")
.setStyle(ButtonStyle.Secondary)

)

channel.send({embeds:[embed],components:[row]})

}

/* ========= BUTTONS ========= */

client.on("interactionCreate",async i=>{

if(!i.isButton()) return

/* REGISTER */

if(i.customId==="register"){

if(tournament.players.includes(i.user.id))
return i.reply({content:"Already registered",ephemeral:true})

if(tournament.players.length>=tournament.max)
return i.reply({content:"Tournament full",ephemeral:true})

tournament.players.push(i.user.id)

saveJSON("./tournament.json",tournament)

return i.reply({content:`${CHECK} Registered`,ephemeral:true})

}

/* UNREGISTER */

if(i.customId==="unregister"){

tournament.players=tournament.players.filter(x=>x!==i.user.id)

saveJSON("./tournament.json",tournament)

return i.reply({content:`${CROSS} Unregistered`,ephemeral:true})

}

/* PARTICIPANTS */

if(i.customId==="participants"){

let list=tournament.players.map(x=>`<@${x}>`).join("\n")

if(!list) list="No players"

return i.reply({
content:`Participants\n${list}`,
ephemeral:true
})

}

})

/* ========= PREFIX COMMANDS ========= */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).split(" ")
const cmd=args.shift().toLowerCase()

/* CREATE TOUR */

if(cmd==="tour"){

tournament.max=args[0]
tournament.server=args[1]
tournament.map=args[2]
tournament.rewards=[args[3],args[4],args[5]]

tournament.players=[]
tournament.round=1
tournament.matches=[]
tournament.qualified=[]

saveJSON("./tournament.json",tournament)

sendRegister(msg.channel)

}

/* HELP */

if(cmd==="helpm"){

const embed=new EmbedBuilder()

.setTitle("Tournament Bot Help")

.setDescription(`
!tour <players> <server> <map> <r1> <r2> <r3>
!start
!qual @player
!code <roomcode> @p1 @p2
!next
`)

.setImage(BRACKET_IMG)

footer(embed,msg.guild)

msg.channel.send({embeds:[embed]})

}

/* START */

if(cmd==="start"){

let arr=[...tournament.players].sort(()=>Math.random()-0.5)

tournament.matches=[]

for(let i=0;i<arr.length;i+=2){

tournament.matches.push({
p1:arr[i],
p2:arr[i+1]
})

}

saveJSON("./tournament.json",tournament)

sendBracket(msg.channel)

}

/* QUAL */

if(cmd==="qual"){

let user=msg.mentions.users.first()
if(!user) return

tournament.qualified.push(user.id)

saveJSON("./tournament.json",tournament)

msg.reply(`${user.username} qualified`)

}

/* CODE */

if(cmd==="code"){

let code=args[0]
let p1=msg.mentions.users.first()
let p2=msg.mentions.users.last()

const embed=new EmbedBuilder()

.setTitle("Match Code")

.setDescription(`
${p1} ${VS} ${p2}

Room Code
\`\`\`
${code}
\`\`\`
`)

footer(embed,msg.guild)

msg.channel.send({embeds:[embed]})

}

})

/* ========= BRACKET ========= */

function sendBracket(channel){

let text=""

tournament.matches.forEach((m,i)=>{

text+=`Match ${i+1}
<@${m.p1}> ${VS} <@${m.p2}>

`

})

const embed=new EmbedBuilder()

.setTitle(`Round ${tournament.round}`)
.setImage(BRACKET_IMG)
.setDescription(text)

footer(embed,channel.guild)

channel.send({embeds:[embed]})

}

/* ========= LOGIN ========= */

client.login(process.env.TOKEN)
