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

// 微信推送模块 (PushPlus)
async function sendWechat(title, content) {
    const token = process.env.PUSHPLUS_TOKEN;
    if (!token) return;
    try {
        await fetch('https://www.pushplus.plus/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, title: title, content: content })
        });
    } catch (e) {}
}

// 核心升级：全网随机冷门歌单抓取
async function getRandomSongs(targetCount) {
    const categories = ['华语', '欧美', '日语', '韩语', '粤语', '小众', '摇滚', '民谣', '电子', '轻音乐', '爵士', '古典', '乡村', '蓝调'];
    let uniqueIds = new Set();
    let finalSongs = [];

    while (finalSongs.length < targetCount) {
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const offset = Math.floor(Math.random() * 300);

        console.log(`正在从 [${cat}] 分类中寻找冷门歌单 (页码: ${offset})...`);
        try {
            const playListRes = await requestApi(`/top/playlist?cat=${encodeURIComponent(cat)}&limit=1&offset=${offset}`);
            if (playListRes.playlists && playListRes.playlists.length > 0) {
                const pid = playListRes.playlists[0].id;
                console.log(`🔍 找到冷门歌单: 《${playListRes.playlists[0].name}》，正在提取...`);
                
                const songsRes = await requestApi(`/playlist/track/all?id=${pid}&limit=100`);
                const songs = songsRes.songs || [];
                
                for (const s of songs) {
                    if (!uniqueIds.has(s.id) && finalSongs.length < targetCount) {
                        uniqueIds.add(s.id);
                        finalSongs.push({ id: s.id, name: s.name });
                    }
                }
            }
        } catch (e) {
            console.log("⚠️ 获取歌单小卡顿，继续重试...");
        }
        await sleep(1500); 
    }
    return finalSongs;
}

async function startTask() {
    // 这里已经修改为校验新的变量名
    if (!process.env.NETEASE_COOKIE) {
        console.error("❌ 未找到 NETEASE_COOKIE，请检查配置！");
        return;
    }

    let reportMsg = ""; 

    try {
        console.log("▶️ 开始网易云每日 300 首打卡任务 (完整 Cookie 破壁版)...");
        const signinRes = await requestApi('/daily_signin', { type: 0 });
        let signMsg = signinRes.code === 200 ? "签到成功" : (signinRes.code === -2 ? "今日已签到" : "签到异常");
        reportMsg += `📅 签到状态: ${signMsg}\n`;
        console.log(`✅ ${signMsg}`);

        const finalSongs = await getRandomSongs(300);
        console.log(`🎵 成功凑齐 ${finalSongs.length} 首冷门歌曲，开始真人模拟打卡...`);

        let count = 0;
        for (const song of finalSongs) {
            const scrobbleRes = await requestApi('/scrobble', {
                id: song.id,
                sourceid: song.id,
                time: 240 
            });

            if (scrobbleRes.code === 200) count++;
            
            const delay = 2000 + Math.random() * 2000;
            if (count % 20 === 0) console.log(`进度汇报: 已完成 ${count} 首...`);
            await sleep(delay); 
        }

        reportMsg += `🎵 刷歌进度: 成功记录 ${count} / ${finalSongs.length} 首\n`;
        reportMsg += `🎉 今日任务结束！携带了完整的防伪令牌，历史记录绝对稳了！`;
        console.log("🎉 任务全部跑完！");

        await sendWechat("🎵 网易云自动打卡战报", reportMsg);

    } catch (err) {
        console.error("⚠️ 运行发生错误:", err.message);
        await sendWechat("❌ 网易云打卡发生异常", `错误信息: ${err.message}`);
    }
}

startTask();
