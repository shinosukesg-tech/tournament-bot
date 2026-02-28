require("dotenv").config();

/* ================= UPTIME SERVER ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT);
/* ================================================= */

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

const isStaff = (member) =>
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const isMod = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === MOD_ROLE);

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} Online`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ================= HELP ================= */
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🏆 Tournament Bot Help")
      .addFields(
        { name: "🎮 Tournament",
          value:
          "`;1v1 <players> <server> <map>`\n" +
          "`;qual @player`\n" +
          "`;qual bye`\n" +
          "`;bye`"
        },
        { name: "🛡 Moderation",
          value:
          "`;purge <amount>`\n" +
          "`;mute @user 1h`\n" +
          "`;ban @user`"
        },
        { name: "🎫 Tickets",
          value:
          "`;ticketpanel add #channel`"
        }
      )
      .setTimestamp();

    return msg.channel.send({ embeds: [embed] });
  }

  /* ================= CREATE TOURNAMENT ================= */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const max = parseInt(args[0]);
    if (!max) return;

    tournament = {
      maxPlayers: max,
      players: [],
      matches: []
    };

    const embed = new EmbedBuilder()
      .setTitle("🏆 1v1 Tournament")
      .setDescription(`Players: 0/${max}`)
      .setColor("Green");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register (0/" + max + ")")
        .setStyle(ButtonStyle.Primary)
    );

    const message = await msg.channel.send({
      embeds: [embed],
      components: [row]
    });

    tournament.messageId = message.id;
  }

  /* ================= QUALIFY ================= */
  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;
    if (!tournament) return;

    if (args[0]?.toLowerCase() === "bye") return;

    const member = msg.mentions.members.first();
    if (!member) return;

    const winnerEmbed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🏆 TOURNAMENT WINNER 🏆")
      .setDescription(`${member} is the Champion!`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    msg.channel.send({ embeds: [winnerEmbed] });

    tournament = null;
  }

  /* ================= PURGE ================= */
  if (cmd === "purge") {
    if (!isMod(msg.member)) return;
    const amount = parseInt(args[0]);
    if (!amount) return;
    await msg.channel.bulkDelete(amount, true).catch(()=>{});
  }

  /* ================= BAN ================= */
  if (cmd === "ban") {
    if (!isMod(msg.member)) return;
    const member = msg.mentions.members.first();
    if (!member) return;
    await member.ban().catch(()=>{});
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "register") {
    if (!tournament) return;

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered!", ephemeral: true });

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "Tournament full!", ephemeral: true });

    tournament.players.push(interaction.user.id);

    const channel = interaction.channel;
    const message = await channel.messages.fetch(tournament.messageId);

    const count = tournament.players.length;

    const embed = EmbedBuilder.from(message.embeds[0])
      .setDescription(`Players: ${count}/${tournament.maxPlayers}`);

    const button = new ButtonBuilder()
      .setCustomId("register")
      .setLabel(`Register (${count}/${tournament.maxPlayers})`)
      .setStyle(count >= tournament.maxPlayers ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(count >= tournament.maxPlayers);

    const row = new ActionRowBuilder().addComponents(button);

    await message.edit({ embeds: [embed], components: [row] });

    interaction.reply({ content: "Registered!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
