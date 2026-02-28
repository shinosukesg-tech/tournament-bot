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

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const MOD_ROLE = "Moderator";
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

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

/* ================= AUTO DELETE NON EMBED ================= */
client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  if (msg.embeds.length === 0 && !msg.content.startsWith(PREFIX)) {
    setTimeout(() => msg.delete().catch(()=>{}), 4000);
  }
});
/* ======================================================== */

const shuffle = (arr) =>
  [...arr].sort(() => Math.random() - 0.5);

const allFinished = () =>
  tournament.matches.every(m => m.winner);

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#ff003c")
    .setTitle(`🏆 ${tournament.name}`)
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🔓 Status: **OPEN**
`);
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

    desc += `Match ${i + 1} ${m.winner ? TICK : ""}
${p1} ${VS} ${p2}
${m.winner ? "✔ COMPLETE" : "⏳ Pending"}

`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc);
}

function controlRow() {
  const final = tournament.matches.length === 1;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(final ? "announce" : "next")
      .setLabel(final ? "Winner Announce 🏆" : "Next Round")
      .setStyle(final ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(!allFinished())
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(()=>{});

  /* ===== HELP ===== */
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📖 TOURNAMENT BOT COMMANDS")
      .setImage(BANNER)
      .setDescription(`
🎮 **Tournament**
\`;1v1 <slots> <server> <map> <name>\`
\`;bye\`
\`;start\`
\`;qual @user | bye1\`

🎫 **Ticket**
\`;ticketpanel add\`

🛠 **Other**
\`;code\`
\`;help\`
      `);
    return msg.channel.send({ embeds: [embed] });
  }

  /* ===== CODE ===== */
  if (cmd === "code") {
    return msg.channel.send("👨‍💻 Tournament System Active & Running.");
  }

  /* ===== TICKET PANEL ===== */
  if (cmd === "ticketpanel" && args[0] === "add") {
    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🎫 Support & Applications")
      .setDescription(
`For Staff Application and support, Create a ticket with the button below<:shinchan_sips:1465048892876783820>`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    return msg.channel.send({ embeds: [embed], components: [row] });
  }

  /* ===== CREATE TOURNAMENT ===== */
  if (cmd === "1v1") {

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");
    if (!size || !server || !map || !name) return;

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

  if (!tournament) return;

  if (cmd === "bye") {
    let count = 1;
    while (tournament.players.length < tournament.maxPlayers) {
      tournament.players.push(`BYE${count++}`);
    }
    return msg.channel.send("BYE slots filled");
  }

  if (cmd === "start") {
    tournament.matches = [];
    const shuffled = shuffle(tournament.players);

    for (let i = 0; i < shuffled.length; i += 2) {
      tournament.matches.push({
        p1: shuffled[i],
        p2: shuffled[i + 1],
        winner: shuffled[i].startsWith("BYE") ? shuffled[i + 1] :
                shuffled[i + 1].startsWith("BYE") ? shuffled[i] :
                null
      });
    }

    const bracket = await msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    tournament.bracketId = bracket.id;
  }

  if (cmd === "qual") {

    const input = args[0];

    if (input && input.toLowerCase().startsWith("bye")) {
      const match = tournament.matches.find(
        m => m.p1 === input || m.p2 === input
      );
      if (!match) return;
      match.winner = input;
    } else {
      const user = msg.mentions.users.first();
      if (!user) return;

      const match = tournament.matches.find(
        m => m.p1 === user.id || m.p2 === user.id
      );
      if (!match) return;

      match.winner = user.id;
    }

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isButton()) return;

  if (i.customId === "announce") {

    const winnerId = tournament.matches[0].winner;
    const winnerUser = await client.users.fetch(winnerId);

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🏆 TOURNAMENT WINNER 🏆")
      .setThumbnail(winnerUser.displayAvatarURL({ dynamic: true, size: 512 }))
      .setImage(BANNER)
      .setDescription(`
🎉 Congratulations <@${winnerId}>!

You are the Champion of **${tournament.name}**
      `);

    await i.channel.send({ embeds: [embed] });

    tournament = null;
    return i.deferUpdate();
  }
});

client.login(process.env.TOKEN);
