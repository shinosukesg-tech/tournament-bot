require("dotenv").config();

/* ================= UPTIME ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(process.env.PORT || 3000);
/* ========================================== */

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

const gems = require("./gems.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const MOD_ROLE = "Moderator";
const DEFAULT_NAME = "ShinTours Tournament";

const BANNERS = [
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png",
"https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png"
];

function banner(){
return BANNERS[Math.floor(Math.random()*BANNERS.length)];
}

const TICK = "<:TICK:1467892699578236998>";
const VS = "<:VS:1477014161484677150>";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

let tournament = null;
let welcomeChannel = null;

/* ================= UTIL ================= */

const autoDelete = (msg) =>
  setTimeout(() => msg.delete().catch(() => {}), 2000);

const isStaff = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const shuffle = (arr) =>
  [...arr].sort(() => Math.random() - 0.5);

const allFinished = () =>
  tournament && tournament.matches.every(m => m.winner);

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#ff003c")
    .setTitle(`🏆 ${tournament.name}`)
    .setImage(banner())
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🔓 Status: **OPEN**
`)
    .setTimestamp();
}

function registrationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("count")
      .setLabel(`👤 ${tournament.players.length}/${tournament.maxPlayers}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {

    const p1 = m.p1.startsWith("BYE") ? m.p1 : `<@${m.p1}>`;
    const p2 = m.p2.startsWith("BYE") ? m.p2 : `<@${m.p2}>`;

    const title = m.winner ? `Match ${i + 1} ${TICK}` : `Match ${i + 1}`;

    desc += `${title}
${p1} ${VS} ${p2}
${m.winner ? "✔ COMPLETE" : "⏳ Pending"}

`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(banner())
    .setDescription(desc)
    .setTimestamp();
}

function controlRow() {
  const final = tournament.matches.length === 1;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(final ? "announce" : "next")
      .setLabel(final ? "Announce Winner 🏆" : "Next Round")
      .setStyle(final ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(!allFinished())
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {

  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (msg.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await msg.delete().catch(()=>{});
  }

  if(cmd==="welcome"){

  if(!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  welcomeChannel = msg.channel.id;

  msg.channel.send("✅ Welcome system set in this channel");

  }

  if (cmd === "help") {
    const m = await msg.channel.send(`
**Tournament Commands**
;1v1 size server map (name optional)
;start
;qual @player / bye1
;code ROOMCODE @player
;ticketpanel add
;del
`);
    return autoDelete(m);
  }

  if (cmd === "ticketpanel" && args[0] === "add") {
    if (!isStaff(msg.member)) return;

    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("🎫 Support & Staff Application")
      .setDescription("For Staff Application and support, Create a ticket with the button below");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await msg.channel.send({ embeds: [embed], components: [row] });
    return;
  }

  if (cmd === "del") {
    tournament = null;
    const m = await msg.channel.send("Tournament deleted.");
    return autoDelete(m);
  }

  if (cmd === "1v1") {

    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ") || DEFAULT_NAME;

    if (!size || !server || !map) return;

    tournament = {
      name,
      maxPlayers: size,
      server,
      map,
      players: [],
      matches: [],
      round: 1,
      panelId: null,
      bracketId: null
    };

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });

    tournament.panelId = panel.id;
  }

});

/* ================= WELCOME EVENT ================= */

client.on("guildMemberAdd", member=>{

if(!welcomeChannel) return;

const channel = member.guild.channels.cache.get(welcomeChannel);
if(!channel) return;

const created = `<t:${Math.floor(member.user.createdTimestamp/1000)}:R>`;

const embed = new EmbedBuilder()
.setColor("#8e44ad")
.setAuthor({name:`Welcome ${member.user.username} 👋`,iconURL:member.user.displayAvatarURL({dynamic:true})})
.setThumbnail(member.user.displayAvatarURL({size:512}))
.setDescription(`
Welcome **${member.user.username}**
to 🏆 • Ultimate Tournaments! 🎉

🆔 User ID
${member.id}

📅 Account Created
${created}

🎭 Display Name
${member.displayName}
`)
.setImage(banner())
.setFooter({text:`${member.guild.memberCount} members`})
.setTimestamp();

channel.send({embeds:[embed]});

});

client.login(process.env.TOKEN);
