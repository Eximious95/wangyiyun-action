const cookie = process.env.NETEASE_COOKIE;
const apiBase = 'http://localhost:3000'; 

async function requestApi(endpoint, data = {}) {
    data.cookie = cookie;
    const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================= 新增：微信推送模块 =================
async function sendWechat(title, content) {
    const token = process.env.PUSHPLUS_TOKEN;
    if (!token) {
        console.log("ℹ️ 未配置 PUSHPLUS_TOKEN，跳过微信推送。");
        return;
    }
    try {
        console.log("📨 正在发送微信通知...");
        await fetch('https://www.pushplus.plus/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                title: title,
                content: content
            })
        });
        console.log("✅ 微信通知发送成功！请查看手机。");
    } catch (e) {
        console.log("❌ 微信通知发送失败:", e.message);
    }
}
// ====================================================

async function startTask() {
    if (!process.env.NETEASE_COOKIE) {
        console.error("❌ 未找到 MUSIC_U，请检查配置！");
        return;
    }

    let reportMsg = ""; // 用来收集战报内容

    try {
        console.log("▶️ 开始网易云每日 300 首打卡任务...");
        const signinRes = await requestApi('/daily_signin', { type: 0 });
        
        let signMsg = signinRes.code === 200 ? "签到成功" : (signinRes.code === -2 ? "今日已签到" : "签到异常");
        reportMsg += `📅 签到状态: ${signMsg}\n`;
        console.log(`✅ ${signMsg} (代码: ${signinRes.code})`);

        let uniqueIds = new Set();
        let finalSongs = [];

        function addSongs(songList) {
            for (const s of songList) {
                if (!uniqueIds.has(s.id) && finalSongs.length < 300) {
                    uniqueIds.add(s.id);
                    finalSongs.push({ id: s.id, name: s.name });
                }
            }
        }

        const recommendRes = await requestApi('/recommend/songs');
        addSongs(recommendRes.data?.dailySongs || []);

        if (finalSongs.length < 300) {
            const hotRes = await requestApi('/playlist/track/all?id=3778678&limit=200');
            addSongs(hotRes.songs || []);
        }

        if (finalSongs.length < 300) {
            const newRes = await requestApi('/playlist/track/all?id=3779629&limit=100');
            addSongs(newRes.songs || []);
        }

        let count = 0;
        for (const song of finalSongs) {
            const scrobbleRes = await requestApi('/scrobble', {
                id: song.id,
                sourceid: song.id,
                time: 240
            });

            if (scrobbleRes.code === 200) count++;
            await sleep(500 + Math.random() * 500); 
        }

        reportMsg += `🎵 刷歌进度: 成功记录 ${count} / ${finalSongs.length} 首\n`;
        reportMsg += `🎉 今日打卡任务圆满结束！`;
        
        console.log(reportMsg);

        // 任务结束后，调用微信推送！
        await sendWechat("🎵 网易云自动打卡战报", reportMsg);

    } catch (err) {
        console.error("⚠️ 运行发生错误:", err.message);
        await sendWechat("❌ 网易云打卡发生异常", `错误信息: ${err.message}`);
    }
}

startTask();
