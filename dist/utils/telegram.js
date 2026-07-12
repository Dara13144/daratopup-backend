"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelegramNotification = sendTelegramNotification;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const SANDBOX_MODE = process.env.SANDBOX_MODE === 'true';
async function sendTelegramNotification(message) {
    const logPrefix = '[Telegram Bot Notification]';
    const targetChatIds = [];
    if (CHAT_ID && !CHAT_ID.includes('MOCK')) {
        targetChatIds.push(CHAT_ID);
    }
    if (GROUP_CHAT_ID && !GROUP_CHAT_ID.includes('MOCK')) {
        targetChatIds.push(GROUP_CHAT_ID);
    }
    if (SANDBOX_MODE || !BOT_TOKEN || BOT_TOKEN.includes('MOCK') || targetChatIds.length === 0) {
        console.log(`\n🔔 ${logPrefix} (SANDBOX MODE - MOCK SEND)`);
        console.log(`-------------------------------------------`);
        console.log(message);
        console.log(`-------------------------------------------\n`);
        return true;
    }
    let allSuccess = true;
    for (const cid of targetChatIds) {
        try {
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: cid,
                    text: message,
                    parse_mode: 'HTML',
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`${logPrefix} Failed to send telegram notification to ${cid}:`, errorText);
                allSuccess = false;
            }
        }
        catch (error) {
            console.error(`${logPrefix} Error sending telegram notification to ${cid}:`, error);
            allSuccess = false;
        }
    }
    return allSuccess;
}
