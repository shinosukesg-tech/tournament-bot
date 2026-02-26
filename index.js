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
const STAFF_ROLE = "Tournament Hoster";
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
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

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function progressBar(done, total) {
  const size = 10;
  const percent = done / total;
  const progress = Math.round(size * percent);
  return "🟩".repeat(progress) + "⬜".repeat(size - progress);
}

/* ================= TOURNAMENT ================= */

function createTournament(size, server, map) {
  return {
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    round: 1,
    started: false,
    locked: false,
    channelId: null,
    messageId: null
  };
}

function generateMatches(players) {
  const shuffled = shuffle([...players]);
  const size = nextPowerOfTwo(shuffled.length);

  while (shuffled.length < size) shuffled.push(null);

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
    .setColor("#5865F2")
    .setTitle("🏆 ShinTours 1v1 Tournament")
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
📌 Status: **${tournament.locked ? "Locked (Full)" : "Open"}**
`)
    .setFooter({ text: "Professional Tournament System" })
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 **Round ${tournament.round}**\n\n`;
  let completed = 0;

  tournament.matches.forEach((m, i) => {
    if (m.winner) completed++;
    const p1 = m.p1 ? `<@${m.p1}>` : "BYE";
    const p2 = m.p2 ? `<@${m.p2}>` : "BYE";
    const winner = m.winner ? ` ✅ <@${m.winner}>` : "";
    desc += `**Match ${i + 1}**\n${p1} vs ${p2}${winner}\n\n`;
  });

  desc += `Progress:\n${progressBar(completed, tournament.matches.length)}`;

  return new EmbedBuilder()
    .setColor("#00FFAA")
    .setTitle("📊 Live Bracket")
    .setDescription(desc)
    .setImage(BANNER)
    .setTimestamp();
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    if (!size || !server || !map) return;

    tournament = createTournament(size, server, map);
    tournament.channelId = msg.channel.id;

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

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.messageId = panel.id;
    return;
  }

  if (!tournament) return;

  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return;

    const mention = msg.mentions.users.first();
    if (!mention) return;

    for (const match of tournament.matches) {
      if ((match.p1 === mention.id || match.p2 === mention.id) && !match.winner) {
        match.winner = mention.id;
      }
    }

    const winners = tournament.matches.map(m => m.winner).filter(Boolean);

    if (winners.length === tournament.matches.length) {
      if (winners.length === 1) {
        const champ = await client.users.fetch(winners[0]);

        const championEmbed = new EmbedBuilder()
          .setColor("#FFD700")
          .setTitle("🏆 SHINTOURS GRAND CHAMPION 🏆")
          .setThumbnail(champ.displayAvatarURL({ dynamic: true, size: 1024 }))
          .setImage(BANNER)
          .setDescription(`
━━━━━━━━━━━━━━━━━━

👑 **Champion**
${champ}

🔥 Dominated all rounds and secured victory.

━━━━━━━━━━━━━━━━━━
`)
          .setFooter({ text: "ShinTours Professional Tournament System" })
          .setTimestamp();

        await msg.channel.send({ embeds: [championEmbed] });
        tournament = null;
        return;
      }

      tournament.round++;
      tournament.matches = generateMatches(winners);
    }

    const bracketMsg = await client.channels.cache
      .get(tournament.channelId)
      .messages.fetch(tournament.messageId);

    bracketMsg.edit({ embeds: [bracketEmbed()] });
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton() || !tournament) return;

  if (interaction.customId === "register") {

    if (tournament.locked)
      return interaction.reply({ content: "🔒 Registration locked.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(id => id !== interaction.user.id);
      await interaction.reply({ content: "❌ Unregistered.", ephemeral: true });
    } else {
      tournament.players.push(interaction.user.id);
      await interaction.reply({ content: "✅ Registered!", ephemeral: true });

      if (tournament.players.length === tournament.maxPlayers) {
        tournament.locked = true;
      }
    }

    const msg = await interaction.channel.messages.fetch(tournament.messageId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(tournament.locked ? "Locked" : "Register")
        .setStyle(tournament.locked ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(tournament.locked),

      new ButtonBuilder()
        .setCustomId("start")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    );

    await msg.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member)) return;
    if (tournament.started) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    await interaction.reply({
      embeds: [bracketEmbed()]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("📖 Tournament Help")
    .setImage(BANNER)
    .setDescription(`
🎮 ;1v1 <players> <server> <map>
🎮 ;help

🛡 Staff:
;code <roomcode> @player
;qual @player
;win @player
;del
`)
    .setTimestamp();
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ===== HELP ===== */
  if (cmd === "help") {
    return msg.reply({ embeds: [helpEmbed()] });
  }

  /* ===== CREATE ===== */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    if (!size || !server || !map) return;

    tournament = createTournament(size, server, map);
    tournament.channelId = msg.channel.id;

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

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.messageId = panel.id;
    return;
  }

  if (!tournament) return;

  /* ===== DELETE ===== */
  if (cmd === "del") {
    if (!isStaff(msg.member)) return;
    tournament = null;
    return msg.channel.send("Tournament deleted.");
  }

  /* ===== QUALIFY ===== */
  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return;

    const mention = msg.mentions.users.first();
    if (!mention) return;

    for (const match of tournament.matches) {
      if (
        (match.p1 === mention.id || match.p2 === mention.id) &&
        !match.winner
      ) {
        match.winner = mention.id;
      }
    }

    const winners = tournament.matches.map(m => m.winner).filter(Boolean);

    if (winners.length === tournament.matches.length) {
      if (winners.length === 1) {
        const champ = await client.users.fetch(winners[0]);

        const champEmbed = new EmbedBuilder()
          .setColor("Gold")
          .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
          .setThumbnail(champ.displayAvatarURL({ dynamic: true }))
          .setDescription(`👑 Champion: <@${champ.id}>`)
          .setTimestamp();

        msg.channel.send({ embeds: [champEmbed] });
        tournament = null;
        return;
      }

      tournament.round++;
      tournament.matches = generateMatches(winners);
    }

    const bracketMsg = await client.channels.cache
      .get(tournament.channelId)
      .messages.fetch(tournament.messageId);

    bracketMsg.edit({ embeds: [bracketEmbed()] });
  }

  /* ===== CODE ===== */
  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const roomCode = args[0];
    const mention = msg.mentions.users.first();
    if (!roomCode || !mention) return;

    const match = tournament.matches.find(
      m => m.p1 === mention.id || m.p2 === mention.id
    );

    if (!match) return;

    const players = [match.p1, match.p2].filter(Boolean);

    for (const id of players) {
      const user = await client.users.fetch(id);

      const dmEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎮 Match Room Details")
        .setDescription(`
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**

🔒 Code:
\`\`\`${roomCode}\`\`\`

⏳ You have 2 minutes to join.
`)
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    }

    msg.channel.send("Code sent to both opponents.");
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton() || !tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Tournament started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(
        id => id !== interaction.user.id
      );
      return interaction.reply({ content: "Unregistered.", ephemeral: true });
    }

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "Full.", ephemeral: true });

    tournament.players.push(interaction.user.id);
    await interaction.reply({ content: "Registered successfully!", ephemeral: true });

    const msg = await interaction.channel.messages.fetch(tournament.messageId);
    msg.edit({ embeds: [registrationEmbed()] });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member)) return;
    if (tournament.started) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    await interaction.reply({
      embeds: [bracketEmbed()]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);}

function bracketEmbed() {
  const completed = tournament.matches.filter(m => m.winner).length;
  const total = tournament.matches.length;

  let desc = `🏁 **ROUND ${tournament.round}**\n`;
  desc += `Progress: ${matchProgressBar(completed, total)} (${completed}/${total})\n\n`;

  tournament.matches.forEach((m, i) => {
    desc += `**Match ${i + 1}**\n`;
    desc += `• ${m.p1 ? `<@${m.p1}>` : "BYE"} vs ${m.p2 ? `<@${m.p2}>` : "BYE"}\n`;
    desc += `• Winner: ${m.winner ? `✅ <@${m.winner}>` : "⏳ Pending"}\n\n`;
  });

  return new EmbedBuilder()
    .setColor("#2B2D31")
    .setTitle("📊 Live Tournament Bracket")
    .setImage(BANNER)
    .setDescription(desc)
    .setFooter({ text: "Auto Updating Bracket" })
    .setTimestamp();
}

async function announceChampion(channel, winnerId) {
  const user = await client.users.fetch(winnerId);

  const embed = new EmbedBuilder()
    .setColor("Gold")
    .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setImage(BANNER)
    .setDescription(`
━━━━━━━━━━━━━━━━━━
👑 **Champion:** <@${winnerId}>
🔥 Dominated the bracket.
━━━━━━━━━━━━━━━━━━
`)
    .setFooter({ text: "ShinTours Professional Tournament" })
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

/* ================= BOT READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} Online`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "1v1") {
    if (!isStaff(message.member)) return;

    const server = args[0];
    const map = args[1];
    if (!server || !map) return message.reply("Usage: ;1v1 <server> <map>");

    tournament = {
      server,
      map,
      players: [],
      matches: [],
      round: 1,
      started: false
    };

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

    const panel = await message.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.panel = panel;
  }

  if (cmd === "qual") {
    if (!tournament || !tournament.started) return;
    if (!isStaff(message.member)) return;

    const user = message.mentions.users.first();
    if (!user) return;

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );

    if (!match) return;

    match.winner = user.id;

    await tournament.bracketMsg.edit({ embeds: [bracketEmbed()] });

    const winners = tournament.matches.map(m => m.winner);
    if (winners.every(Boolean)) {
      if (winners.length === 1) {
        announceChampion(message.channel, winners[0]);
        tournament = null;
      } else {
        tournament.round++;
        tournament.matches = createMatches(winners);
        tournament.bracketMsg = await message.channel.send({
          embeds: [bracketEmbed()]
        });
      }
    }
  }

  if (cmd === "code") {
    if (!tournament || !tournament.started) return;
    if (!isStaff(message.member)) return;

    const code = args[0];
    const player = message.mentions.users.first();
    if (!code || !player) return;

    const match = tournament.matches.find(
      m => m.p1 === player.id || m.p2 === player.id
    );

    if (!match) return;

    const players = [match.p1, match.p2].filter(Boolean);

    for (const id of players) {
      const user = await client.users.fetch(id);

      const dmEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎮 Match Lobby Details")
        .setImage(BANNER)
        .setDescription(`
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**

🔒 Code:
\`\`\`${code}\`\`\`

⏳ Join within 2 minutes.
`)
        .setTimestamp();

      user.send({ embeds: [dmEmbed] }).catch(() => {});
    }

    message.channel.send(
      `🎮 Code sent to ${players.map(id => `<@${id}>`).join(" ")}`
    );
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Registration closed.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    await tournament.panel.edit({
      embeds: [registrationEmbed()]
    });

    interaction.reply({ content: "Registered successfully.", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    tournament.bracketMsg = await interaction.channel.send({
      embeds: [bracketEmbed()]
    });

    interaction.reply({ content: "Tournament started.", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);    .setImage(BANNER);
}

function helpEmbed() {
  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("🏆 ShinTours Help")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 Commands
━━━━━━━━━━━━━━━━━━

;1v1 <players> <server> <map>
;del
;help

━━━━━━━━━━━━━━━━━━
Staff required for:
1v1 • del
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function progressBar() {
  const total = tournament.matches.length;
  const done = tournament.matches.filter(m => m.winner).length;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  const filled = Math.floor(percent / 10);
  return \`█\`.repeat(filled) + \`░\`.repeat(10 - filled) + \` ${percent}%\`;
}

function bracketEmbed() {
  let desc = `🏆 **ShinTours Tournament Bracket**\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n`;
  desc += `🎯 Round ${tournament.round}\n`;
  desc += `🌍 Server: ${tournament.server}\n`;
  desc += `🗺 Map: ${tournament.map}\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n\n`;

  tournament.matches.forEach((m, i) => {
    desc += `⚔️ **Match ${i + 1}**\n`;

    if (!m.p2) {
      desc += `🆓 <@${m.p1}> (BYE)\n\n`;
      return;
    }

    if (!m.winner) {
      desc += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    } else {
      const loser = m.p1 === m.winner ? m.p2 : m.p1;
      desc += `🏆 **<@${m.winner}>**\n`;
      desc += `❌ ~~<@${loser}>~~\n\n`;
    }
  });

  desc += `━━━━━━━━━━━━━━━━━━\n📊 Progress\n`;
  desc += progressBar();

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (msg.deletable) msg.delete().catch(() => {});

  if (cmd === "help") {
    return msg.channel.send({ embeds: [helpEmbed()] });
  }

  if (cmd === "del") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    if (!tournament)
      return msg.channel.send("❌ No tournament running.");

    tournament = null;
    return msg.channel.send("🗑 Tournament deleted.");
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    if (tournament)
      return msg.channel.send("⚠️ Tournament already exists.");

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    if (!size || !server || !map)
      return msg.channel.send("Usage: ;1v1 <players> <server> <map>");

    tournament = createTournament(size, server, map);

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [buttons()]
    });

    tournament.panelId = panel.id;
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament)
    return interaction.reply({ content: "❌ No tournament running.", ephemeral: true });

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "❌ Tournament already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "⚠️ Already registered.", ephemeral: true });

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "❌ Tournament full.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    return interaction.update({
      embeds: [registrationEmbed()],
      components: [buttons()]
    });
  }

  if (interaction.customId === "unregister") {
    tournament.players = tournament.players.filter(id => id !== interaction.user.id);

    return interaction.update({
      embeds: [registrationEmbed()],
      components: [buttons()]
    });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

    if (tournament.started)
      return interaction.reply({ content: "⚠️ Already started.", ephemeral: true });

    if (tournament.players.length < 2)
      return interaction.reply({ content: "❌ Not enough players.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    return interaction.update({
      embeds: [bracketEmbed()],
      components: []
    });
  }
});

client.login(process.env.DISCORD_TOKEN);🗺 Map: **${tournament.map}**
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
    } else {
      desc += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    }
  });

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

/* ================= BUTTONS ================= */

function mainButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
  );
}

function confirmUnregisterButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger)
  );
}

/* ================= COMMAND HANDLER ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (msg.deletable) await msg.delete().catch(() => {});

  if (cmd === "1v1") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    if (tournament)
      return msg.channel.send("⚠️ Tournament already exists.");

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
  }

  if (cmd === "del") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    tournament = null;
    return msg.channel.send("🗑 Tournament deleted.");
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (!tournament)
    return interaction.reply({ content: "❌ Tournament not active.", ephemeral: true });

  /* REGISTER */
  if (interaction.customId === "register") {

    if (tournament.started)
      return interaction.reply({ content: "❌ Tournament already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      return interaction.reply({
        content: "You are already registered.\nDo you want to unregister?",
        components: [confirmUnregisterButton()],
        ephemeral: true
      });
    }

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "❌ Tournament full.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    await interaction.reply({
      content: "✅ Successfully registered!",
      ephemeral: true
    });

    const panel = await interaction.channel.messages.fetch(tournament.panelId).catch(() => null);
    if (panel) {
      await panel.edit({
        embeds: [registrationEmbed()],
        components: [mainButtons()]
      });
    }
  }

  /* CONFIRM UNREGISTER */
  if (interaction.customId === "confirm_unregister") {

    tournament.players = tournament.players.filter(
      id => id !== interaction.user.id
    );

    await interaction.update({
      content: "✅ You have been unregistered.",
      components: [],
      embeds: []
    });

    const panel = await interaction.channel.messages.fetch(tournament.panelId).catch(() => null);
    if (panel) {
      await panel.edit({
        embeds: [registrationEmbed()],
        components: [mainButtons()]
      });
    }
  }

  /* START (BYE ENABLED) */
  if (interaction.customId === "start") {

    if (!isStaff(interaction.member))
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    await interaction.update({
      embeds: [bracketEmbed()],
      components: []
    });
  }
});

client.login(process.env.DISCORD_TOKEN);    .setTitle("🏆 Tournament Bracket")
    .setDescription(text)
    .setImage(BANNER);
}

function helpEmbed() {
  return new EmbedBuilder()
    .setColor("#3498db")
    .setTitle("📖 Tournament Help")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
;1v1 <players>
;code <roomcode> @player
;qual @player
;win @player
;del
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

/* ================= BUTTONS ================= */

function mainButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  await msg.delete().catch(() => {});

  if (cmd === "help") {
    return msg.channel.send({ embeds: [helpEmbed()] });
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (tournament) return msg.channel.send("⚠️ Tournament already exists.");

    const size = parseInt(args[0]);
    if (!size) return msg.channel.send("Usage: ;1v1 <players>");

    tournament = {
      maxPlayers: size,
      players: [],
      matches: [],
      started: false,
      messageId: null,
      channelId: msg.channel.id
    };

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [mainButtons()]
    });

    tournament.messageId = panel.id;
  }

  if (cmd === "del") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament) return msg.channel.send("❌ No tournament.");

    try {
      const channel = await client.channels.fetch(tournament.channelId);
      const message = await channel.messages.fetch(tournament.messageId);
      await message.delete().catch(() => {});
    } catch {}

    tournament = null;
    msg.channel.send("🗑 Tournament deleted.");
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament || !tournament.started)
      return msg.channel.send("❌ No active tournament.");

    const roomCode = args[0];
    const mention = msg.mentions.users.first();
    if (!roomCode || !mention)
      return msg.channel.send("Usage: ;code <roomcode> @player");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === mention.id || m.p2 === mention.id)
    );

    if (!match) return msg.channel.send("❌ Player not in active match.");

    if (match.codeSent)
      return msg.channel.send("⚠️ Code already sent for this match.");

    const players = [match.p1, match.p2].filter(Boolean);

    for (const id of players) {
      try {
        const user = await client.users.fetch(id);
        await user.send(`🔒 Room Code:\n${roomCode}`);
      } catch {}
    }

    match.codeSent = true;

    msg.channel.send("✅ Code sent to both opponents.");
  }

  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament || !tournament.started)
      return msg.channel.send("❌ No active tournament.");

    const mention = msg.mentions.users.first();
    if (!mention) return msg.channel.send("Mention a player.");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === mention.id || m.p2 === mention.id)
    );

    if (!match) return msg.channel.send("❌ Player not in active match.");

    if (match.winner)
      return msg.channel.send("⚠️ Winner already declared for this match.");

    match.winner = mention.id;

    msg.channel.send(`🏆 <@${mention.id}> qualified.`);
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament)
    return interaction.reply({ content: "No tournament.", ephemeral: true });

  if (interaction.customId === "register") {
    if (interaction.replied || interaction.deferred) return;

    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(
        id => id !== interaction.user.id
      );
      await interaction.reply({ content: "Unregistered.", ephemeral: true });
    } else {
      if (tournament.players.length >= tournament.maxPlayers)
        return interaction.reply({ content: "Tournament full.", ephemeral: true });

      tournament.players.push(interaction.user.id);
      await interaction.reply({ content: "Registered.", ephemeral: true });
    }

    try {
      const channel = await client.channels.fetch(tournament.channelId);
      const message = await channel.messages.fetch(tournament.messageId);
      await message.edit({ embeds: [registrationEmbed()] });
    } catch {}
  }

  if (interaction.customId === "start") {
    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    await interaction.update({
      embeds: [bracketEmbed()],
      components: []
    });
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);






