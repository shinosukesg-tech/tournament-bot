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
  PermissionsBitField
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function createTournament(size, server, map, name, channelId) {
  return {
    name,
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    round: 1,
    started: false,
    channelId,
    panelId: null
  };
}

function generateMatches(players) {
  const shuffled = shuffle(players);
  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      p1: shuffled[i],
      p2: shuffled[i + 1],
      winner: null
    });
  }

  return matches;
}

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
`)
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    let p1 = `<@${m.p1}>`;
    let p2 = `<@${m.p2}>`;

    if (m.winner) {
      if (m.winner === m.p1) {
        p1 += " ✅";
        p2 += " ❌";
      } else {
        p2 += " ✅";
        p1 += " ❌";
      }
    }

    desc += `Match ${i + 1}
${p1} ⚔ ${p2}
${m.winner ? "✔ COMPLETE" : "⏳ Pending"}

`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 TOURNAMENT BRACKET")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

function championEmbed(winnerId) {
  return new EmbedBuilder()
    .setColor("#ffd700")
    .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
    .setImage(BANNER)
    .setDescription(`
👑 Congratulations <@${winnerId}>!

You are the official champion of **${tournament.name}**
`)
    .setTimestamp();
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  msg.delete().catch(() => {});

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");

    if (!size || !server || !map || !name) return;

    tournament = createTournament(size, server, map, name, msg.channel.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("start")
        .setLabel("START")
        .setStyle(ButtonStyle.Danger)
    );

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.panelId = panel.id;
  }

  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;
    if (!tournament || !tournament.started) return;

    const user = msg.mentions.users.first();
    if (!user) return;

    for (const match of tournament.matches) {
      if (!match.winner &&
        (match.p1 === user.id || match.p2 === user.id)) {

        match.winner = user.id;

        const panel = await msg.channel.messages.fetch(tournament.panelId);
        await panel.edit({ embeds: [bracketEmbed()] });

        const allDone = tournament.matches.every(m => m.winner);

        if (allDone) {
          if (tournament.matches.length === 1) {
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("announce")
                .setLabel("🏆 ANNOUNCE WINNER")
                .setStyle(ButtonStyle.Success)
            );

            await panel.edit({
              embeds: [bracketEmbed()],
              components: [row]
            });
          } else {
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("next")
                .setLabel("NEXT ROUND")
                .setStyle(ButtonStyle.Primary)
            );

            await panel.edit({
              embeds: [bracketEmbed()],
              components: [row]
            });
          }
        }

        break;
      }
    }
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.players.includes(interaction.user.id)) return;

    tournament.players.push(interaction.user.id);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [registrationEmbed()]
    });

    return interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member)) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [bracketEmbed()],
      components: []
    });

    return interaction.reply({ content: "Tournament Started!", ephemeral: true });
  }

  if (interaction.customId === "next") {
    if (!isStaff(interaction.member)) return;

    const winners = tournament.matches.map(m => m.winner);
    tournament.round++;
    tournament.matches = generateMatches(winners);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [bracketEmbed()],
      components: []
    });

    return interaction.reply({ content: "Next Round Generated!", ephemeral: true });
  }

  if (interaction.customId === "announce") {
    if (!isStaff(interaction.member)) return;

    const winner = tournament.matches[0].winner;

    await interaction.channel.send({
      embeds: [championEmbed(winner)]
    });

    tournament = null;

    return interaction.reply({ content: "Champion Announced!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
