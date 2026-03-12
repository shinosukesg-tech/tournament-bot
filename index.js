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

let tournament=loadJSON("./tournament.json",{
players:[],
matches:[],
qualified:[],
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

/* WELCOME */

client.on("guildMemberAdd",member=>{

const channel=member.guild.channels.cache.get(WELCOME_CHANNEL)
if(!channel) return

const embed=new EmbedBuilder()

.setColor("#a855f7")
.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL())

.setDescription(`
Welcome **${member.user.username}** to **${member.guild.name}**

🆔 **User ID**
${member.id}

📅 **Account Created**
<t:${Math.floor(member.user.createdTimestamp/1000)}:D>

⏳ **Account Age**
${Math.floor((Date.now()-member.user.createdTimestamp)/86400000)} days

🎭 **Display Name**
${member.displayName}
`)

channel.send({
content:`Welcome ${member}`,
embeds:[embed]
})

})

/* TOURNAMENT REGISTER PANEL */

async function sendRegister(channel){

const embed=new EmbedBuilder()

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

async function updatePanel(channel){

if(!tournament.messageId) return

let msg=await channel.messages.fetch(tournament.messageId).catch(()=>null)
if(!msg) return

const embed=new EmbedBuilder()

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

msg.edit({embeds:[embed]})

}

/* BUTTON INTERACTIONS */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return

/* REGISTER */

if(interaction.customId==="register"){

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

if(tournament.players.length>=tournament.max)
return interaction.reply({content:"Tournament full",ephemeral:true})

tournament.players.push(interaction.user.id)

saveJSON("./tournament.json",tournament)

updatePanel(interaction.channel)

interaction.reply({content:"Registered",ephemeral:true})

/* AUTO START WHEN FULL */

if(tournament.players.length===tournament.max){

interaction.channel.send("🏁 Tournament Full! Creating Matches...")

createBracket(interaction.channel)

}

}

if(tournament.players.includes(interaction.user.id))
return interaction.reply({content:"Already registered",ephemeral:true})

tournament.players.push(interaction.user.id)

saveJSON("./tournament.json",tournament)

updatePanel(interaction.channel)

interaction.reply({content:"Registered",ephemeral:true})

}

/* UNREGISTER */

if(interaction.customId==="unregister"){

tournament.players=tournament.players.filter(x=>x!==interaction.user.id)

saveJSON("./tournament.json",tournament)

updatePanel(interaction.channel)

interaction.reply({content:"Unregistered",ephemeral:true})

}

/* PARTICIPANTS */

if(interaction.customId==="participants"){

let list=""

for(let id of tournament.players){

let u=await client.users.fetch(id)
list+=`${u.username}\n`

}

interaction.reply({
content:`Participants\n\n${list||"None"}`,
ephemeral:true
})

}

/* SUPPORT TICKET */

if(interaction.customId==="support"){

let channel=await interaction.guild.channels.create({

name:`ticket-${interaction.user.username}`,
type:ChannelType.GuildText,
parent:TICKET_CATEGORY,

permissionOverwrites:[

{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},

{
id:interaction.user.id,
allow:[PermissionsBitField.Flags.ViewChannel]
},

{
id:MOD_ROLE,
allow:[PermissionsBitField.Flags.ViewChannel]
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
content:`🎫 Ticket opened by ${interaction.user}`,
components:[row]
})

interaction.reply({content:`Ticket created ${channel}`,ephemeral:true})

}

/* CLOSE TICKET */

if(interaction.customId==="close_ticket"){

if(!interaction.member.roles.cache.has(MOD_ROLE))
return interaction.reply({content:"Moderator only",ephemeral:true})

interaction.channel.delete()

}

})

/* COMMANDS */

client.on("messageCreate",async msg=>{

if(msg.author.bot) return
if(!msg.content.startsWith(PREFIX)) return

const args=msg.content.slice(PREFIX.length).split(" ")
const cmd=args.shift().toLowerCase()

/* START TOURNAMENT */

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

/* TICKET PANEL */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()

.setTitle("🎟 Ticket System")

.setDescription(`
Select an option below:

🛡 **Support** → Need help
📋 **Apply** → Apply for staff
🎁 **Reward** → Claim reward
`)

.setImage("https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png?ex=69b3a1c4&is=69b25044&hm=dcface5427862d440922451a6a5ccce6c18fc81cb80e7de7519176b3ee2bf7ea&")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("support")
.setLabel("Support")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("apply")
.setLabel("Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward")
.setLabel("Reward")
.setStyle(ButtonStyle.Primary)

)

msg.channel.send({
embeds:[embed],
components:[row]
})

}

})

client.login(process.env.TOKEN)

