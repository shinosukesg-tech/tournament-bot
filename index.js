require("dotenv").config()

const express=require("express")
const app=express()
app.get("/",(req,res)=>res.send("Bot Running"))
app.listen(process.env.PORT||3000)

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle
}=require("discord.js")

const fs=require("fs")

/* ================= CONFIG ================= */

const TOURNAMENT_ORGANISER_ROLE = "1485872542391730186"
const TOURNAMENT_STAFF_ROLE = "1485872228917575800"
const GUILD_ID="947185082643415140"

const REGISTER_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1427721502698246195/1485228532442337401/IMG-20260315-WA0031.jpg"
const WINNER_IMG="https://cdn.discordapp.com/attachments/1427721502698246195/1485228532442337401/IMG-20260315-WA0031.jpg"

/* ================= JSON ================= */

function loadJSON(file,def){
try{return JSON.parse(fs.readFileSync(file))}
catch{return def}
}
function saveJSON(file,data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

let tournament=loadJSON("./tournament.json",{
players:[],
matches:[],
qualified:[],
round:1,
max:0,
server:"",
map:"",
rewards:[],
started:false,
msgId:null,
winner:null
})

/* ================= CLIENT ================= */

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
})

/* ================= HELPERS ================= */

function hasTournamentOrganiserRole(member) {
    return member.roles.cache.has(TOURNAMENT_ORGANISER_ROLE)
}

function hasTournamentStaffRole(member) {
    return member.roles.cache.has(TOURNAMENT_STAFF_ROLE)
}

function hasTournamentManagementRole(member) {
    return hasTournamentOrganiserRole(member) || hasTournamentStaffRole(member)
}

function isFinalRound() {
    return tournament.matches.length === 1 && tournament.qualified.length === 0
}

function updateBracketDisplay(channel) {
    if(tournament.started && tournament.matches.length > 0) {
        sendBracket(channel)
    } else {
        renderPanel(channel)
    }
}

/* ================= PANEL ================= */

async function renderPanel(channel){

const embed=new EmbedBuilder()
.setTitle("🏆 Shin Tours 1v1")
.setDescription(`
🌐 ${tournament.server}
🗺 ${tournament.map}

👥 ${tournament.players.length}/${tournament.max}

${tournament.rewards[0]?`🥇 ${tournament.rewards[0]}\n`:""}
${tournament.rewards[1]?`🥈 ${tournament.rewards[1]}\n`:""}
${tournament.rewards[2]?`🥉 ${tournament.rewards[2]}\n`:""}
`)
.setImage(REGISTER_IMG)
.setFooter({text:"Join The Fun | ShinosukeSG",iconURL:FOOTER_IMG})

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Success).setDisabled(tournament.started),
new ButtonBuilder().setCustomId("players").setLabel(`Players: ${tournament.players.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
new ButtonBuilder().setCustomId("start").setLabel("Start").setStyle(ButtonStyle.Danger).setDisabled(tournament.started)
)

let msg=null

if(tournament.msgId){
msg=await channel.messages.fetch(tournament.msgId).catch(()=>null)
}

if(msg){
await msg.edit({embeds:[embed],components:[row]})
}else{
msg=await channel.send({embeds:[embed],components:[row]})
tournament.msgId=msg.id
}

saveJSON("./tournament.json",tournament)
}

/* ================= BRACKET SYSTEM ================= */

async function createBracket(channel){

tournament.started=true
tournament.matches=[]
tournament.qualified=[]
tournament.winner = null

let arr=[...tournament.players].sort(()=>Math.random()-0.5)

for(let i=0;i<arr.length;i+=2){
if(!arr[i+1]) continue
tournament.matches.push({p1:arr[i],p2:arr[i+1],code:"",completed:false})
}

saveJSON("./tournament.json",tournament)
await sendBracket(channel)
}

async function sendBracket(channel){

let msg=await channel.messages.fetch(tournament.msgId).catch(()=>null)
if(!msg) return

// Check if tournament is finished
if(tournament.winner) {
    const winnerUser = await client.users.fetch(tournament.winner).catch(()=>null)
    if(winnerUser) {
        const winnerEmbed = new EmbedBuilder()
        .setTitle(`🏆 CHAMPION!`)
        .setDescription(`**${winnerUser.username}** is the winner!`)
        .setThumbnail(winnerUser.displayAvatarURL({dynamic:true}))
        .addFields(
            {name:"🥇 1st Place", value:winnerUser.username, inline:true},
            ...(tournament.rewards[0] ? [{name:"Prize", value:tournament.rewards[0], inline:true}] : [])
        )
        .setImage(WINNER_IMG)
        .setFooter({text:`Round ${tournament.round} | ShinosukeSG`, iconURL:FOOTER_IMG})
        
        return msg.edit({embeds:[winnerEmbed], components:[]})
    }
}

// Regular bracket display
let text = `**Round ${tournament.round}** (${tournament.qualified.length}/${tournament.matches.length} matches completed)\n\n`

for(const [i,m] of tournament.matches.entries()){
let p1=await client.users.fetch(m.p1).catch(()=>null)
let p2=await client.users.fetch(m.p2).catch(()=>null)

if(!p1||!p2) continue

const status = m.completed ? "✅" : `⏳ ${m.code || "No code"}`
text+=`**Match ${i+1}:** ${p1.username} <:VS:1477014161484677150> ${p2.username}\n${status}\n\n`
}

const embed=new EmbedBuilder()
.setTitle(`🏆 Tournament Bracket`)
.setDescription(text)
.setImage(BRACKET_IMG)
.setFooter({text:"Use !code <code> @p1 @p2 | !qual @winner",iconURL:FOOTER_IMG})

await msg.edit({
embeds:[embed],
components:[] // Remove buttons during bracket phase
})
}

/* ================= INTERACTIONS ================= */

client.on("interactionCreate",async interaction=>{
try{

if(interaction.isButton()){

if(interaction.customId==="register"){

if(!tournament.players.includes(interaction.user.id)){

tournament.players.push(interaction.user.id)
saveJSON("./tournament.json",tournament)

await interaction.reply({content:"<:check:1480513506871742575> Registered",ephemeral:true})

}else{

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("confirm_unreg").setLabel("Unregister").setStyle(ButtonStyle.Danger)
)

return interaction.reply({
content:"Do you want to unregister?",
components:[row],
ephemeral:true
})
}

await updateBracketDisplay(interaction.channel)

if(tournament.players.length===tournament.max){
setTimeout(()=>{
if(!tournament.started){
createBracket(interaction.channel)
}
},5000)
}

}

if(interaction.customId==="confirm_unreg"){

tournament.players=tournament.players.filter(p=>p!==interaction.user.id)
saveJSON("./tournament.json",tournament)

await interaction.update({content:"<:sg_cross:1480513567655592037> Unregistered",components:[]})

updateBracketDisplay(interaction.channel)
}

if(interaction.customId==="start"){

if(!hasTournamentManagementRole(interaction.member))
return interaction.reply({content:"Tournament Staff/Organiser only",ephemeral:true})

createBracket(interaction.channel)
await interaction.reply({content:"Started",ephemeral:true})
}

}

}catch(err){
console.log(err)
if(!interaction.replied){
interaction.reply({content:"Error",ephemeral:true}).catch(()=>{})
}
}
})

/* ================= PREFIX COMMANDS ================= */

client.on("messageCreate", async message => {
if(message.author.bot) return
if(!message.content.startsWith("!")) return

// Auto delete non-bot, non-command messages
if(!message.content.startsWith("!")) {
setTimeout(()=>message.delete().catch(()=>{}),1000)
return
}

const args = message.content.slice(1).trim().split(/ +/)
const command = args.shift().toLowerCase()

try {
    // !tour <players> <server> <map> [p1] [p2] [p3]
    if(command === "tour") {
        if(!hasTournamentOrganiserRole(message.member)) {
            return message.reply("❌ **Tournament Organiser role required**").catch(()=>{})
        }
        
        if(args.length < 3) {
            return message.reply("**Usage:** `!tour <players> <server> <map> [p1] [p2] [p3]`").catch(()=>{})
        }

        const max = parseInt(args[0])
        if(isNaN(max) || max <= 0) return message.reply("❌ Invalid player count").catch(()=>{})

        tournament={
            players:[],
            matches:[],
            qualified:[],
            round:1,
            max:max,
            server:args[1],
            map:args[2],
            rewards:[args[3]||"", args[4]||"", args[5]||""],
            started:false,
            msgId:null,
            winner:null
        }

        saveJSON("./tournament.json",tournament)
        await renderPanel(message.channel)
        return message.reply(`✅ **Tournament created!** (${max} players)`).catch(()=>{})
    }

    // !code <code> @p1 @p2
    if(command === "code") {
        if(!hasTournamentManagementRole(message.member)) {
            return message.reply("❌ **Tournament Staff/Organiser role required**").catch(()=>{})
        }

        if(!tournament.started) return message.reply("❌ **Tournament not started**").catch(()=>{})

        const code = args[0]
        const p1 = message.mentions.users.first()
        const p2 = message.mentions.users.last()

        if(!code || !p1 || !p2 || p1.id === p2.id) {
            return message.reply("**Usage:** `!code <code> @player1 @player2`\n**Example:** `!code ROOM123 @user1 @user2`").catch(()=>{})
        }

        // Find and update match
        const matchIndex = tournament.matches.findIndex(m => 
            (m.p1 === p1.id && m.p2 === p2.id) || 
            (m.p1 === p2.id && m.p2 === p1.id)
        )

        if(matchIndex === -1) {
            return message.reply("❌ **Match not found**").catch(()=>{})
        }

        tournament.matches[matchIndex].code = code

        const msgContent = `
🎮 **MATCH ROOM**

**Room Code:** \`${code}\`
🌐 **${tournament.server}**
🗺 **${tournament.map}**
`

        p1.send(msgContent).catch(()=>console.log(`Failed to DM ${p1.username}`))
        p2.send(msgContent).catch(()=>console.log(`Failed to DM ${p2.username}`))

        saveJSON("./tournament.json",tournament)
        await updateBracketDisplay(message.channel)
        return message.reply(`📩 **Code \`${code}\` sent to ${p1.username} & ${p2.username}**`).catch(()=>{})
    }

    // !qual @player
    if(command === "qual") {
        if(!hasTournamentManagementRole(message.member)) {
            return message.reply("❌ **Tournament Staff/Organiser role required**").catch(()=>{})
        }

        if(!tournament.started) return message.reply("❌ **Tournament not started**").catch(()=>{})

        const winner = message.mentions.users.first()
        if(!winner) return message.reply("❌ **Mention the winner**\n**Usage:** `!qual @winner`").catch(()=>{})

        // FINAL ROUND - 2 players left
        if(isFinalRound() && tournament.matches[0]) {
            const finalMatch = tournament.matches[0]
            if(finalMatch.p1 !== winner.id && finalMatch.p2 !== winner.id) {
                return message.reply("❌ **Player not in final match**").catch(()=>{})
            }

            // Set winner and end tournament
            tournament.winner = winner.id
            saveJSON("./tournament.json",tournament)
            await updateBracketDisplay(message.channel)
            return message.reply(`🏆 **${winner.username} IS THE CHAMPION!** 🎉`).catch(()=>{})
        }

        // Regular qualification
        if(!tournament.qualified.includes(winner.id)) {
            tournament.qualified.push(winner.id)
        }

        // Check if round is complete
        if(tournament.qualified.length === tournament.matches.length) {
            // Move to next round
            tournament.players = [...tournament.qualified]
            tournament.qualified = []
            tournament.round++
            tournament.matches = []
            
            // Create next round matches
            let arr = [...tournament.players].sort(()=>Math.random()-0.5)
            for(let i=0;i<arr.length;i+=2){
                if(!arr[i+1]) continue
                tournament.matches.push({p1:arr[i],p2:arr[i+1],code:"",completed:false})
            }
        }

        saveJSON("./tournament.json",tournament)
        await updateBracketDisplay(message.channel)
        return message.reply(`✅ **${winner.username} qualified for next round!**`).catch(()=>{})
    }

    // !delm
    if(command === "delm") {
        if(!hasTournamentManagementRole(message.member)) {
            return message.reply("❌ **Tournament Staff/Organiser role required**").catch(()=>{})
        }

        tournament={
            players:[],matches:[],qualified:[],round:1,max:0,server:"",map:"",rewards:[],started:false,msgId:null,winner:null
        }
        saveJSON("./tournament.json",tournament)
        return message.reply("🗑️ **Tournament reset!**").catch(()=>{})
    }

} catch(err) {
    console.error(err)
    message.reply("❌ **An error occurred!**").catch(()=>{})
}
})

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`✅ Logged in as ${client.user.tag}`)
console.log(`✅ Tournament Organiser: ${TOURNAMENT_ORGANISER_ROLE}`)
console.log(`✅ Tournament Staff: ${TOURNAMENT_STAFF_ROLE}`)
})

client.login(process.env.TOKEN)
