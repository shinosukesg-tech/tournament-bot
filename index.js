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

const STAFF_ROLE="1476446112675004640"
const GUILD_ID="947185082643415140" // ✅ FIXED

const REGISTER_IMG="https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png"
const BRACKET_IMG="https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png"
const FOOTER_IMG="https://cdn.discordapp.com/attachments/1427721502698246195/1485228532442337401/IMG-20260315-WA0031.jpg"

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
msgId:null
})

/* ================= CLIENT ================= */

const client=new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent // ✅ Added for prefix commands
]
})

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

/* ================= BRACKET ================= */

async function createBracket(channel){

tournament.started=true
tournament.matches=[]
tournament.qualified=[]

let arr=[...tournament.players].sort(()=>Math.random()-0.5)

for(let i=0;i<arr.length;i+=2){
if(!arr[i+1]) continue
tournament.matches.push({p1:arr[i],p2:arr[i+1]})
}

saveJSON("./tournament.json",tournament)
sendBracket(channel)
}

async function sendBracket(channel){

let msg=await channel.messages.fetch(tournament.msgId).catch(()=>null)
if(!msg) return

let text=""

for(const [i,m] of tournament.matches.entries()){
let p1=await client.users.fetch(m.p1).catch(()=>null)
let p2=await client.users.fetch(m.p2).catch(()=>null)

if(!p1||!p2) continue

text+=`Match ${i+1}\n${p1.username} <:VS:1477014161484677150> ${p2.username}\n\n`
}

await msg.edit({
embeds:[
new EmbedBuilder()
.setTitle(`🏆 Round ${tournament.round}`)
.setDescription(text || "No matches")
.setImage(BRACKET_IMG)
]
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

await renderPanel(interaction.channel)

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

renderPanel(interaction.channel)
}

if(interaction.customId==="start"){

if(!interaction.member.roles.cache.has(STAFF_ROLE))
return interaction.reply({content:"Staff only",ephemeral:true})

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

// Auto delete non-bot messages (except commands)
if(!message.content.startsWith("!")) {
setTimeout(()=>message.delete().catch(()=>{}),1000)
return
}

const args = message.content.slice(1).trim().split(/ +/)
const command = args.shift().toLowerCase()

try {
    // !tour <players> <server> <map> [p1] [p2] [p3]
    if(command === "tour") {
        if(!message.member.roles.cache.has(STAFF_ROLE)) {
            return message.reply({content: "Staff only", ephemeral: true}).catch(()=>{})
        }
        
        if(args.length < 3) {
            return message.reply("Usage: `!tour <players> <server> <map> [p1] [p2] [p3]`").catch(()=>{})
        }

        const max = parseInt(args[0])
        if(isNaN(max)) return message.reply("Invalid player count").catch(()=>{})

        tournament={
            players:[],
            matches:[],
            qualified:[],
            round:1,
            max:max,
            server:args[1],
            map:args[2],
            rewards:[
                args[3] || "",
                args[4] || "",
                args[5] || ""
            ],
            started:false,
            msgId:null
        }

        saveJSON("./tournament.json",tournament)
        await renderPanel(message.channel)
        return message.reply("✅ Panel created").catch(()=>{})
    }

    // !qual <@user>
    if(command === "qual") {
        if(!message.member.roles.cache.has(STAFF_ROLE)) {
            return message.reply({content: "Staff only", ephemeral: true}).catch(()=>{})
        }

        const user = message.mentions.users.first()
        if(!user) return message.reply("Mention a user").catch(()=>{})

        if(!tournament.qualified.includes(user.id))
            tournament.qualified.push(user.id)

        if(tournament.qualified.length===tournament.matches.length){

            tournament.players=[...tournament.qualified]
            tournament.qualified=[]
            tournament.round++

            saveJSON("./tournament.json",tournament)

            createBracket(message.channel)
        }

        return message.reply(`<:check:1480513506871742575> ${user.username}`).catch(()=>{})
    }

    // !code <@p1> <@p2> <code>
    if(command === "code") {
        if(!message.member.roles.cache.has(STAFF_ROLE)) {
            return message.reply({content: "Staff only", ephemeral: true}).catch(()=>{})
        }

        if(args.length < 3) {
            return message.reply("Usage: `!code <@p1> <@p2> <code>`").catch(()=>{})
        }

        const p1 = message.mentions.users.first()
        const p2 = message.mentions.users.last()
        const code = args.slice(2).join(" ")

        if(!p1 || !p2) return message.reply("Mention 2 players").catch(()=>{})

        const msgContent = `
🎮 MATCH ROOM DETAILS

Room Code:
\`\`\`${code}\`\`\`

🌐 ${tournament.server}
🗺 ${tournament.map}
`

        p1.send(msgContent).catch(()=>{})
        p2.send(msgContent).catch(()=>{})

        return message.reply("📩 Sent").catch(()=>{})
    }

    // !delm
    if(command === "delm") {
        if(!message.member.roles.cache.has(STAFF_ROLE)) {
            return message.reply({content: "Staff only", ephemeral: true}).catch(()=>{})
        }

        tournament={players:[],matches:[],qualified:[],round:1,max:0}
        saveJSON("./tournament.json",tournament)

        return message.reply("Deleted").catch(()=>{})
    }

} catch(err) {
    console.log(err)
    message.reply("Error").catch(()=>{})
}
})

/* ================= READY ================= */

client.once("ready",()=>{
console.log(`Logged in as ${client.user.tag}`)
console.log("✅ Prefix commands ready!")
})

client.login(process.env.TOKEN)
