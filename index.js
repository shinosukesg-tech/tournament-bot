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
} = require("discord.js");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]
});

const PREFIX=";"

/* ================= IMAGES ================= */

const REGISTER_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png?ex=69ad0a47&is=69abb8c7&hm=219288b707fdc90691a78a932f01de2892abaa70e4db792ebd5cfb04a1827374&18396785ebd99f754ec21be72929366d8ec9b6c53bff6b111f5e0e30c16f3f&c0079032ccc4693d52f0c8d0480a1fc0f9c40dd70e7d882&"
]

const BRACKET_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

const WINNER_IMAGES=[
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
]

const TICKET_IMAGE="https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"

function random(arr){
return arr[Math.floor(Math.random()*arr.length)]
}

/* ================= DATA ================= */

let players=[]
let bracket=[]
let winners=[]
let registerMessage=null

/* ================= READY ================= */

client.on("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= WELCOME ================= */

client.on("guildMemberAdd",member=>{

const channel=member.guild.channels.cache.find(c=>c.name.includes("welcome"))
if(!channel) return

const created=`<t:${Math.floor(member.user.createdTimestamp/1000)}:D>`
const age=Math.floor((Date.now()-member.user.createdTimestamp)/86400000)

const embed=new EmbedBuilder()
.setTitle(`Welcome\n${member.user.username}`)
.setDescription(`👋

Welcome **${member.user.username}** to
🏆 **${member.guild.name}**
Have fun here!

🆔 **User ID**
${member.id}

📅 **Account Created**
${created}

⏳ **Account Age**
${age} days

🎭 **Display Name**
${member.displayName}`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setColor("Purple")

channel.send({content:`Welcome ${member}`,embeds:[embed]})

})

/* ================= COMMANDS ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

setTimeout(()=>{message.delete().catch(()=>{})},2000)

const args=message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd=args.shift().toLowerCase()

/* ================= CREATE TOURNAMENT ================= */

if(cmd==="1v1"){

players=[]
bracket=[]
winners=[]

const embed=new EmbedBuilder()
.setTitle("🏆 Tournament")
.setDescription(`🎮 Mode: 1v1
👥 Players: **0**
Status: **OPEN**`)
.setImage(random(REGISTER_IMAGES))
.setColor("Red")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("unregister")
.setLabel("Unregister")
.setStyle(ButtonStyle.Danger)

)

registerMessage = await message.channel.send({embeds:[embed],components:[row]})

}

/* ================= QUALIFY ================= */

if(cmd==="qual"){

const user=message.mentions.users.first()
if(!user) return

players.push(user.id)

updatePlayerCount()

}

/* ================= START ================= */

if(cmd==="start"){

players.sort(()=>Math.random()-0.5)

for(let i=0;i<players.length;i+=2){
bracket.push([players[i],players[i+1]])
}

let desc=""

for(const match of bracket){

let p1=await client.users.fetch(match[0])
let p2=await client.users.fetch(match[1])

desc+=`**${p1.username}** VS **${p2.username}**\n`
}

const embed=new EmbedBuilder()
.setTitle("🏆 Tournament Bracket")
.setDescription(desc)
.setImage(random(BRACKET_IMAGES))
.setColor("Blue")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("next_round")
.setLabel("Next Round")
.setStyle(ButtonStyle.Primary)

)

message.channel.send({embeds:[embed],components:[row]})

}

/* ================= TICKET PANEL ================= */

if(cmd==="ticketpanel"){

const embed=new EmbedBuilder()
.setTitle("🎫 Ticket System")
.setDescription(`Select an option below:

🛡 **Support** → Need help or have a question
📋 **Apply** → Apply to become staff
🎁 **Reward** → Claim your reward`)
.setImage(TICKET_IMAGE)
.setColor("Blue")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("support_ticket")
.setLabel("🛡 Support")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("apply_ticket")
.setLabel("📋 Apply")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("reward_ticket")
.setLabel("🎁 Reward")
.setStyle(ButtonStyle.Primary)

)

message.channel.send({embeds:[embed],components:[row]})

}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return

/* REGISTER */

if(interaction.customId==="register"){

players.push(interaction.user.id)
updatePlayerCount()

interaction.reply({content:"Registered!",ephemeral:true})

}

/* UNREGISTER */

if(interaction.customId==="unregister"){

players=players.filter(p=>p!==interaction.user.id)
updatePlayerCount()

interaction.reply({content:"Unregistered.",ephemeral:true})

}

/* NEXT ROUND */

if(interaction.customId==="next_round"){

winners=[]

for(const match of bracket){
winners.push(match[0])
}

bracket=[]

for(let i=0;i<winners.length;i+=2){
bracket.push([winners[i],winners[i+1]])
}

if(bracket.length===1){

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("announce_winner")
.setLabel("Announce Winner")
.setStyle(ButtonStyle.Success)

)

interaction.update({components:[row]})
return
}

interaction.reply({content:"Next round created.",ephemeral:true})

}

/* WINNER */

if(interaction.customId==="announce_winner"){

const winner=await client.users.fetch(bracket[0][0])

const embed=new EmbedBuilder()
.setTitle("🏆 Tournament Winner")
.setDescription(`Congratulations **${winner.username}**`)
.setImage(random(WINNER_IMAGES))
.setColor("Gold")

interaction.channel.send({embeds:[embed]})

}

/* TICKETS */

if(
interaction.customId==="support_ticket" ||
interaction.customId==="apply_ticket" ||
interaction.customId==="reward_ticket"
){

let type="ticket"

if(interaction.customId==="support_ticket") type="support"
if(interaction.customId==="apply_ticket") type="apply"
if(interaction.customId==="reward_ticket") type="reward"

let category=interaction.guild.channels.cache.find(
c=>c.name==="Tickets" && c.type===ChannelType.GuildCategory
)

if(!category){

category=await interaction.guild.channels.create({
name:"Tickets",
type:ChannelType.GuildCategory
})

}

const channel=await interaction.guild.channels.create({
name:`${type}-${interaction.user.username}`,
type:ChannelType.GuildText,
parent:category.id,
permissionOverwrites:[
{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},
{
id:interaction.user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages
]
}
]
})

const embed=new EmbedBuilder()
.setTitle("🎫 Ticket Created")
.setDescription(`Support will assist you soon.`)
.setImage(TICKET_IMAGE)
.setColor("Blue")

channel.send({content:`Hello ${interaction.user}`,embeds:[embed]})

interaction.reply({content:`Ticket created: ${channel}`,ephemeral:true})

}

})

/* ================= PLAYER COUNT UPDATE ================= */

function updatePlayerCount(){

if(!registerMessage) return

const embed=new EmbedBuilder()
.setTitle("🏆 Tournament")
.setDescription(`🎮 Mode: 1v1
👥 Players: **${players.length}**
Status: **OPEN**`)
.setImage(random(REGISTER_IMAGES))
.setColor("Red")

registerMessage.edit({embeds:[embed]})

}

client.login(process.env.TOKEN)
