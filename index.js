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
\`;win @player\` - Same as qual (final)  
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

  /* ===== CREATE 1v1 ===== */
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
      round: 1,
      maxPlayers: 16,
      started: false,
    };

    const embed = new EmbedBuilder()
      .setColor("#00b0f4")
      .setTitle("🏆 1v1 Tournament")
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
    const roomCode = args[0];
    const mentioned = message.mentions.users.first();

    if (!roomCode || !mentioned)
      return message.reply("Usage: `;code <roomcode> @player`");

    const match = tournament.matches.find(
      (m) =>
        m.players.includes(mentioned.id) &&
        !m.finished
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
    const mentioned = message.mentions.users.first();
    if (!mentioned) return;

    const match = tournament.matches.find(
      (m) => m.players.includes(mentioned.id) && !m.finished
    );
    if (!match) return;

    match.finished = true;
    match.winner = mentioned.id;

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("🎉 Match Finished")
      .setDescription(`🥇 Winner: ${mentioned}`)
      .setTimestamp();

    message.channel.send({ embeds: [embed] });

    advanceWinner(mentioned.id, message.channel);
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.players.includes(interaction.user.id)) {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_unreg")
          .setLabel("Unregister")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        content: "Do you want to unregister?",
        components: [confirmRow],
        ephemeral: true,
      });
    }

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

  if (interaction.customId === "confirm_unreg") {
    tournament.players = tournament.players.filter(
      (id) => id !== interaction.user.id
    );
    await interaction.reply({
      content: "❌ Unregistered.",
      ephemeral: true,
    });
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

        interaction.channel.send(
          `⚔️ <@${p1}> vs <@${p2}>`
        );
      }
    }

    interaction.reply({ content: "Tournament Started!", ephemeral: true });
  }
});

/* ================= ADVANCE ================= */

function advanceWinner(userId, channel) {
  if (!tournament.nextRound) tournament.nextRound = [];
  tournament.nextRound.push(userId);

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

client.login(process.env.DISCORD_TOKEN);
