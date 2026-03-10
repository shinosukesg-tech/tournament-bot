require("dotenv").config();
const express = require("express");
const {
Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle,
PermissionFlagsBits
} = require("discord.js");
const fs = require("fs");

/* ================= WEB SERVER ================= */

const app = express();
app.get("/", (req,res)=>res.send("Bot Online"));
app.listen(process.env.PORT || 3000,"0.0.0.0");

/* ================= CONFIG ================= */

const PREFIX = "!";
const WELCOME_CHANNEL_ID = "WELCOME_CHANNEL_ID";
const TICKET_CATEGORY_ID = "TICKET_CATEGORY_ID";
const MOD_ROLE_ID = "MODERATOR_ROLE_ID";

const REGISTER_LINK = "YOUR_REGISTER_LINK";
const BRACKET_LINK = "YOUR_BRACKET_LINK";

/* ================= CLIENT ================= */

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers
]});

/* ================= STORAGE ================= */

const file="./tournament.json";

function load(){
if(!fs.existsSync(file)) return {players:[],round:1};
return JSON.parse(fs.readFileSync(file));
}

function save(d){
fs.writeFileSync(file,JSON.stringify(d,null,2));
}

let db=load();

/* ================= READY ================= */

client.once("ready",async()=>{

console.log(`Logged in as ${client.user.tag}`);

const commands=[

new SlashCommandBuilder()
.setName("help")
.setDescription("Commands"),

new SlashCommandBuilder()
.setName("1v1")
.setDescription("Tournament register panel"),

new SlashCommandBuilder()
.setName("start")
.setDescription("Start tournament"),

new SlashCommandBuilder()
.setName("next")
.setDescription("Next round"),

new SlashCommandBuilder()
.setName("ticket-panel")
.setDescription("Send ticket panel")
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
.setName("winner")
.setDescription("Announce winners")
.addUserOption(o=>o.setName("first").setDescription("1st").setRequired(true))
.addUserOption(o=>o.setName("second").setDescription("2nd").setRequired(true))
.addUserOption(o=>o.setName("third").setDescription("3rd").setRequired(true))

].map(c=>c.toJSON());

const rest=new REST({version:"10"}).setToken(process.env.TOKEN);

await rest.put(
Routes.applicationCommands(client.user.id),
{body:commands}
);

});

/* ================= AUTO WELCOME ================= */

client.on("guildMemberAdd",async member=>{

const ch=member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
if(!ch) return;

const embed=new EmbedBuilder()

.setColor("#5865F2")
.setTitle(`Welcome ${member.user.username}`)
.setThumbnail(member.user.displayAvatarURL())
.setDescription(`Welcome **${member.user.username}** to the server!

Have fun here! 🎉`)
.addFields(

{name:"ID",value:member.id},

{name:"Account Created",
value:`<t:${Math.floor(member.user.createdTimestamp/1000)}:D>`}

);

ch.send({
content:`Welcome <@${member.id}>`,
embeds:[embed]
});

});

/* ================= TOURNAMENT PANEL ================= */

function registerPanel(){

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Registration")
.setDescription("Click below to register")

const row=new ActionRowBuilder()
.addComponents(

new ButtonBuilder()
.setLabel("Register")
.setStyle(ButtonStyle.Link)
.setURL(REGISTER_LINK),

new ButtonBuilder()
.setLabel("Bracket")
.setStyle(ButtonStyle.Link)
.setURL(BRACKET_LINK)

);

return {embeds:[embed],components:[row]};

}

/* ================= TICKET PANEL ================= */

function ticketPanel(){

const embed=new EmbedBuilder()

.setTitle("🎫 Ticket System")

.setDescription(`
🔰 Support → Need help
📋 Apply → Staff apply
🎁 Reward → Claim reward
`);

const row=new ActionRowBuilder()

.addComponents(

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

);

return {embeds:[embed],components:[row]};

}

/* ================= BUTTONS ================= */

client.on("interactionCreate",async i=>{

if(i.isButton()){

let type=i.customId;

let channel=await i.guild.channels.create({

name:`${type}-${i.user.username}`,

parent:TICKET_CATEGORY_ID,

permissionOverwrites:[

{
id:i.guild.id,
deny:[PermissionFlagsBits.ViewChannel]
},

{
id:i.user.id,
allow:[
PermissionFlagsBits.ViewChannel,
PermissionFlagsBits.SendMessages
]
},

{
id:MOD_ROLE_ID,
allow:[
PermissionFlagsBits.ViewChannel,
PermissionFlagsBits.SendMessages
]
}

]

});

i.reply({
content:`Ticket created: ${channel}`,
ephemeral:true
});

}

});

/* ================= COMMANDS ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return;

const cmd=interaction.commandName;

if(cmd==="help"){

return interaction.reply("Commands: /1v1 /start /next /winner /ticket-panel");

}

if(cmd==="1v1"){

return interaction.reply(registerPanel());

}

if(cmd==="ticket-panel"){

await interaction.reply({content:"Panel sent",ephemeral:true});

return interaction.channel.send(ticketPanel());

}

if(cmd==="winner"){

let first=interaction.options.getUser("first");
let second=interaction.options.getUser("second");
let third=interaction.options.getUser("third");

const embed=new EmbedBuilder()

.setTitle("🏆 Tournament Winners")

.setThumbnail(first.displayAvatarURL())

.setDescription(`
🥇 **${first.username}** <reward1>

🥈 ${second.username} <reward2>

🥉 ${third.username} <reward3>
`);

interaction.channel.send({embeds:[embed]});

interaction.reply({content:"Winner announced",ephemeral:true});

}

});

client.login(process.env.TOKEN);
