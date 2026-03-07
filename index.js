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

const PREFIX = ";"

/* ================= IMAGES ================= */

const REGISTER_IMAGE = "https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
const BRACKET_IMAGE = "https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const WINNER_IMAGE = "https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
const TICKET_IMAGE = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"

/* ================= TOURNAMENT DATA ================= */

let players = []
let bracket = []
let currentMatch = 0

/* ================= READY ================= */

client.on("ready", ()=>{
console.log(`Logged in as ${client.user.tag}`)
})

/* ================= WELCOME ================= */

client.on("guildMemberAdd", member => {

const channel = member.guild.systemChannel
if(!channel) return

const embed = new EmbedBuilder()
.setTitle("Welcome!")
.setDescription(`Welcome ${member} to **${member.guild.name}**`)
.setImage(REGISTER_IMAGE)
.setColor("Green")

channel.send({embeds:[embed]})

})

/* ================= COMMANDS ================= */

client.on("messageCreate", async message => {

if(message.author.bot) return
if(!message.content.startsWith(PREFIX)) return

const args = message.content.slice(PREFIX.length).trim().split(/ +/)
const cmd = args.shift().toLowerCase()

/* ---- CODE ---- */

if(cmd === "code"){
return message.reply("Tournament Code: **1234-5678-9012**")
}

/* ---- BYE COMMAND (NEW) ---- */

if(cmd === "bye"){

if(!players.includes(message.author.id)){
return message.reply("You are not in the tournament.")
}

players = players.filter(id => id !== message.author.id)

return message.reply("You left the tournament.")

}

/* ---- TOURNAMENT ---- */

if(cmd === "1v1"){

players = []
bracket = []
currentMatch = 0

const embed = new EmbedBuilder()
.setTitle("1v1 Tournament")
.setDescription("Click Register to join\n\nPlayers: **0**")
.setImage(REGISTER_IMAGE)
.setColor("Blue")

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("register")
.setLabel("Register")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("start")
.setLabel("Start")
.setStyle(ButtonStyle.Primary)
)

message.channel.send({embeds:[embed],components:[row]})

}

/* ---- TICKET PANEL ---- */

if(cmd === "ticketpanel"){

const embed = new EmbedBuilder()
.setTitle("Support Tickets")
.setDescription("Click button to open ticket")
.setImage(TICKET_IMAGE)
.setColor("Green")

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("create_ticket")
.setLabel("Create Ticket")
.setStyle(ButtonStyle.Success)
)

message.channel.send({embeds:[embed],components:[row]})

}

})

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {

if(!interaction.isButton()) return

/* ---- REGISTER ---- */

if(interaction.customId === "register"){

if(players.includes(interaction.user.id)){
return interaction.reply({content:"You already joined!",ephemeral:true})
}

players.push(interaction.user.id)

const embed = new EmbedBuilder()
.setTitle("1v1 Tournament")
.setDescription(`Click Register to join\n\nPlayers: **${players.length}**`)
.setImage(REGISTER_IMAGE)

await interaction.update({embeds:[embed]})

}

/* ---- START BRACKET ---- */

if(interaction.customId === "start"){

if(players.length < 2){
return interaction.reply({content:"Need at least 2 players",ephemeral:true})
}

players.sort(()=>Math.random()-0.5)

for(let i=0;i<players.length;i+=2){
bracket.push([players[i],players[i+1]])
}

let desc = ""

for(const match of bracket){

const p1 = await client.users.fetch(match[0])
const p2 = await client.users.fetch(match[1])

desc += `${p1} <:VS:1477014161484677150> ${p2}\n`
}

const embed = new EmbedBuilder()
.setTitle("Tournament Bracket")
.setDescription(desc)
.setImage(BRACKET_IMAGE)

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("next_round")
.setLabel("Next Round")
.setStyle(ButtonStyle.Primary)
)

interaction.update({embeds:[embed],components:[row]})

}

/* ---- NEXT ROUND ---- */

if(interaction.customId === "next_round"){

currentMatch++

if(currentMatch >= bracket.length){

const winnerID = bracket[bracket.length-1][0]
const winner = await client.users.fetch(winnerID)

const embed = new EmbedBuilder()
.setTitle("Tournament Winner")
.setDescription(`<:TICK:1467892699578236998> ${winner}`)
.setThumbnail(winner.displayAvatarURL())
.setImage(WINNER_IMAGE)
.setColor("Gold")

return interaction.update({embeds:[embed],components:[]})

}

const match = bracket[currentMatch]

const p1 = await client.users.fetch(match[0])
const p2 = await client.users.fetch(match[1])

const embed = new EmbedBuilder()
.setTitle("Next Match")
.setDescription(`${p1} <:VS:1477014161484677150> ${p2}`)
.setImage(BRACKET_IMAGE)

interaction.update({embeds:[embed]})

}

/* ---- CREATE TICKET ---- */

if(interaction.customId === "create_ticket"){

const channel = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:ChannelType.GuildText,
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

channel.send(`Hello ${interaction.user}, support will be with you soon.`)

interaction.reply({
content:`Your ticket: ${channel}`,
ephemeral:true
})

}

})

client.login(process.env.TOKEN)
