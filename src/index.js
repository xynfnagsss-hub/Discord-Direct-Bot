import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const prefix = process.env.DISCORD_PREFIX || '!';
const guildId = process.env.DISCORD_GUILD_ID;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warningsPath = path.join(rootDir, 'data/warnings.json');
const eventLocksDir = path.join(rootDir, 'data/event-locks');
const colors = {
  info: 0x5865f2,
  success: 0x2ecc71,
  warning: 0xf1c40f,
  danger: 0xe74c3c,
  neutral: 0x2f3136,
};

if (!token) {
  console.error('Missing DISCORD_TOKEN secret.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
});

const slashCommands = [
  new SlashCommandBuilder().setName('ping').setDescription('Check if the bot is online'),
  new SlashCommandBuilder().setName('help').setDescription('Show moderation commands'),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a server member')
    .addUserOption((option) => option.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a server member')
    .addUserOption((option) => option.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member for a number of minutes')
    .addUserOption((option) => option.setName('user').setDescription('Member to timeout').setRequired(true))
    .addIntegerOption((option) => option.setName('minutes').setDescription('Timeout duration in minutes').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a member timeout')
    .addUserOption((option) => option.setName('user').setDescription('Member to remove timeout from').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for removing timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages')
    .addIntegerOption((option) => option.setName('amount').setDescription('Messages to delete, 1-100').setMinValue(1).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption((option) => option.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Warning reason').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View a member’s warnings')
    .addUserOption((option) => option.setName('user').setDescription('Member to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear a member’s warnings')
    .addUserOption((option) => option.setName('user').setDescription('Member to clear warnings for').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set channel slowmode')
    .addIntegerOption((option) => option.setName('seconds').setDescription('Slowmode delay, 0-21600').setMinValue(0).setMaxValue(21600).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock the current text channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock the current text channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Post a ticket creation panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
];

function createEmbed(title, description, color = colors.info) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `Prefix: ${prefix}` })
    .setTimestamp();
}

function createHelpPayload() {
  const embed = createEmbed(
    'Moderation Command Center',
    'Use slash commands or prefix commands. Every command supports `/command` and `!command` where available.',
    colors.info,
  )
    .addFields(
      {
        name: 'Member moderation',
        value: [
          '`/kick user reason` or `!kick @user reason`',
          '`/ban user reason` or `!ban @user reason`',
          '`/timeout user minutes reason` or `!timeout @user 10m reason`',
          '`/untimeout user reason` or `!untimeout @user reason`',
        ].join('\n'),
      },
      {
        name: 'Warnings',
        value: [
          '`/warn user reason` or `!warn @user reason`',
          '`/warnings user` or `!warnings @user`',
          '`/clearwarnings user` or `!clearwarnings @user`',
        ].join('\n'),
      },
      {
        name: 'Channel tools',
        value: [
          '`/purge amount` or `!purge 25`',
          '`/slowmode seconds` or `!slowmode 10`',
          '`/lock` or `!lock`',
          '`/unlock` or `!unlock`',
          '`/tickets` or `!tickets`',
        ].join('\n'),
      },
      {
        name: 'Utility',
        value: '`/ping` or `!ping`\n`/help` or `!help`',
      },
    );

  return { embeds: [embed] };
}

async function loadWarnings() {
  try {
    const raw = await fs.readFile(warningsPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveWarnings(warnings) {
  await fs.mkdir(path.dirname(warningsPath), { recursive: true });
  await fs.writeFile(warningsPath, `${JSON.stringify(warnings, null, 2)}\n`);
}

async function claimEvent(eventId) {
  await fs.mkdir(eventLocksDir, { recursive: true });
  const safeId = eventId.replace(/[^a-zA-Z0-9:-]/g, '_');
  const lockPath = path.join(eventLocksDir, `${safeId}.lock`);
  try {
    const handle = await fs.open(lockPath, 'wx');
    await handle.writeFile(String(Date.now()));
    await handle.close();
    setTimeout(() => fs.rm(lockPath, { force: true }).catch(() => {}), 300000);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

function warningKey(guildIdValue, userId) {
  return `${guildIdValue}:${userId}`;
}

function parseDuration(input) {
  const match = String(input || '').trim().match(/^(\d+)(s|m|h|d)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] || 'm').toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}

function hasPermission(member, permission) {
  return member?.permissions?.has(permission) || false;
}

function canModerate(actor, target, botMember) {
  if (!target || !actor || !botMember) return 'I could not find that member.';
  if (target.id === actor.id) return 'You cannot use that command on yourself.';
  if (target.id === botMember.id) return 'I cannot moderate myself.';
  if (target.roles.highest.position >= actor.roles.highest.position && actor.id !== actor.guild.ownerId) return 'That member has an equal or higher role than you.';
  if (target.roles.highest.position >= botMember.roles.highest.position) return 'My role is not high enough to moderate that member.';
  return null;
}

async function fetchMember(guild, value) {
  const id = String(value || '').match(/^<@!?(\d+)>$/)?.[1] || String(value || '').match(/^(\d{17,20})$/)?.[1];
  if (!id) return null;
  return guild.members.fetch(id).catch(() => null);
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  const body = slashCommands.map((command) => command.toJSON());
  const appId = client.user.id;
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
    console.log(`Registered slash commands for guild ${guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(appId), { body });
    console.log('Registered global slash commands. Global commands can take a little while to appear.');
  }
}

function responsePayload(payload, ephemeral = true) {
  const data = typeof payload === 'string'
    ? { embeds: [createEmbed('Bot Response', payload, colors.info)] }
    : payload instanceof EmbedBuilder
      ? { embeds: [payload] }
      : payload;
  return { ...data, ephemeral };
}

function publicPayload(payload) {
  return typeof payload === 'string'
    ? { embeds: [createEmbed('Bot Response', payload, colors.info)] }
    : payload instanceof EmbedBuilder
      ? { embeds: [payload] }
    : payload;
}

async function reply(target, content, ephemeral = true) {
  if (target.deferred || target.replied) return target.followUp(responsePayload(content, ephemeral));
  if (target.isChatInputCommand?.()) return target.reply(responsePayload(content, ephemeral));
  return target.reply(publicPayload(content));
}

async function requireGuild(target) {
  if (target.guild) return true;
  await reply(target, 'This command only works inside a server.');
  return false;
}

async function handleKick(target, actor, guild, member, reason) {
  if (!hasPermission(actor, PermissionFlagsBits.KickMembers)) return reply(target, 'You need Kick Members permission.');
  const problem = canModerate(actor, member, guild.members.me);
  if (problem) return reply(target, problem);
  await member.kick(reason || 'No reason provided');
  return reply(target, `Kicked ${member.user.tag}. Reason: ${reason || 'No reason provided'}`);
}

async function handleBan(target, actor, guild, member, reason) {
  if (!hasPermission(actor, PermissionFlagsBits.BanMembers)) return reply(target, 'You need Ban Members permission.');
  const problem = canModerate(actor, member, guild.members.me);
  if (problem) return reply(target, problem);
  await member.ban({ reason: reason || 'No reason provided' });
  return reply(target, `Banned ${member.user.tag}. Reason: ${reason || 'No reason provided'}`);
}

async function handleTimeout(target, actor, guild, member, durationMs, reason) {
  if (!hasPermission(actor, PermissionFlagsBits.ModerateMembers)) return reply(target, 'You need Moderate Members permission.');
  if (!durationMs || durationMs < 1000 || durationMs > 2419200000) return reply(target, 'Use a timeout between 1 second and 28 days.');
  const problem = canModerate(actor, member, guild.members.me);
  if (problem) return reply(target, problem);
  await member.timeout(durationMs, reason || 'No reason provided');
  return reply(target, `Timed out ${member.user.tag}. Reason: ${reason || 'No reason provided'}`);
}

async function handleUntimeout(target, actor, guild, member, reason) {
  if (!hasPermission(actor, PermissionFlagsBits.ModerateMembers)) return reply(target, 'You need Moderate Members permission.');
  const problem = canModerate(actor, member, guild.members.me);
  if (problem) return reply(target, problem);
  await member.timeout(null, reason || 'No reason provided');
  return reply(target, `Removed timeout from ${member.user.tag}.`);
}

async function handlePurge(target, actor, channel, amount) {
  if (!hasPermission(actor, PermissionFlagsBits.ManageMessages)) return reply(target, 'You need Manage Messages permission.');
  if (!channel?.isTextBased?.() || channel.type === ChannelType.DM) return reply(target, 'This command only works in a server text channel.');
  if (!channel.permissionsFor(channel.guild.members.me).has(PermissionFlagsBits.ManageMessages)) return reply(target, 'I need Manage Messages permission in this channel.');
  const deleted = await channel.bulkDelete(amount, true);
  return reply(target, `Deleted ${deleted.size} messages.`);
}

async function handleWarn(target, actor, guild, member, reason) {
  if (!hasPermission(actor, PermissionFlagsBits.ModerateMembers)) return reply(target, 'You need Moderate Members permission.');
  const warnings = await loadWarnings();
  const key = warningKey(guild.id, member.id);
  warnings[key] = warnings[key] || [];
  warnings[key].push({ reason, moderatorId: actor.id, at: new Date().toISOString() });
  await saveWarnings(warnings);
  return reply(target, `Warned ${member.user.tag}. Total warnings: ${warnings[key].length}`);
}

async function handleWarnings(target, actor, guild, member) {
  if (!hasPermission(actor, PermissionFlagsBits.ModerateMembers)) return reply(target, 'You need Moderate Members permission.');
  const warnings = await loadWarnings();
  const list = warnings[warningKey(guild.id, member.id)] || [];
  if (!list.length) return reply(target, `${member.user.tag} has no warnings.`);
  const lines = list.map((item, index) => `${index + 1}. ${item.reason} by <@${item.moderatorId}> on ${new Date(item.at).toLocaleString()}`);
  return reply(target, `Warnings for ${member.user.tag}:\n${lines.join('\n')}`);
}

async function handleClearWarnings(target, actor, guild, member) {
  if (!hasPermission(actor, PermissionFlagsBits.ModerateMembers)) return reply(target, 'You need Moderate Members permission.');
  const warnings = await loadWarnings();
  delete warnings[warningKey(guild.id, member.id)];
  await saveWarnings(warnings);
  return reply(target, `Cleared warnings for ${member.user.tag}.`);
}

async function handleSlowmode(target, actor, channel, seconds) {
  if (!hasPermission(actor, PermissionFlagsBits.ManageChannels)) return reply(target, 'You need Manage Channels permission.');
  if (!channel?.isTextBased?.() || !('setRateLimitPerUser' in channel)) return reply(target, 'This command only works in a server text channel.');
  await channel.setRateLimitPerUser(seconds, `Slowmode set by ${actor.user.tag}`);
  return reply(target, `Slowmode set to ${seconds} seconds.`);
}

async function handleLock(target, actor, channel, locked) {
  if (!hasPermission(actor, PermissionFlagsBits.ManageChannels)) return reply(target, 'You need Manage Channels permission.');
  if (!channel?.isTextBased?.() || !channel.permissionOverwrites) return reply(target, 'This command only works in a server text channel.');
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: locked ? false : null });
  return reply(target, locked ? 'Channel locked.' : 'Channel unlocked.');
}

function buildTicketPanel() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:create')
      .setLabel('Create Ticket')
      .setStyle(ButtonStyle.Primary),
  );

  return {
    embeds: [
      createEmbed(
        'Support Tickets',
        'Need help from staff? Click the button below to open a private ticket channel. Please explain your issue clearly once the ticket opens.',
        colors.info,
      ).addFields(
        { name: 'Privacy', value: 'Only you, staff, and the bot can see your ticket.' },
        { name: 'Before opening', value: 'Have screenshots, user IDs, or details ready if this is a report.' },
      ),
    ],
    components: [row],
  };
}

function buildCloseTicketRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger),
  );
}

async function handleTickets(target, actor, channel) {
  if (!hasPermission(actor, PermissionFlagsBits.ManageChannels)) return reply(target, 'You need Manage Channels permission.');
  if (!channel?.isTextBased?.() || channel.type === ChannelType.DM) return reply(target, 'This command only works in a server text channel.');
  const panel = buildTicketPanel();
  await channel.send(panel);
  return reply(target, 'Ticket panel posted.');
}

function ticketChannelName(user) {
  const cleanName = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18) || 'user';
  return `ticket-${cleanName}`;
}

async function handleTicketButton(interaction) {
  if (!interaction.guild || interaction.customId !== 'ticket:create') return;
  const botMember = interaction.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply(responsePayload(createEmbed('Missing Permission', 'I need Manage Channels permission to create tickets.', colors.danger), true));
  }

  const channels = await interaction.guild.channels.fetch();
  const existing = channels.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name.startsWith(ticketChannelName(interaction.user)) &&
      channel.topic?.includes(`Ticket owner: ${interaction.user.id}`),
  );

  if (existing) {
    return interaction.reply(responsePayload(createEmbed('Ticket Already Open', `You already have an open ticket: ${existing}`, colors.warning), true));
  }

  const parent = interaction.channel?.parent ?? null;
  const channel = await interaction.guild.channels.create({
    name: ticketChannelName(interaction.user),
    type: ChannelType.GuildText,
    parent,
    topic: `Ticket owner: ${interaction.user.id}`,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: botMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  await channel.send({
    embeds: [
      createEmbed(
        'Ticket Opened',
        `${interaction.user}, staff will be with you shortly. Please describe what you need help with.`,
        colors.success,
      ),
    ],
    components: [buildCloseTicketRow()],
  });
  return interaction.reply(responsePayload(`Created your ticket: ${channel}`, true));
}

async function handleCloseTicketButton(interaction) {
  if (!interaction.guild || interaction.customId !== 'ticket:close') return;
  if (interaction.channel?.type !== ChannelType.GuildText || !interaction.channel.topic?.startsWith('Ticket owner:')) {
    return interaction.reply(responsePayload(createEmbed('Not a Ticket', 'This button only works inside ticket channels.', colors.warning), true));
  }

  const ownerId = interaction.channel.topic.replace('Ticket owner:', '').trim();
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isOwner = interaction.user.id === ownerId;
  const isStaff = hasPermission(member, PermissionFlagsBits.ManageChannels);

  if (!isOwner && !isStaff) {
    return interaction.reply(responsePayload(createEmbed('No Permission', 'Only the ticket owner or staff can close this ticket.', colors.danger), true));
  }

  await interaction.reply(responsePayload(createEmbed('Closing Ticket', 'This ticket will close in 5 seconds.', colors.warning), false));
  setTimeout(() => {
    interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(console.error);
  }, 5000);
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}. Prefix is ${prefix}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!(await claimEvent(`interaction:${interaction.id}`))) return;

  if (interaction.isButton()) {
    try {
      if (interaction.customId === 'ticket:close') {
        await handleCloseTicketButton(interaction);
        return;
      }
      await handleTicketButton(interaction);
    } catch (error) {
      console.error(error);
      if (!interaction.replied) await interaction.reply(responsePayload(createEmbed('Ticket Failed', 'Something went wrong while creating your ticket.', colors.danger), true));
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  try {
    if (!(await requireGuild(interaction))) return;
    const actor = await interaction.guild.members.fetch(interaction.user.id);
    const name = interaction.commandName;
    if (name === 'ping') return reply(interaction, createEmbed('Bot Status', 'Online and ready.', colors.success));
    if (name === 'help') return reply(interaction, createHelpPayload());
    if (name === 'kick') return handleKick(interaction, actor, interaction.guild, await interaction.guild.members.fetch(interaction.options.getUser('user', true).id), interaction.options.getString('reason'));
    if (name === 'ban') return handleBan(interaction, actor, interaction.guild, await interaction.guild.members.fetch(interaction.options.getUser('user', true).id), interaction.options.getString('reason'));
    if (name === 'timeout') return handleTimeout(interaction, actor, interaction.guild, await interaction.guild.members.fetch(interaction.options.getUser('user', true).id), interaction.options.getInteger('minutes', true) * 60000, interaction.options.getString('reason'));
    if (name === 'untimeout') return handleUntimeout(interaction, actor, interaction.guild, await interaction.guild.members.fetch(interaction.options.getUser('user', true).id), interaction.options.getString('reason'));
    if (name === 'purge') return handlePurge(interaction, actor, interaction.channel, interaction.options.getInteger('amount', true));
    if (name === 'warn') return handleWarn(interaction, actor, interaction.guild, await interaction.guild.members.fetch(interaction.options.getUser('user', true).id), interaction.options.getString('reason', true));
    if (name === 'warnings') return handleWarnings(interaction, actor, interaction.guild, await interaction.guild.members.fetch(interaction.options.getUser('user', true).id));
    if (name === 'clearwarnings') return handleClearWarnings(interaction, actor, interaction.guild, await interaction.guild.members.fetch(interaction.options.getUser('user', true).id));
    if (name === 'slowmode') return handleSlowmode(interaction, actor, interaction.channel, interaction.options.getInteger('seconds', true));
    if (name === 'lock') return handleLock(interaction, actor, interaction.channel, true);
    if (name === 'unlock') return handleLock(interaction, actor, interaction.channel, false);
    if (name === 'tickets') return handleTickets(interaction, actor, interaction.channel);
  } catch (error) {
    console.error(error);
    await reply(interaction, createEmbed('Command Failed', 'Something went wrong while running that command. Check my permissions and role position.', colors.danger));
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(prefix)) return;
  if (!(await claimEvent(`message:${message.id}`))) return;
  const [rawName, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
  const name = rawName?.toLowerCase();
  if (!name) return;

  try {
    const actor = await message.guild.members.fetch(message.author.id);
    if (name === 'ping') return reply(message, createEmbed('Bot Status', 'Online and ready.', colors.success));
    if (name === 'help') return reply(message, createHelpPayload());
    if (['kick', 'ban', 'timeout', 'untimeout', 'warn', 'warnings', 'clearwarnings'].includes(name)) {
      const member = await fetchMember(message.guild, args.shift());
      if (!member) return reply(message, `Mention a member or provide their ID. Example: ${prefix}${name} @user reason`);
      if (name === 'kick') return handleKick(message, actor, message.guild, member, args.join(' ') || null);
      if (name === 'ban') return handleBan(message, actor, message.guild, member, args.join(' ') || null);
      if (name === 'timeout') {
        const duration = parseDuration(args.shift());
        return handleTimeout(message, actor, message.guild, member, duration, args.join(' ') || null);
      }
      if (name === 'untimeout') return handleUntimeout(message, actor, message.guild, member, args.join(' ') || null);
      if (name === 'warn') return handleWarn(message, actor, message.guild, member, args.join(' ') || 'No reason provided');
      if (name === 'warnings') return handleWarnings(message, actor, message.guild, member);
      if (name === 'clearwarnings') return handleClearWarnings(message, actor, message.guild, member);
    }
    if (name === 'purge') return handlePurge(message, actor, message.channel, Math.min(Math.max(Number(args[0]) || 0, 1), 100));
    if (name === 'slowmode') return handleSlowmode(message, actor, message.channel, Math.min(Math.max(Number(args[0]) || 0, 0), 21600));
    if (name === 'lock') return handleLock(message, actor, message.channel, true);
    if (name === 'unlock') return handleLock(message, actor, message.channel, false);
    if (name === 'tickets') return handleTickets(message, actor, message.channel);
  } catch (error) {
    console.error(error);
    await reply(message, createEmbed('Command Failed', 'Something went wrong while running that command. Check my permissions and role position.', colors.danger));
  }
});

client.login(token);
