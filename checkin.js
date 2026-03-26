// 获取我们在 GitHub Secrets 存的 Cookie
const cookie = `MUSIC_U=${process.env.MUSIC_U};`; 
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

async function startTask() {
    if (!process.env.MUSIC_U) {
        console.error("❌ 未找到 MUSIC_U，请检查配置！");
        return;
    }

    try {
        console.log("▶️ 开始网易云每日 300 首打卡任务...");
        const signinRes = await requestApi('/daily_signin', { type: 0 });
        console.log(`✅ 签到结果: 代码 ${signinRes.code} (-2代表今天已经签过到了)`);

        console.log("正在搜集打卡歌曲素材 (目标 300 首)...");
        
        let uniqueIds = new Set();
        let finalSongs = [];

        // 辅助函数：把获取到的歌单塞进去去重，凑满 300 首就停止
        function addSongs(songList) {
            for (const s of songList) {
                if (!uniqueIds.has(s.id) && finalSongs.length < 300) {
                    uniqueIds.add(s.id);
                    finalSongs.push({ id: s.id, name: s.name });
                }
            }
        }

        // 1. 拿每日推荐歌曲 (约 31 首)
        const recommendRes = await requestApi('/recommend/songs');
        addSongs(recommendRes.data?.dailySongs || []);

        // 2. 如果不够，拿“网易云热歌榜” (约 200 首，ID: 3778678)
        if (finalSongs.length < 300) {
            const hotRes = await requestApi('/playlist/track/all?id=3778678&limit=200');
            addSongs(hotRes.songs || []);
        }

        // 3. 如果还不够，拿“新歌榜” (约 100 首，ID: 3779629)
        if (finalSongs.length < 300) {
            const newRes = await requestApi('/playlist/track/all?id=3779629&limit=100');
            addSongs(newRes.songs || []);
        }

        console.log(`🎵 成功凑齐 ${finalSongs.length} 首不重复的歌曲，开始疯狂打卡...`);

        let count = 0;
        for (const song of finalSongs) {
            const scrobbleRes = await requestApi('/scrobble', {
                id: song.id,
                sourceid: song.id,
                time: 240
            });

            if (scrobbleRes.code === 200) {
                count++;
                console.log(`✅ [${count}/${finalSongs.length}] 歌曲 [${song.name}] 记录成功`);
            }

            // 稍微缩短间隔，0.5秒到1秒随机，跑完 300 首大概需要 4 分钟
            await sleep(500 + Math.random() * 500); 
        }

        console.log("🎉 今日 300 首打卡任务圆满结束！你可以去网易云看等级进度条啦！");

    } catch (err) {
        console.error("⚠️ 运行发生错误:", err.message);
    }
}

startTask();
