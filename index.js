const express = require("express");
const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const AutoAuth = require('mineflayer-auto-auth');

// ============================================
// خادم Express الويب
// ============================================
const app = express();
app.use(express.json());

let botStatus = { status: 'Initializing...', connected: false, uptime: 0 };
let startTime = Date.now();

// رابط الصفحة الرئيسية
app.get("/", (_, res) => {
  res.send('Bot is running ✅');
});

// API لحالة البوت
app.get("/api/status", (_, res) => {
  botStatus.uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json(botStatus);
});

// بدء الخادم على PORT واحد فقط
const PORT = process.env.PORT || 3000;
app.listen(PORT);

// ============================================
// معالجات أخطاء عامة
// ============================================
process.on('uncaughtException', (error) => {
  console.error(`[${getTime()}] ⚠️ خطأ: ${error.message}`);
  botStatus.status = 'Error';
});

process.on('unhandledRejection', (reason) => {
  console.error(`[${getTime()}] ⚠️ رفض: ${reason}`);
  botStatus.status = 'Error';
});

// ============================================
// نظام Mineflayer Bot
// ============================================
let bot = null;
let reconnectAttempts = 0;
let isConnecting = false;
let afkInterval = null;

const getTime = () => new Date().toLocaleTimeString('ar-SA');

function createBot() {
  if (isConnecting) return;
  isConnecting = true;
  reconnectAttempts++;
  
  const backoffDelay = Math.min(1000 * reconnectAttempts, 30000);
  console.log(`[${getTime()}] 🔄 محاولة اتصال #${reconnectAttempts}...`);

  try {
    bot = mineflayer.createBot({
      host: 'SHADOWMCplaynet.aternos.me',
      port: 50003,
      username: 'NihitBot',
      version: false,
      plugins: [AutoAuth],
      AutoAuth: 'bot112022'
    });

    // تحميل الإضافات
    bot.loadPlugin(pvp);
    bot.loadPlugin(armorManager);
    bot.loadPlugin(pathfinder);

    // ===== معالجات البوت =====
    
    let guardPos = null;

    // جمع الأشياء تلقائياً
    bot.on('playerCollect', (collector, itemDrop) => {
      try {
        if (collector !== bot.entity) return;
        setTimeout(() => {
          try {
            const sword = bot.inventory.items().find(i => i.name.includes('sword'));
            if (sword) bot.equip(sword, 'hand');
          } catch (e) {}
        }, 150);
      } catch (e) {}
    });

    bot.on('playerCollect', (collector, itemDrop) => {
      try {
        if (collector !== bot.entity) return;
        setTimeout(() => {
          try {
            const shield = bot.inventory.items().find(i => i.name.includes('shield'));
            if (shield) bot.equip(shield, 'off-hand');
          } catch (e) {}
        }, 250);
      } catch (e) {}
    });

    // أوامر chat
    bot.on('chat', (username, message) => {
      try {
        if (message === 'guard') {
          const player = bot.players[username];
          if (player) {
            bot.chat('I will!');
            guardPos = player.entity.position.clone();
            moveToGuard();
          }
        }
        if (message === 'stop') {
          bot.chat('I will stop!');
          guardPos = null;
          bot.pvp.stop();
          bot.pathfinder.setGoal(null);
        }
      } catch (e) {}
    });

    // دالة الذهاب لموقع الحماية
    function moveToGuard() {
      try {
        if (!guardPos) return;
        const mcData = require('minecraft-data')(bot.version);
        bot.pathfinder.setMovements(new Movements(bot, mcData));
        bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
      } catch (e) {}
    }

    // الهجوم التلقائي على الأعداء
    bot.on('physicTick', () => {
      try {
        if (!guardPos) return;
        const mobs = bot.entities;
        for (const entity of Object.values(mobs)) {
          if (
            entity.type === 'mob' &&
            entity.position.distanceTo(bot.entity.position) < 16 &&
            entity.mobType !== 'Armor Stand'
          ) {
            bot.pvp.attack(entity);
            break;
          }
        }
      } catch (e) {}
    });

    // عند ظهور البوت
    bot.on('spawn', () => {
      reconnectAttempts = 0;
      isConnecting = false;
      botStatus = { status: 'Connected ✅', connected: true, uptime: 0 };
      startTime = Date.now();
      console.log(`[${getTime()}] ✅ اتصال نجح! البوت جاهز 🎮`);

      // بدء حركة AFK خفيفة
      clearInterval(afkInterval);
      afkInterval = setInterval(() => {
        try {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 100);
        } catch (e) {}
      }, 60000); // قفز كل دقيقة
    });

    // معالجات الأخطاء
    bot.on('kicked', (reason) => {
      botStatus.status = 'Kicked';
      botStatus.connected = false;
      console.log(`[${getTime()}] ⚠️ طرد: ${reason}`);
    });

    bot.on('error', (error) => {
      botStatus.status = 'Error';
      botStatus.connected = false;
      // لا نطبع الأخطاء المتكررة
    });

    bot.on('end', () => {
      clearInterval(afkInterval);
      botStatus.status = 'Disconnected';
      botStatus.connected = false;
      isConnecting = false;
      const delay = Math.min(1000 * reconnectAttempts, 30000);
      setTimeout(createBot, delay);
    });

  } catch (error) {
    console.error(`[${getTime()}] ❌ خطأ في البوت: ${error.message}`);
    botStatus.status = 'Error';
    isConnecting = false;
    setTimeout(createBot, Math.min(1000 * reconnectAttempts, 30000));
  }
}

// بدء البوت
createBot();
