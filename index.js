// 📦 Imports
const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  AttachmentBuilder
} = require("discord.js");
const fs = require("fs");
const express = require("express");
const config = require("./config.json");

// 🌐 KeepAlive Server
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000, () => console.log("✅ KeepAlive server running on port 3000"));

// 🤖 Client Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

console.log("🚀 Bot starting...");

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("Tickets For Wallah Selling", { type: 3 });

  const commands = [
    new SlashCommandBuilder()
      .setName("ticket")
      .setDescription("Open the ticket panel"),
    new SlashCommandBuilder()
      .setName("sendpanel")
      .setDescription("Send the main ticket creation panel")
  ].map(cmd => cmd.toJSON());

  try {
    console.log("📤 Registering slash commands...");
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const embed = new EmbedBuilder()
      .setTitle("Shop & Support Tickets")
      .setDescription("To create a ticket, click the button below!")
      .setColor("#000000");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket-panel-button")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    if (interaction.commandName === "sendpanel") {
      await interaction.reply({ content: "✅ Panel sent!", ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    } else if (interaction.commandName === "ticket") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket-select")
        .setPlaceholder("Select a reason")
        .addOptions([
          { label: "Support", description: "Open a support ticket", value: "support" },
          { label: "Shop", description: "Open a shop ticket", value: "shop" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      const embed = new EmbedBuilder()
        .setTitle("Create a Ticket")
        .setDescription("Select a category below to open a ticket.")
        .setColor("#000000")
        .setFooter({ text: "Wallah Selling | Made By Kai" });

      await interaction.reply({ embeds: [embed], components: [row] });
    }
  }

  if (interaction.isButton()) {
    const channel = interaction.channel;

    if (interaction.customId === "ticket-panel-button") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket-select")
        .setPlaceholder("Select a reason")
        .addOptions([
          { label: "Support", description: "Open a support ticket", value: "support" },
          { label: "Shop", description: "Open a shop ticket", value: "shop" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      const embed = new EmbedBuilder()
        .setTitle("Create a Ticket")
        .setDescription("Select a category below to open a ticket.")
        .setColor("#000000")
        .setFooter({ text: "Wallah Selling | Made By Kai" });

      await interaction.reply({ ephemeral: true, embeds: [embed], components: [row] });
    }

    if (interaction.customId === "close-ticket") {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("confirm-close").setLabel("Yes, Close").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("cancel-close").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({ content: "⚠️ Are you sure you want to close this ticket?", components: [confirmRow], ephemeral: true });
    } else if (interaction.customId === "confirm-close") {
      const closedBy = interaction.user;

      const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("transcript-ticket").setLabel("Transcript").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("open-ticket").setLabel("Open").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("delete-ticket").setLabel("Delete").setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle("Ticket Closed")
        .setDescription(`Ticket closed by <@${closedBy.id}>`)
        .setColor("#000000")
        .setFooter({ text: "Wallah Selling | Made By Kai" });

      await interaction.deferUpdate();
      await channel.send({ content: "🎫 Support team ticket controls", embeds: [embed], components: [controlRow] });
    } else if (interaction.customId === "cancel-close") {
      await interaction.reply({ content: "Ticket closure cancelled.", ephemeral: true });
    } else if (interaction.customId === "delete-ticket") {
      if (!interaction.member.roles.cache.has(config.supportRole)) {
        return interaction.reply({ content: "❌ Only support team can delete tickets.", ephemeral: true });
      }
      await channel.send("🕐 Deleting in 5 seconds...");
      setTimeout(() => channel.delete(), 5000);
    } else if (interaction.customId === "open-ticket") {
      if (!interaction.member.roles.cache.has(config.supportRole)) {
        return interaction.reply({ content: "❌ Only support team can reopen tickets.", ephemeral: true });
      }
      const reopenEmbed = new EmbedBuilder()
        .setTitle("Ticket Reopened")
        .setDescription("Ticket has been reopened.")
        .setColor("#000000")
        .setFooter({ text: "Wallah Selling | Made By Kai" });
      await channel.send({ embeds: [reopenEmbed] });
    } else if (interaction.customId === "transcript-ticket") {
      if (!interaction.member.roles.cache.has(config.supportRole)) {
        return interaction.reply({ content: "❌ Only support team can save transcripts.", ephemeral: true });
      }

      let fetchedMessages = [];
      let lastId;
      while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const messages = await channel.messages.fetch(options);
        fetchedMessages.push(...messages.map(m => m));
        if (messages.size !== 100) break;
        lastId = messages.last().id;
      }
      const content = fetchedMessages.reverse().map(m => `${m.author.tag}: ${m.cleanContent}`).join("\n");
      const transcriptChannel = await client.channels.fetch(config.transcriptChannel);
      const buffer = Buffer.from(content, "utf-8");
      const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` });
      await transcriptChannel.send({ files: [attachment] });
      await interaction.reply({ content: "📄 Transcript saved.", ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "ticket-select") {
    const type = interaction.values[0];
    const guild = interaction.guild;
    const member = interaction.member;
    const categoryID = type === "support" ? config.supportCategory : config.shopCategory;
    const existingChannel = guild.channels.cache.find(c => c.name === `${type}-ticket-${member.user.username}`);
    if (existingChannel) return interaction.reply({ content: "You already have a ticket open for this type.", ephemeral: true });

    const channel = await guild.channels.create({
      name: `${type}-ticket-${member.user.username}`,
      type: ChannelType.GuildText,
      parent: categoryID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: config.supportRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const closeBtn = new ButtonBuilder().setCustomId("close-ticket").setLabel("Close").setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(closeBtn);

    const embed = new EmbedBuilder()
      .setTitle("Ticket Opened")
      .setDescription(`Hey <@${member.id}>!\n- <@&${config.supportRole}> will be with you shortly\n- Don't spam or ping or you may receive a warning.\n- By opening this ticket, you automatically agree with <#1357307547589152875>`)
      .setColor("#000000")
      .setFooter({ text: "Wallah Selling | Made By Kai" });

    await channel.send({
      content: `<@${member.id}> **Please Wait,** <@&${config.supportRole}> **Will Assist You Soon.**`,
      embeds: [embed],
      components: [row]
    });
    await interaction.reply({ content: `Your ticket has been created: ${channel}`, ephemeral: true });
  }
});

client.login(process.env.TOKEN)
  .then(() => console.log("🔐 Login successful!"))
  .catch((err) => console.error("❌ Login failed:", err));
