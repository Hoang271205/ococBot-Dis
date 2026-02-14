// app.js - Enhanced debug version
import 'dotenv/config';
import { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import mongoose from 'mongoose';
import express from 'express';
import { User } from './models/User.js';
import { RINGS_SHOP } from './constants.js';

// ============================================
// 1. KHỞI TẠO DISCORD CLIENT
// ============================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const PREFIX = '';

// ============================================
// 2. KẾT NỐI MONGODB
// ============================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Đã kết nối MongoDB thành công'))
  .catch(err => {
    console.error('❌ Lỗi kết nối MongoDB:', err);
    process.exit(1);
  });

// ============================================
// 3. HTTP SERVER
// ============================================
const httpApp = express();
const PORT = process.env.PORT || 3000;

httpApp.get('/', (req, res) => {
  res.send('🤖 Discord Marriage Bot is running!');
});

httpApp.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    bot: client.user ? client.user.tag : 'Not ready',
    botReady: client.isReady(),
    uptime: process.uptime(),
    readyAt: client.readyAt ? client.readyAt.toISOString() : null,
    guilds: client.guilds.cache.size
  });
});

httpApp.listen(PORT, () => {
  console.log(`🌐 HTTP server listening on port ${PORT}`);
});

// ============================================
// 4. DISCORD ERROR HANDLERS (THÊM ĐỂ DEBUG)
// ============================================
client.on('error', (error) => {
  console.error('❌ Discord Client Error:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord Warning:', warning);
});

client.on('debug', (info) => {
  // Chỉ log những debug message quan trọng
  if (info.includes('Preparing to connect') || 
      info.includes('Identifying') || 
      info.includes('Ready') ||
      info.includes('Session') ||
      info.includes('Authenticated')) {
    console.log('🔍 Discord Debug:', info);
  }
});

client.on('shardError', error => {
  console.error('❌ Shard error:', error);
});

// ============================================
// 5. ĐĂNG NHẬP DISCORD BOT
// ============================================
console.log("⏳ Đang tiến hành đăng nhập vào Discord...");
console.log(`📌 BOT_TOKEN exists: ${process.env.BOT_TOKEN ? 'Yes' : 'No'}`);
console.log(`📌 BOT_TOKEN length: ${process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0}`);

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found in environment variables!');
  process.exit(1);
}

// Validate token format
if (process.env.BOT_TOKEN.length < 50) {
  console.error('❌ BOT_TOKEN seems too short, might be invalid!');
}

console.log('🔐 Attempting to login...');

client.login(process.env.BOT_TOKEN)
  .then(() => {
    console.log("✅ Login promise resolved! Waiting for ready event...");
  })
  .catch(err => {
    console.error("❌❌❌ CRITICAL ERROR - Login failed:");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error code:", err.code);
    console.error("Full error:", err);
    process.exit(1);
  });

// Timeout nếu bot không ready sau 30 giây
setTimeout(() => {
  if (!client.isReady()) {
    console.error('❌ TIMEOUT: Bot không ready sau 30 giây!');
    console.error('Possible issues:');
    console.error('1. Invalid BOT_TOKEN');
    console.error('2. Discord API down');
    console.error('3. Intents not enabled');
    console.error('4. Network/firewall issues');
    process.exit(1);
  }
}, 30000);

// ============================================
// 6. DISCORD READY EVENT
// ============================================
client.once('ready', () => {
  console.log('🎉🎉🎉 READY EVENT RECEIVED!');
  console.log(`🤖 Bot đã đăng nhập: ${client.user.tag}`);
  console.log(`📝 Prefix: "${PREFIX}"`);
  console.log(`🏰 Guilds: ${client.guilds.cache.size}`);
  console.log(`✅ Bot đã sẵn sàng!`);
});

// ============================================
// 7. XỬ LÝ TIN NHẮN
// ============================================
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const userId = message.author.id;
    let content = message.content.trim();

    if (PREFIX && !content.startsWith(PREFIX)) return;
    if (PREFIX) content = content.slice(PREFIX.length).trim();

    const args = content.split(/\s+/);
    const command = args[0].toLowerCase();

    console.log(`[MESSAGE] ${message.author.tag}: ${command}`);

    let user = await User.findOne({ discordId: userId });
    if (!user) {
      user = new User({ discordId: userId });
      await user.save();
    }

    // === 1. TEST COMMAND ===
    if (command === 'test') {
      return message.reply('✅ Bot đang hoạt động bình thường!');
    }

    // === 2. PROFILE COMMAND ===
    if (command === 'profile') {
      let status = "Độc thân";
      if (user.partnerId && user.marriedAt) {
        const startDate = new Date(user.marriedAt);
        const diffDays = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24));
        status = `Đã kết hôn với <@${user.partnerId}>\n🗓️ Ngày cưới: ${startDate.toLocaleDateString('vi-VN')}\n💞 Đã bên nhau: ${diffDays} ngày`;
      }
      return message.reply(`👤 **Thông tin của <@${userId}>**\n💰 Tiền: ${user.money.toLocaleString()}$\n❤️ Điểm tình yêu: ${user.lovePoints}\n💍 Tình trạng: ${status}`);
    }

    // === 3. DAILY COMMAND ===
    if (command === 'daily') {
      const now = new Date();
      const COOLDOWN = 24 * 60 * 60 * 1000;
      
      if (user.lastDaily && (now - new Date(user.lastDaily)) < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - new Date(user.lastDaily))) / (60 * 60 * 1000));
        return message.reply(`⏳ Bạn đã điểm danh rồi! Hãy quay lại sau ${remaining} giờ nữa.`);
      }

      user.money += 50000;
      user.lastDaily = now;
      await user.save();

      return message.reply(`🎁 Điểm danh thành công! Bạn nhận được **50,000$**\n💰 Số dư mới: **${user.money.toLocaleString()}$**`);
    }

    // === 4. SHOP COMMAND ===
    if (command === 'shop') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('shop_select')
        .setPlaceholder('Chọn nhẫn...')
        .addOptions(
          RINGS_SHOP.map(ring => ({
            label: ring.name,
            value: ring.id,
            description: `Giá: ${ring.price.toLocaleString()}$`
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return message.reply({
        content: `💍 **CỬA HÀNG NHẪN CƯỚI** 💍\n💰 Số dư của bạn: **${user.money.toLocaleString()}$**\n\nChọn nhẫn bạn muốn mua:`,
        components: [row]
      });
    }

    // === 5. OLOVE COMMAND ===
    if (command === 'olove') {
      if (!user.partnerId) {
        return message.reply('❌ Bạn cần phải kết hôn trước khi dùng lệnh này!');
      }

      const now = new Date();
      const COOLDOWN = 60 * 60 * 1000;
      
      if (user.lastLoveCommand && (now - new Date(user.lastLoveCommand)) < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - new Date(user.lastLoveCommand))) / (60 * 1000));
        return message.reply(`⏳ Bạn cần nghỉ ngơi! Hãy quay lại sau ${remaining} phút.`);
      }

      user.lovePoints += 50;
      user.lastLoveCommand = now;
      await user.save();

      await User.updateOne({ discordId: user.partnerId }, { $inc: { lovePoints: 50 } });

      return message.reply(`💖 Bạn và <@${user.partnerId}> đã dành thời gian bên nhau! (+50 điểm tình yêu)`);
    }

    // === 6. OCHECK COMMAND ===
    if (command === 'ocheck') {
      const freshUser = await User.findOne({ discordId: userId });
      
      if (!freshUser || !freshUser.partnerId || !freshUser.marriedAt) {
        return message.reply('❌ Bạn hiện đang độc thân, hãy tìm nửa kia và dùng `marry` nhé!');
      }

      const startDate = new Date(freshUser.marriedAt);
      const now = new Date();
      const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

      const embed = {
        title: '💖 THÔNG TIN CẶP ĐÔI 💖',
        description: 
          `👩‍❤️‍👨 **Bạn đời:** <@${freshUser.partnerId}>\n` +
          `🗓️ **Ngày kết hôn:** ${startDate.toLocaleDateString('vi-VN')}\n` +
          `💞 **Đã bên nhau:** ${diffDays} ngày\n` +
          `✨ **Điểm tình yêu tích lũy:** ${freshUser.lovePoints.toLocaleString()}\n\n` +
          `*Dùng \`olove\` mỗi giờ để tăng thêm điểm tình yêu nhé!*`,
        color: 0xFF1493,
        timestamp: new Date()
      };

      if (freshUser.couplePhoto) {
        embed.image = { url: freshUser.couplePhoto };
      } else {
        embed.footer = { text: '💡 Thêm ảnh cặp đôi bằng lệnh: oaddpic' };
      }

      return message.reply({ embeds: [embed] });
    }

    // === 7. ODIVORCE COMMAND ===
    if (command === 'odivorce') {
      if (!user.partnerId) {
        return message.reply('❌ Bạn đang độc thân, không thể ly hôn!');
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_divorce_${userId}_${user.partnerId}`)
            .setLabel('Xác Nhận Ly Hôn')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_divorce')
            .setLabel('Hủy Bỏ')
            .setStyle(ButtonStyle.Secondary)
        );

      return message.reply({
        content: `💔 **XÁC NHẬN LY HÔN**\nBạn có chắc chắn muốn ly hôn với <@${user.partnerId}> không?\n*(Hành động này sẽ xóa ngày kỷ niệm và điểm tình yêu của cả hai)*`,
        components: [row]
      });
    }

    // === 8. OADDCASH COMMAND ===
    if (command === 'oaddcash') {
      const amount = parseInt(args[1]);
      if (!amount || amount <= 0) {
        return message.reply('❌ Cách dùng: `oaddcash <số tiền> [@user]`\nVí dụ: `oaddcash 1000000 @user`');
      }

      const mentionedUser = message.mentions.users.first();
      const targetId = mentionedUser ? mentionedUser.id : userId;

      const updatedUser = await User.findOneAndUpdate(
        { discordId: targetId },
        { $inc: { money: amount } },
        { upsert: true, new: true, returnDocument: 'after' }
      );

      return message.reply(`✅ Đã nạp **${amount.toLocaleString()}$** cho <@${targetId}>.\n💰 Số dư mới: **${updatedUser.money.toLocaleString()}$**`);
    }

    // === 9. OADDPIC COMMAND ===
    if (command === 'oaddpic') {
      if (!user.partnerId) {
        return message.reply('❌ Bạn cần phải kết hôn trước khi thêm ảnh cặp đôi!');
      }

      const attachment = message.attachments.first();
      
      if (!attachment) {
        const urlMatch = args[1];
        if (!urlMatch || (!urlMatch.startsWith('http://') && !urlMatch.startsWith('https://'))) {
          return message.reply(
            '❌ **Cách dùng:**\n' +
            '1️⃣ Đính kèm ảnh trực tiếp: `oaddpic` + upload ảnh\n' +
            '2️⃣ Dùng link ảnh: `oaddpic https://i.imgur.com/abc.jpg`\n\n' +
            '💡 *Ảnh sẽ được hiển thị khi dùng lệnh `ocheck`*'
          );
        }

        user.couplePhoto = urlMatch;
        await user.save();
        await User.updateOne({ discordId: user.partnerId }, { $set: { couplePhoto: urlMatch } });

        return message.reply({
          content: `✅ Đã lưu ảnh cặp đôi của bạn và <@${user.partnerId}>!\n🖼️ Xem ảnh bằng lệnh \`ocheck\``,
          embeds: [{
            title: '💖 Ảnh cặp đôi của bạn',
            image: { url: urlMatch },
            color: 0xFF69B4
          }]
        });
      }

      if (attachment.contentType && !attachment.contentType.startsWith('image/')) {
        return message.reply('❌ File đính kèm phải là ảnh (jpg, png, gif, webp)!');
      }

      const photoUrl = attachment.url;
      user.couplePhoto = photoUrl;
      await user.save();
      await User.updateOne({ discordId: user.partnerId }, { $set: { couplePhoto: photoUrl } });

      return message.reply({
        content: `✅ Đã lưu ảnh cặp đôi của bạn và <@${user.partnerId}>!\n🖼️ Xem ảnh bằng lệnh \`ocheck\``,
        embeds: [{
          title: '💖 Ảnh cặp đôi của bạn',
          image: { url: photoUrl },
          color: 0xFF69B4
        }]
      });
    }

    // === 10. MARRY COMMAND ===
    if (command === 'marry') {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        return message.reply('❌ Cách dùng: `marry @user`\nVí dụ: `marry @someone`');
      }

      const targetId = mentionedUser.id;
      if (targetId === userId) {
        return message.reply('❌ Bạn không thể tự cưới chính mình!');
      }

      let target = await User.findOne({ discordId: targetId });
      if (!target) {
        target = new User({ discordId: targetId });
        await target.save();
      }

      if (user.partnerId || target.partnerId) {
        return message.reply('❌ Một trong hai người đã kết hôn rồi!');
      }

      const ringNamesInShop = RINGS_SHOP.map(r => r.name);
      const userRings = user.inventory.filter(item => ringNamesInShop.includes(item));

      if (userRings.length === 0) {
        return message.reply('❌ Bạn chưa có nhẫn! Hãy vào `shop` để mua nhẫn trước khi cầu hôn.');
      }

      if (userRings.length === 1) {
        const ringName = userRings[0];
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`accept_${userId}_${targetId}_${ringName}`)
              .setLabel('Đồng Ý')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('reject')
              .setLabel('Từ Chối')
              .setStyle(ButtonStyle.Danger)
          );

        return message.reply({
          content: `💖 <@${userId}> đã dùng **${ringName}** để cầu hôn <@${targetId}>! Bạn có đồng ý không?`,
          components: [row]
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('marry_select_ring')
        .setPlaceholder('Chọn nhẫn...')
        .addOptions(
          userRings.map(name => ({
            label: name,
            value: `${name}|${targetId}`,
            description: 'Dùng nhẫn này để cầu hôn'
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return message.reply({
        content: '💍 Bạn có nhiều nhẫn! Hãy chọn chiếc nhẫn bạn muốn dùng để cầu hôn:',
        components: [row]
      });
    }

    // === 11. HELP COMMAND ===
    if (command === 'help' || command === 'h') {
      return message.reply(
        `📋 **DANH SÁCH LỆNH**\n\n` +
        `\`test\` - Kiểm tra bot\n` +
        `\`profile\` - Xem thông tin cá nhân\n` +
        `\`daily\` - Điểm danh nhận 50,000$\n` +
        `\`shop\` - Mở cửa hàng nhẫn\n` +
        `\`marry @user\` - Cầu hôn người dùng\n` +
        `\`olove\` - Tăng điểm tình yêu (1h/lần)\n` +
        `\`ocheck\` - Kiểm tra thông tin cặp đôi\n` +
        `\`oaddpic\` - Thêm ảnh cặp đôi (đính kèm ảnh hoặc URL)\n` +
        `\`odivorce\` - Ly hôn\n` +
        `\`oaddcash <số> [@user]\` - Nạp tiền (Admin)\n\n` +
        `*Không cần dấu / trước lệnh!*`
      );
    }

  } catch (error) {
    console.error('[ERROR] Lỗi xử lý tin nhắn:', error);
    message.reply('❌ Đã xảy ra lỗi khi xử lý lệnh!').catch(() => {});
  }
});

// ============================================
// 8. XỬ LÝ INTERACTIONS
// ============================================
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const userId = interaction.user.id;
    console.log(`[INTERACTION] ${interaction.customId} by ${userId}`);

    if (interaction.customId === 'shop_select') {
      const ring = RINGS_SHOP.find(r => r.id === interaction.values[0]);
      let user = await User.findOne({ discordId: userId });
      
      if (!user) {
        user = new User({ discordId: userId });
        await user.save();
      }

      if (user.money < ring.price) {
        return interaction.reply({
          content: `❌ Không đủ tiền! Bạn cần **${ring.price.toLocaleString()}$** nhưng chỉ có **${user.money.toLocaleString()}$**`,
          ephemeral: true
        });
      }

      user.money -= ring.price;
      user.inventory.push(ring.name);
      await user.save();

      return interaction.reply({
        content: `🎊 <@${userId}> đã mua thành công **${ring.name}**!\n💰 Số dư còn lại: **${user.money.toLocaleString()}$**`
      });
    }

    if (interaction.customId === 'marry_select_ring') {
      const [ringName, targetId] = interaction.values[0].split('|');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`accept_${userId}_${targetId}_${ringName}`)
            .setLabel('Đồng Ý')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('reject')
            .setLabel('Từ Chối')
            .setStyle(ButtonStyle.Danger)
        );

      return interaction.reply({
        content: `💖 <@${userId}> đã chọn **${ringName}** để cầu hôn <@${targetId}>! Bạn có đồng ý không?`,
        components: [row]
      });
    }

    if (interaction.customId.startsWith('accept_')) {
      const parts = interaction.customId.split('_');
      const proposerId = parts[1];
      const targetId = parts[2];
      const ringName = parts.slice(3).join('_');

      if (userId !== targetId) {
        return interaction.reply({
          content: '❌ Đây không phải lời cầu hôn dành cho bạn!',
          ephemeral: true
        });
      }

      const proposer = await User.findOne({ discordId: proposerId });
      let target = await User.findOne({ discordId: targetId });

      if (!target) {
        target = new User({ discordId: targetId });
        await target.save();
      }

      if (!proposer || !proposer.inventory.includes(ringName)) {
        return interaction.reply('❌ Cầu hôn thất bại! Nhẫn không còn tồn tại.');
      }

      if (proposer.partnerId || target.partnerId) {
        return interaction.reply('💔 Một trong hai người đã kết hôn với người khác!');
      }

      const weddingDate = new Date();

      await Promise.all([
        User.updateOne(
          { discordId: proposerId },
          { $pull: { inventory: ringName }, $set: { partnerId: targetId, marriedAt: weddingDate } }
        ),
        User.updateOne(
          { discordId: targetId },
          { $set: { partnerId: proposerId, marriedAt: weddingDate } },
          { upsert: true }
        )
      ]);

      return interaction.reply({
        content: `🎉 **CHÚC MỪNG!** <@${targetId}> đã đồng ý! <@${proposerId}> và <@${targetId}> đã chính thức kết hôn với chiếc **${ringName}**! 💞\n🗓️ Ngày cưới: ${weddingDate.toLocaleDateString('vi-VN')}`
      });
    }

    if (interaction.customId.startsWith('confirm_divorce_')) {
      const parts = interaction.customId.split('_');
      const proposerId = parts[2];
      const partnerId = parts[3];

      if (userId !== proposerId) {
        return interaction.reply({
          content: '❌ Chỉ người yêu cầu ly hôn mới có thể xác nhận!',
          ephemeral: true
        });
      }

      await User.updateMany(
        { discordId: { $in: [proposerId, partnerId] } },
        { $set: { partnerId: null, marriedAt: null, lovePoints: 0, couplePhoto: null } }
      );

      return interaction.reply({
        content: `💔 **CHÍNH THỨC:** <@${proposerId}> và <@${partnerId}> đã đường ai nấy đi. Điểm tình yêu đã bị reset về 0.`
      });
    }

    if (interaction.customId === 'cancel_divorce') {
      return interaction.reply('💖 Thật may mắn, hai bạn đã quyết định ngồi lại bên nhau!');
    }

    if (interaction.customId === 'reject') {
      return interaction.reply('💔 Rất tiếc, lời cầu hôn đã bị từ chối.');
    }

  } catch (error) {
    console.error('[ERROR] Lỗi xử lý interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '❌ Đã xảy ra lỗi!', ephemeral: true }).catch(() => {});
    }
  }
});