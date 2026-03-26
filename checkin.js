// 获取我们在 GitHub Secrets 存的 Cookie
const cookie = `MUSIC_U=${process.env.MUSIC_U};`; 
const apiBase = 'http://localhost:3000'; // 指向我们稍后在后台运行的临时 API 服务

// 封装一个简单的网络请求函数
async function requestApi(endpoint, data = {}) {
    data.cookie = cookie;
    const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

// 模拟等待时间的辅助函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startTask() {
    if (!process.env.MUSIC_U) {
        console.error("❌ 未找到 MUSIC_U，请检查 GitHub Secrets 配置！");
        return;
    }

    try {
        console.log("▶️ 开始网易云每日任务...");

        // 1. 每日签到
        console.log("正在执行签到...");
        const signinRes = await requestApi('/daily_signin', { type: 0 }); // 0代表安卓端签到
        console.log(`签到结果: 代码 ${signinRes.code} (200为成功, -2为已签到)`);

        // 2. 获取每日推荐歌单作为打卡素材
        console.log("正在获取每日推荐歌曲...");
        const recommendRes = await requestApi('/recommend/songs');
        const songs = recommendRes.data?.dailySongs || [];
        
        if (songs.length === 0) {
            console.log("❌ 获取推荐歌曲失败，Cookie 可能已过期。");
            return;
        }
        console.log(`成功获取 ${songs.length} 首歌曲，开始模拟听歌记录...`);

        // 3. 循环发送听歌记录 (打卡300首逻辑，这里取歌单前几首作为演示)
        // 注意：网易云对单日重复刷歌有限制，用每日推荐的新歌刷最稳妥
        let count = 0;
        for (const song of songs) {
            const scrobbleRes = await requestApi('/scrobble', {
                id: song.id,
                sourceid: song.id,
                time: 240 // 模拟听了 240 秒
            });
            
            if (scrobbleRes.code === 200) {
                count++;
                console.log(`✅ 歌曲 [${song.name}] 记录成功 (${count}/${songs.length})`);
            }
            
            // 每次请求间隔 1-2 秒，模拟真人操作防止被封禁
            await sleep(1000 + Math.random() * 1000); 
        }

        console.log("🎉 今日 Node.js 自动化打卡任务圆满结束！");

    } catch (err) {
        console.error("⚠️ 运行发生错误:", err.message);
    }
}

// 启动程序
startTask();
