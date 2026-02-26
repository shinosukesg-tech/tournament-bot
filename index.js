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
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

let tournament = null;

/* ================= UTIL ================= */

function progressBar(current, total) {
  const percent = current / total;
  const filled = Math.round(percent * 10);
  return "🟩".repeat(filled) + "⬜".repeat(10 - filled);
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} is online`);
});

/* ================= MESSAGE COMMANDS ================= */

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(";")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ===== HELP ===== */
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor("#00b0f4")
      .setTitle("📖 Tournament Help")
      .setDescription(`
\`;1v1 <server> <map>\` - Create tournament  
\`;code <roomcode> @player\` - Send match code  
\`;qual @player\` - Qualify player  
\`;win @player\` - Declare winner  
\`;del\` - Delete your command
      `)
      .setFooter({ text: "ShinTours System" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  /* ===== DELETE ===== */
  if (cmd === "del") {
    await message.delete().catch(() => {});
    return;
  }

  /* ===== CREATE TOURNAMENT ===== */
  if (cmd === "1v1") {
    const server = args[0];
    const map = args[1];

    if (!server || !map)
      return message.reply("Usage: `;1v1 <server> <map>`");

    tournament = {
      server,
      map,
      players: [],
      matches: [],
      nextRound: [],
      maxPlayers: 16,
      started: false,
    };

    const embed = new EmbedBuilder()
      .setColor("#00b0f4")
      .setTitle("🏆 1v1 Tournament Registration")
      .setDescription(`
🌍 **Server:** ${server}
🗺 **Map:** ${map}

👥 Players: 0/${tournament.maxPlayers}
📊 ${progressBar(0, tournament.maxPlayers)}
      `);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("start")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await message.channel.send({
      embeds: [embed],
      components: [row],
    });

    tournament.messageId = msg.id;
  }

  /* ===== CODE ===== */
  if (cmd === "code") {
    if (!tournament) return;

    const roomCode = args[0];
    const mentioned = message.mentions.users.first();

    if (!roomCode || !mentioned)
      return message.reply("Usage: `;code <roomcode> @player`");

    const match = tournament.matches.find(
      (m) => m.players.includes(mentioned.id) && !m.finished
    );
    if (!match) return message.reply("Match not found.");

    const opponentId = match.players.find((id) => id !== mentioned.id);
    const opponent = await client.users.fetch(opponentId);

    const embed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("🎮 Match Room Details")
      .setDescription(`
🌍 **Server:** ${tournament.server}
🗺 **Map:** ${tournament.map}

🔒 **Code:**
\`\`\`
${roomCode}
\`\`\`

⏳ You have 2 minutes to join.
      `)
      .setTimestamp();

    await mentioned.send({ embeds: [embed] }).catch(() => {});
    await opponent.send({ embeds: [embed] }).catch(() => {});

    return message.reply("✅ Code sent to both players.");
  }

  /* ===== QUAL / WIN ===== */
  if (cmd === "qual" || cmd === "win") {
    if (!tournament) return;

    const mentioned = message.mentions.users.first();
    if (!mentioned) return;

    const match = tournament.matches.find(
      (m) => m.players.includes(mentioned.id) && !m.finished
    );
    if (!match) return;

    match.finished = true;
    match.winner = mentioned.id;

    const winEmbed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("🎉 Match Finished")
      .setDescription(`🥇 **Winner:** ${mentioned}`)
      .setTimestamp();

    message.channel.send({ embeds: [winEmbed] });

    advanceWinner(mentioned.id, message.channel);
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({
        content: "❌ You are already registered.",
        ephemeral: true,
      });

    tournament.players.push(interaction.user.id);

    const embed = EmbedBuilder.from(
      interaction.message.embeds[0]
    ).setDescription(`
🌍 **Server:** ${tournament.server}
🗺 **Map:** ${tournament.map}

👥 Players: ${tournament.players.length}/${tournament.maxPlayers}
📊 ${progressBar(
      tournament.players.length,
      tournament.maxPlayers
    )}
    `);

    await interaction.update({ embeds: [embed] });
  }

  if (interaction.customId === "start") {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageGuild
      )
    )
      return interaction.reply({
        content: "Staff only.",
        ephemeral: true,
      });

    if (tournament.started)
      return interaction.reply({
        content: "Already started.",
        ephemeral: true,
      });

    tournament.started = true;

    const shuffled = shuffle(tournament.players);

    while (shuffled.length > 0) {
      const p1 = shuffled.shift();
      const p2 = shuffled.shift();

      if (!p2) {
        interaction.channel.send(
          `🎉 <@${p1}> gets BYE and auto qualifies.`
        );
        advanceWinner(p1, interaction.channel);
      } else {
        tournament.matches.push({
          players: [p1, p2],
          finished: false,
        });

        interaction.channel.send(`⚔️ <@${p1}> vs <@${p2}>`);
      }
    }

    interaction.reply({
      content: "Tournament Started!",
      ephemeral: true,
    });
  }
});

/* ================= ADVANCE SYSTEM ================= */

function advanceWinner(userId, channel) {
  tournament.nextRound.push(userId);

  const unfinished = tournament.matches.filter((m) => !m.finished);

  if (unfinished.length === 0 && tournament.nextRound.length === 1) {
    announceChampion(userId, channel);
    tournament = null;
    return;
  }

  if (tournament.nextRound.length === 2) {
    const [p1, p2] = tournament.nextRound;

    tournament.matches.push({
      players: [p1, p2],
      finished: false,
    });

    channel.send(`⚔️ <@${p1}> vs <@${p2}>`);
    tournament.nextRound = [];
  }
}

/* ================= FINAL CHAMPION ================= */

async function announceChampion(userId, channel) {
  const user = await client.users.fetch(userId);

  const championEmbed = new EmbedBuilder()
    .setColor("#f1c40f")
    .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
    .setDescription(`
👑 **Champion:** ${user}

🌍 **Server:** ${tournament.server}
🗺 **Map:** ${tournament.map}

🔥 Congratulations! You are the ultimate winner!
    `)
    .setFooter({ text: "ShinTours Tournament System" })
    .setTimestamp();

  channel.send({ embeds: [championEmbed] });
}

client.login(process.env.DISCORD_TOKEN);
