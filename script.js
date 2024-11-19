// script.js

import urlsData from './data.js'

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('videoPlayer');
    const playButton = document.getElementById('playButton');
    const m3u8UrlInput = document.getElementById('m3u8Url');
    const episodesList = document.getElementById('episodesList');
    const historyList = document.getElementById('historyList'); // 历史记录列表
    const clearHistoryButton = document.getElementById('clearHistoryButton'); // 清除历史按钮
    const prevEpisodeButton = document.getElementById('prevEpisodeButton');
    const nextEpisodeButton = document.getElementById('nextEpisodeButton');

    let currentHls = null;
    let currentActiveLi = null;
    let currentEpisode = null;
    let saveHistoryInterval = null;

    // 设置历史记录的最大条目数为4
    const MAX_HISTORY = 4;

    let episodesArray = []; // 全局剧集数组
    let currentEpisodeIndex = -1; // 当前剧集索引

    // 初始化剧集列表
    const initializeEpisodes = () => {
        // 将 urlsData 对象转换为数组并排序
        episodesArray = Object.keys(urlsData)
            .map(key => ({ number: Number(key), url: urlsData[key] })) // 确保 number 是数字
            .sort((a, b) => a.number - b.number);

        episodesArray.forEach((episode, index) => {
            const li = document.createElement('li');
            li.id = `第 ${episode.number} 集`; 
            li.textContent = `第 ${episode.number} 集`;
            li.dataset.url = episode.url;
            li.dataset.number = episode.number;

            li.addEventListener('click', () => {
                const history = getHistory();
                console.log(history);

                // 高亮当前选中的剧集
                if (currentActiveLi) {
                    currentActiveLi.classList.remove('active');
                }
                li.classList.add('active');
                currentActiveLi = li;

                // 设置输入框的值并播放
                m3u8UrlInput.value = episode.url;
                currentEpisode = `第 ${episode.number} 集`;
                document.getElementById('currentEpisode').innerHTML = `正在播放 - ${currentEpisode}`;

                const existingIndex = history.findIndex(item => item.url === episode.url && item.episode === currentEpisode);

                if (existingIndex !== -1) {
                    playVideo(episode.url, currentEpisode, history[existingIndex].currentTime || 0);
                } else {
                    playVideo(episode.url, currentEpisode);
                }

                // 更新当前剧集索引
                currentEpisodeIndex = index;

                // 更新按钮状态
                updateEpisodeButtons();
            });

            episodesList.appendChild(li);
        });
    };

    // 更新上一集和下一集按钮的可用状态
    const updateEpisodeButtons = () => {
        prevEpisodeButton.disabled = currentEpisodeIndex <= 0;
        nextEpisodeButton.disabled = currentEpisodeIndex >= episodesArray.length - 1;
    };

    // 初始化观看历史
    const initializeHistory = () => {
        const history = getHistory();
        history.forEach(entry => {
            addHistoryEntryToUI(entry, false); // 初始化时不需要移动到顶部
        });
    };

    // 获取观看历史
    const getHistory = () => {
        const history = localStorage.getItem('watchHistory');
        return history ? JSON.parse(history) : [];
    };

    // 保存观看历史
    const saveHistory = (entry) => {
        const history = getHistory();
        // 检查是否已有相同的视频URL和剧集
        const existingIndex = history.findIndex(item => item.url === entry.url && item.episode === entry.episode);
        if (existingIndex !== -1) {
            // 更新已有记录的时间戳和播放进度
            history[existingIndex].timestamp = entry.timestamp;
            history[existingIndex].currentTime = entry.currentTime; // 添加播放进度
            // 将更新的记录移到最前面
            const updatedEntry = history.splice(existingIndex, 1)[0];
            history.unshift(updatedEntry);
        } else {
            // 添加新记录到开头
            history.unshift(entry);
            // 如果超过最大历史记录数，移除最后一条记录
            if (history.length > MAX_HISTORY) {
                const removedEntry = history.pop();
                removeHistoryEntryFromUI(removedEntry);
            }
        }
        localStorage.setItem('watchHistory', JSON.stringify(history));

        // 更新UI
        addHistoryEntryToUI(entry, true);
    };

    // 添加历史记录到 UI
    const addHistoryEntryToUI = (entry, moveToTop) => {
        // 检查是否已经存在相同的条目
        const existingLi = Array.from(historyList.children).find(li => li.dataset.url === entry.url && li.dataset.episode === entry.episode);
        if (existingLi) {
            historyList.removeChild(existingLi);
        }

        // 创建新的li元素
        const li = document.createElement('li');
        const formattedTime = new Date(entry.timestamp).toLocaleString();
        li.innerHTML = `<strong>${entry.episode}</strong> - ${formattedTime}`;

        li.dataset.url = entry.url;
        li.dataset.episode = entry.episode; // 添加 dataset 以便后续查找

        // 创建删除按钮
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '✖'; // 使用乘号作为删除标识
        deleteButton.classList.add('delete-btn'); // 添加类名以便于样式化

        // 添加删除按钮的事件监听器
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发父级li的点击事件
            deleteHistoryEntry(entry.url, entry.episode);
        });

        // 将删除按钮添加到li中
        li.appendChild(deleteButton);

        li.addEventListener('click', () => {
            if (currentActiveLi) {
                currentActiveLi.classList.remove('active');
            }

            const episodesArrayLi = document.getElementById(`${entry.episode}`)

            episodesArrayLi.classList.add('active');
            currentActiveLi = episodesArrayLi;

            // 设置输入框的值并播放
            m3u8UrlInput.value = entry.url;
            currentEpisode = entry.episode;
            document.getElementById('currentEpisode').innerHTML = `正在播放 - ${currentEpisode}`;
            // 播放视频，并传递保存的播放时间
            playVideo(entry.url, entry.episode, entry.currentTime || 0);

            // 更新 currentEpisodeIndex
            currentEpisodeIndex = episodesArray.findIndex(ep => ep.url === entry.url && ep.number === parseInt(entry.episode.replace('第 ', '').replace(' 集', '')));
            
            // 更新按钮状态
            updateEpisodeButtons();
        });

        // 将新的li添加到顶部
        historyList.insertBefore(li, historyList.firstChild);
    };

    // 移除历史记录从 UI
    const removeHistoryEntryFromUI = (entry) => {
        const existingLi = Array.from(historyList.children).find(li => li.dataset.url === entry.url && li.dataset.episode === entry.episode);
        if (existingLi) {
            historyList.removeChild(existingLi);
        }
    };

    // 删除指定的历史记录条目
    const deleteHistoryEntry = (url, episode) => {
        let history = getHistory();
        // 找到并移除对应的条目
        history = history.filter(item => !(item.url === url && item.episode === episode));
        // 更新localStorage
        localStorage.setItem('watchHistory', JSON.stringify(history));
        // 从UI中移除
        removeHistoryEntryFromUI({ url, episode });
    };

    // 清除观看历史
    const clearHistory = () => {
        localStorage.removeItem('watchHistory');
        historyList.innerHTML = '';
    };

    // 播放视频的函数
    const playVideo = (url, episode, startTime = 0) => {
        // 释放之前的 Hls 实例
        if (currentHls) {
            currentHls.destroy();
            currentHls = null;
        }

        // 如果有正在保存历史的定时器，清除它
        if (saveHistoryInterval) {
            clearInterval(saveHistoryInterval);
            saveHistoryInterval = null;
        }

        // 设置当前剧集
        currentEpisode = episode;

        // 记录观看历史（初始化）
        const historyEntry = {
            url,
            episode,
            timestamp: Date.now(),
            currentTime: startTime // 添加播放进度
        };
        saveHistory(historyEntry);

        // 检查浏览器是否支持原生HLS
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.currentTime = startTime;
            video.load();
            video.play().then(() => {
                console.log('视频开始播放。');
            }).catch(error => {
                console.error('播放失败：', error);
            });
        } else if (Hls.isSupported()) {
            // 配置 Hls.js
            const hls = new Hls({
                maxBufferLength: 60, // 最大缓冲长度（秒）
                maxBufferSize: 60 * 1000 * 1000, // 最大缓冲大小（字节）
                maxMaxBufferLength: 120, // 进一步增加最大缓冲长度（秒）
                fragLoadingMaxRetry: 10, // 增加分片加载重试次数
                fragLoadingRetryDelay: 2000, // 增加重试延迟时间（毫秒）
                fragLoadingMaxRetryTimeout: 120000, // 增加最大重试超时时间（毫秒）
                startPosition: startTime, // 从指定时间开始加载
                debug: false // 关闭调试日志，可根据需要打开
            });
            currentHls = hls;
            hls.loadSource(url);
            hls.attachMedia(video);

            // 监听事件
            hls.on(Hls.Events.MANIFEST_LOADING, () => {
                console.log('正在加载清单文件...');
            });
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.currentTime = startTime;
                video.play().then(() => {
                    console.log('视频开始播放。');
                }).catch(error => {
                    console.error('播放失败：', error);
                });
            });
            hls.on(Hls.Events.FRAG_LOADING, () => {
                console.log('正在加载分片...');
            });
            hls.on(Hls.Events.FRAG_LOADED, () => {
                console.log('分片加载完成。');
            });
            hls.on(Hls.Events.BUFFER_STALLED, () => {
                console.warn('缓冲停滞，尝试恢复...');
                hls.startLoad();
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                const { type, details, fatal } = data;
                console.error('Hls.js 错误事件：', event, data);
            
                if (fatal) {
                    switch (type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('网络错误：', details);
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('媒体错误：', details);
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('不可恢复的错误：', details);
                            hls.destroy();
                            break;
                    }
                } else {
                    if (type === Hls.ErrorTypes.BUFFER_STALLED_ERROR || type === Hls.ErrorTypes.FRAG_LOAD_ERROR) {
                        console.warn('缓冲停滞或分片加载错误，尝试恢复...');
                        hls.startLoad();
                    } else {
                        console.warn('非致命错误：', details);
                    }
                }
            });
        } else {
            console.error('当前浏览器不支持HLS播放。');
        }

        // 开始定时保存观看进度（每5秒）
        saveHistoryInterval = setInterval(() => {
            const currentTime = video.currentTime;
            const historyEntry = {
                url,
                episode,
                timestamp: Date.now(),
                currentTime // 保存当前播放时间
            };
            saveHistory(historyEntry);
        }, 5000); // 每5秒

        // 监听视频结束，清除定时器
        video.onended = () => {
            if (saveHistoryInterval) {
                clearInterval(saveHistoryInterval);
                saveHistoryInterval = null;
            }
        };

        // 更新按钮状态
        updateEpisodeButtons();
    };

    // 处理播放按钮点击
    playButton.addEventListener('click', () => {
        const url = m3u8UrlInput.value.trim();
        if (!url) {
            console.error('请输入有效的M3U8 URL。');
            return;
        }
        currentEpisode = '用户输入的视频';
        playVideo(url, currentEpisode);
    });

    // 允许用户按回车键播放
    m3u8UrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            playButton.click();
        }
    });

    // 保存和加载最近使用的URL
    window.addEventListener('load', () => {
        const lastUrl = localStorage.getItem('lastM3u8Url');
        if (lastUrl) {
            m3u8UrlInput.value = lastUrl;
        }

        // 初始化观看历史
        initializeHistory();
    });

    playButton.addEventListener('click', () => {
        const url = m3u8UrlInput.value.trim();
        if (url) {
            localStorage.setItem('lastM3u8Url', url);
        }
    });

    // 清除历史记录按钮事件
    clearHistoryButton.addEventListener('click', () => {
        clearHistory();
    });

    // 初始化剧集列表
    initializeEpisodes();

    // 监听视频的 beforeunload 事件，保存当前播放进度
    window.addEventListener('beforeunload', () => {
        if (currentHls && video.currentTime) {
            const historyEntry = {
                url: m3u8UrlInput.value.trim(),
                episode: currentEpisode,
                timestamp: Date.now(),
                currentTime: video.currentTime // 保存当前播放时间
            };
            saveHistory(historyEntry);
        }
    });

    // 添加事件监听器到按钮
    prevEpisodeButton.addEventListener('click', () => {
        if (currentEpisodeIndex > 0) {
            currentEpisodeIndex -= 1;
            const prevEpisode = episodesArray[currentEpisodeIndex];
            if (prevEpisode) {
                const li = Array.from(episodesList.children).find(li => Number(li.dataset.number) === prevEpisode.number);
                if (li) {
                    li.click();
                }
            }
        } else {
            alert('已经是第一集了。');
        }
    });

    nextEpisodeButton.addEventListener('click', () => {
        if (currentEpisodeIndex < episodesArray.length - 1) {
            currentEpisodeIndex += 1;
            const nextEpisode = episodesArray[currentEpisodeIndex];
            if (nextEpisode) {
                const li = Array.from(episodesList.children).find(li => Number(li.dataset.number) === nextEpisode.number);
                if (li) {
                    li.click();
                }
            }
        } else {
            alert('已经是最后一集了。');
        }
    });

});