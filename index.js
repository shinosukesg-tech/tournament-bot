require("dotenv").config();

/* ================= UPTIME SERVER ================= */
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server running");
});
/* ================================================= */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Staff";
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1350446868064374845/Event_Background_BlockDash.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

/* ================= STATE ================= */

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createTournament(size, server, map) {
  return {
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    started: false,
    panelId: null,
    channelId: null,
    totalMatches: 0,
    completedMatches: 0
  };
}

function createMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const size = nextPowerOfTwo(shuffled.length);

  while (shuffled.length < size) shuffled.push(null);

  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      p1: shuffled[i],
      p2: shuffled[i + 1],
      winner: null,
      code: generateCode()
    });
  }

  return matches;
}

function progressBar() {
  const total = tournament.totalMatches;
  const done = tournament.completedMatches;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 10);
  return "🟩".repeat(percent) + "⬜".repeat(10 - percent);
}

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours Tournament")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
📌 Status: **${tournament.started ? "Started" : "Open Registration"}**
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function bracketEmbed() {
  let desc = `🏆 ShinTours Bracket\n━━━━━━━━━━━━━━━━━━\n`;

  tournament.matches.forEach((m, i) => {
    desc += `⚔️ Match ${i + 1}\n`;

    if (!m.p2) {
      desc += `🆓 <@${m.p1}> (BYE)\n\n`;
    } else if (!m.winner) {
      desc += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    } else {
      const loser = m.p1 === m.winner ? m.p2 : m.p1;
      desc += `🏆 <@${m.winner}>\n❌ ~~<@${loser}>~~\n\n`;
    }
  });

  desc += `━━━━━━━━━━━━━━━━━━\n📊 Progress:\n${progressBar()}\n`;

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

/* ================= BUTTONS ================= */

function mainButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register_btn")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("start_btn")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
  );
}

function unregisterConfirmButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_unregister_btn")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger)
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  await msg.delete().catch(() => {});

  /* ===== HELP COMMAND ===== */
  if (cmd === "help") {
    return msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#00ff88")
          .setTitle("📖 ShinTours Tournament Help")
          .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 Create Tournament
;1v1 <players> <server> <map>

🗑 Delete Tournament
;del

🏆 Qualify Winner
;qual @player
;win @player
(Use even for BYE)

📌 Info
• Staff role required
• Auto progress bar
• Winner gets DM room code
• 2 minutes join time
━━━━━━━━━━━━━━━━━━
`)
          .setImage(BANNER)
      ]
    });
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (tournament) return msg.channel.send("⚠️ Tournament already exists.");

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    if (!size || !server || !map)
      return msg.channel.send("Usage: ;1v1 <players> <server> <map>");

    tournament = createTournament(size, server, map);

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [mainButtons()]
    });

    tournament.panelId = panel.id;
    tournament.channelId = msg.channel.id;
  }

  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament || !tournament.started)
      return msg.channel.send("❌ No active tournament.");

    const mention = msg.mentions.users.first();
    if (!mention) return msg.channel.send("Usage: ;qual @player");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === mention.id || m.p2 === mention.id)
    );

    if (!match) return msg.channel.send("❌ Player not in active match.");

    match.winner = mention.id;
    tournament.completedMatches++;

    const user = await client.users.fetch(mention.id);

    await user.send(`
🌍Region : ${tournament.server}
🗺Map : ${tournament.map}
🔒Room Code :

\`\`\`
${match.code}
\`\`\`

⏳ You have 2 minutes to join.
`);

    const remaining = tournament.matches.filter(m => !m.winner);

    if (remaining.length === 0) {
      const winners = tournament.matches.map(m => m.winner);

      if (winners.length === 1) {
        const champ = await client.users.fetch(winners[0]);

        await msg.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("Gold")
              .setTitle("🏆 ShinTours Champion")
              .setDescription(`<:PrimeBlackW:1465047029930528872> **${champ.username}** wins the tournament!`)
              .setThumbnail(champ.displayAvatarURL({ dynamic: true }))
              .setImage(BANNER)
          ]
        });

        tournament = null;
        return;
      }

      tournament.matches = createMatches(winners);
      tournament.totalMatches += tournament.matches.length;
    }

    const channel = await client.channels.fetch(tournament.channelId);
    const panel = await channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [bracketEmbed()] });

    msg.channel.send(`✅ <@${mention.id}> qualified.`);
  }

  if (cmd === "del") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament) return msg.channel.send("❌ No tournament running.");

    try {
      const channel = await client.channels.fetch(tournament.channelId);
      const panel = await channel.messages.fetch(tournament.panelId);
      await panel.delete().catch(() => {});
    } catch {}

    tournament = null;
    msg.channel.send("🗑 Tournament deleted.");
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament)
    return interaction.reply({ content: "❌ No tournament running.", ephemeral: true });

  if (interaction.customId === "register_btn") {
    if (tournament.started)
      return interaction.reply({ content: "❌ Tournament already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      return interaction.reply({
        content: "You are already registered.\nDo you want to unregister?",
        components: [unregisterConfirmButton()],
        ephemeral: true
      });
    }

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "❌ Tournament full.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    await interaction.reply({ content: "✅ Successfully registered!", ephemeral: true });

    const channel = await client.channels.fetch(tournament.channelId);
    const panel = await channel.messages.fetch(tournament.panelId);
    panel.edit({ embeds: [registrationEmbed()] });
  }

  if (interaction.customId === "confirm_unregister_btn") {
    tournament.players = tournament.players.filter(id => id !== interaction.user.id);

    interaction.update({ content: "✅ You have been unregistered.", components: [] });

    const channel = await client.channels.fetch(tournament.channelId);
    const panel = await channel.messages.fetch(tournament.panelId);
    panel.edit({ embeds: [registrationEmbed()] });
  }

  if (interaction.customId === "start_btn") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);
    tournament.totalMatches = tournament.matches.length;
    tournament.completedMatches = 0;

    interaction.update({ embeds: [bracketEmbed()], components: [] });
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
