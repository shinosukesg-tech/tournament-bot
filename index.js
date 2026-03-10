require("dotenv").config();
const express = require("express");
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes,
} = require("discord.js");
const fs = require("fs");

/* ================= UPTIME ================= */
const app = express();
app.get("/", (req, res) => res.send("Bot is Online!"));
// Use 0.0.0.0 to ensure Render can bind to the port correctly
app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
    console.log("Web server is running.");
});

/* ================= DISCORD CLIENT ================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = "!";
const MOD_ROLE = "Moderator";

/* ================= ASSETS ================= */
const CHECK = "<:check:1480513506871742575>";
const CROSS = "<:sg_cross:1480513567655592037>";
const VS = "<:VS:1477014161484677150>";
const BRACKET_IMG = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";
const FOOTER_IMG = "https://cdn.discordapp.com/attachments/1471952333209604239/1480640926543118426/image0.jpg";

/* ================= DATA MANAGEMENT ================= */
const tournamentFile = "./tournament.json";

function load() {
    try {
        if (!fs.existsSync(tournamentFile)) return {};
        const raw = fs.readFileSync(tournamentFile);
        return JSON.parse(raw);
    } catch (e) {
        console.error("Error loading file:", e);
        return {};
    }
}

function save(data) {
    fs.writeFileSync(tournamentFile, JSON.stringify(data, null, 2));
}

let data = load();
let players = data.players || [];
let matches = data.matches || [];
let winners = data.winners || [];
let round = data.round || 1;
let maxPlayers = data.maxPlayers || 16;

function footer() {
    const time = new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
    return { text: `ShinosukeSG | ${time} IST`, iconURL: FOOTER_IMG };
}

/* ================= SLASH COMMANDS REGISTRATION ================= */
client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder().setName("start").setDescription("Start the tournament"),
        new SlashCommandBuilder().setName("qual").setDescription("Qualify player").addUserOption(o => o.setName("player").setDescription("Player").setRequired(true)),
        new SlashCommandBuilder().setName("next").setDescription("Next round"),
        new SlashCommandBuilder().setName("code").setDescription("Send room code").addStringOption(o => o.setName("room").setDescription("Room code").setRequired(true)).addUserOption(o => o.setName("p1").setDescription("Player 1").setRequired(true)).addUserOption(o => o.setName("p2").setDescription("Player 2").setRequired(true))
    ].map(c => c.toJSON());

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log("Slash commands loaded");
    } catch (error) {
        console.error(error);
    }
});

/* ================= LOGIC FUNCTIONS ================= */

async function sendBracket(channel) {
    let desc = "";
    for (let i = 0; i < matches.length; i++) {
        let p1 = matches[i].p1 === "BYE" ? "BYE" : (await client.users.fetch(matches[i].p1).catch(() => ({ username: "Unknown" }))).username;
        let p2 = matches[i].p2 === "BYE" ? "BYE" : (await client.users.fetch(matches[i].p2).catch(() => ({ username: "Unknown" }))).username;
        desc += `**Match ${i + 1}**\n${p1} ${VS} ${p2}\n\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🏆 Tournament - Round ${round}`)
        .setDescription(desc || "No matches scheduled.")
        .setImage(BRACKET_IMG)
        .setFooter(footer())
        .setColor("#5865F2");

    channel.send({ embeds: [embed] });
}

async function nextRound(channel) {
    if (winners.length === 1) {
        let first = await client.users.fetch(winners[0]);
        const embed = new EmbedBuilder()
            .setTitle("🏆 Tournament Winner")
            .setThumbnail(first.displayAvatarURL())
            .setDescription(`🥇 **${first.username}**`)
            .setFooter(footer())
            .setColor("#FFD700");

        channel.send({ embeds: [embed] });

        players = []; matches = []; winners = []; round = 1;
        save({ players, matches, winners, round, maxPlayers });
        return;
    }

    players = [...winners];
    winners = [];
    matches = [];
    round++;

    for (let i = 0; i < players.length; i += 2) {
        matches.push({ p1: players[i], p2: players[i + 1] || "BYE" });
    }

    save({ players, matches, winners, round, maxPlayers });
    sendBracket(channel);
}

/* ================= MESSAGE COMMANDS ================= */
client.on("messageCreate", async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "start") {
        if (players.length < 2) return message.channel.send("Not enough players registered.");
        matches = [];
        let shuffled = [...players].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length; i += 2) {
            matches.push({ p1: shuffled[i], p2: shuffled[i + 1] || "BYE" });
        }
        save({ players, matches, winners, round, maxPlayers });
        sendBracket(message.channel);
    }

    if (cmd === "qual") {
        let user = message.mentions.users.first();
        if (!user) return;
        winners.push(user.id);
        message.react("✅");
        if (winners.length === matches.length) {
            setTimeout(() => nextRound(message.channel), 5000);
        }
    }

    if (cmd === "next") nextRound(message.channel);

    if (cmd === "code") {
        let code = args[0];
        let p1 = message.mentions.users.first();
        let p2 = message.mentions.users.at(1); // Improved logic for second mention
        if (!code || !p1 || !p2) return;

        const embed = new EmbedBuilder()
            .setTitle("🎮 Match Room Code")
            .setDescription(`${p1.username} ${VS} ${p2.username}\n\nRoom Code\n\`\`\`\n${code}\n\`\`\``)
            .setFooter(footer());
        message.channel.send({ embeds: [embed] });
    }
});

/* ================= INTERACTION COMMANDS ================= */
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "start") {
        if (players.length < 2) return interaction.reply("Not enough players.");
        // Re-using logic
        matches = [];
        let shuffled = [...players].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length; i += 2) {
            matches.push({ p1: shuffled[i], p2: shuffled[i + 1] || "BYE" });
        }
        save({ players, matches, winners, round, maxPlayers });
        await interaction.reply("Tournament started!");
        sendBracket(interaction.channel);
    }

    if (interaction.commandName === "qual") {
        let user = interaction.options.getUser("player");
        winners.push(user.id);
        await interaction.reply(`${user.username} qualified!`);
        if (winners.length === matches.length) {
            setTimeout(() => nextRound(interaction.channel), 5000);
        }
    }

    if (interaction.commandName === "next") {
        await interaction.reply("Moving to next round...");
        nextRound(interaction.channel);
    }

    if (interaction.commandName === "code") {
        let code = interaction.options.getString("room");
        let p1 = interaction.options.getUser("p1");
        let p2 = interaction.options.getUser("p2");
        const embed = new EmbedBuilder()
            .setTitle("🎮 Match Room Code")
            .setDescription(`${p1.username} ${VS} ${p2.username}\n\nRoom Code\n\`\`\`\n${code}\n\`\`\``)
            .setFooter(footer());
        interaction.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);
