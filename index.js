require("dotenv").config()

const express=require("express")
const app=express()

app.get("/",(req,res)=>res.send("Bot Running"))
app.listen(process.env.PORT||3000)

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
PermissionsBitField,
ChannelType
}=require("discord.js")

const fs=require("fs")

function loadJSON(file,def){
try{return JSON.parse(fs.readFileSync(file))}
catch{return def}
}

function saveJSON(file,data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

function getIST(){
return new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})
}

let tournament=loadJSON("./tournament.json",{
players:[],
matches:[],
qualified:[],
codes:{},
round:1,
max:0,
server:"",
map:"",
rewards:[],
messageId:null,
bracketMessageId:null
})

let commands=loadJSON("./commands.json",{prefix:"!"})
const PREFIX=commands.prefix||"!"

const VS="<:VS:1477014161484677150>"
const CHECK="<:check:1480513506871742575>"

const REGISTER_IMG="https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"

const FOOTER_ICON="https://cdn.discordapp.com/attachments/1471952333209604239/1480914400314392627/Screenshot_20260310_183459_Discord.jpg"

const WELCOME_CHANNEL="1465234114318696498"
const TICKET_CATEGORY="1480854630035357776"
const MOD_ROLE="1429913618211672125"
const HOSTER="1476446112675004640"

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
})

client.once("ready",()=>{
console.log(`Logged as ${client.user.tag}`)
})

function addFooter(embed){
embed.setFooter({
text:`Enjoy The Fun | ShinosukeSG | ${getIST()}`,
iconURL:FOOTER_ICON
})
return embed
}

/* WELCOME */

client.on("guildMemberAdd",member=>{

const channel=member.guild.channels.cache.get(WELCOME_CHANNEL)
if(!channel) return

const embed=addFooter(
new EmbedBuilder()
.setColor("#a855f7")
.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL())
.setDescription(`Welcome **${member.user.username}** to **${member.guild.name}**`)
)

channel.send({content:`Welcome ${member}`,embeds:[embed]})

})

/* REGISTER PANEL */

async function sendRegister(channel){

const embed=addFooter(
new EmbedBuilder()
.setTitle("🏆 ShinTours Tournament")
.setImage(REGISTER_IMG)
.setDescription(`
🌐 **Server:** ${tournament.server}
🗺 **Map:** ${tournament.map}

👥 **Players:** ${tournament.players.length}/${tournament.max}

🎁 **Rewards**

🥇 ${tournament.rewards[0]}
🥈 ${tournament.rewards[1]}
🥉 ${tournament.rewards[2]}
`)
)

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("participants")
.setLabel("Participants")
.setStyle(ButtonStyle.Secondary)

)

let msg=await channel.send({embeds:[embed],components:[row]})

tournament.messageId=msg.id
saveJSON("./tournament.json",tournament)

}

async function createBracket(channel){

let shuffled=[...tournament.players].sort(()=>Math.random()-0.5)

tournament.matches=[]
tournament.qualified=[]
tournament.codes={}

for(let i=0;i<shuffled.length;i+=2){

if(!shuffled[i+1]) continue

tournament.matches.push({
p1:shuffled[i],
p2:shuffled[i+1]
})

}

saveJSON("./tournament.json",tournament)

sendBracket(channel)

}

async function sendBracket(channel){

let text=""

for(const [i,m] of tournament.matches.entries()){

let p1=(await client.users.fetch(m.p1)).username
let p2=(await client.users.fetch(m.p2)).username

let code=tournament.codes[i+1]||"Not Set"

text+=`Match ${i+1}
${p1} ${VS} ${p2}
Room: ${code}

`

}

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("next_round")
.setLabel("Next Round")
.setStyle(ButtonStyle.Primary)
)

const embed=addFooter(
new EmbedBuilder()
.setTitle(`Round ${tournament.round}`)
.setImage(BRACKET_IMG)
.setDescription(text)
)

let msg=await channel.send({embeds:[embed],components:[row]})

tournament.bracketMessageId=msg.id
saveJSON("./tournament.json",tournament)

}

/* BUTTONS */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return

if(interaction.customId==="register"){

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

if(tournament.players.length>=tournament.max)
return interaction.reply({content:"Tournament full",ephemeral:true})

tournament.players.push(interaction.user.id)

saveJSON("./tournament.json",tournament)

interaction.reply({content:"Registered",ephemeral:true})

if(tournament.players.length===tournament.max){

interaction.channel.send("🏁 Tournament Full! Creating Matches...")

createBracket(interaction.channel)

}

}

if(interaction.customId==="participants"){

let list=""

for(let id of tournament.players){
let u=await client.users.fetch(id)
list+=`${u.username}\n`
}

interaction.reply({
content:list||"None",
ephemeral:true
})

}

if(interaction.customId==="next_round"){

if(!interaction.member.roles.cache.has(MOD_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

if(tournament.round>=Math.log2(tournament.max)){

let winnerId=tournament.qualified[0]
let winner=await client.users.fetch(winnerId)

const embed=addFooter(
new EmbedBuilder()
.setTitle("🏆 Tournament Winner")
.setThumbnail(winner.displayAvatarURL({size:512}))
.setDescription(`
🥇 **${winner.username}**

🥈 ${tournament.rewards[1]}
🥉 ${tournament.rewards[2]}
`)
)

interaction.channel.send({embeds:[embed]})
return
}

tournament.players=[...tournament.qualified]
tournament.qualified=[]
tournament.round++

saveJSON("./tournament.json",tournament)

createBracket(interaction.channel)

}

})

/* COMMANDS */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).split(" ")
const cmd=args.shift().toLowerCase()

if(cmd==="tour"){

tournament.max=parseInt(args[0])
tournament.server=args[1]
tournament.map=args[2]
tournament.rewards=[args[3],args[4],args[5]]

tournament.players=[]
tournament.matches=[]
tournament.qualified=[]
tournament.round=1

saveJSON("./tournament.json",tournament)

sendRegister(msg.channel)

}

/* ROOM CODE */

if(cmd==="code"){

if(!msg.member.roles.cache.has(MOD_ROLE)) return

let match=parseInt(args[0])
let code=args[1]

tournament.codes[match]=code

saveJSON("./tournament.json",tournament)

msg.channel.send(`Room code set for Match ${match}`)

}

/* QUALIFY */

if(cmd==="qual"){

if(!msg.member.roles.cache.has(MOD_ROLE)) return

let user=msg.mentions.users.first()

if(!user) return msg.reply("Mention player")

tournament.qualified.push(user.id)

saveJSON("./tournament.json",tournament)

msg.channel.send(`${CHECK} ${user.username} qualified`)

}

})

client.login(process.env.TOKEN)
