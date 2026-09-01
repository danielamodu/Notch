using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Windows.Media.Control;
using Windows.Storage.Streams;

namespace WinRTMediaBridge
{
    public class MediaUpdateDto
    {
        public string title { get; set; } = "No media playing";
        public string artist { get; set; } = "Spotify / Windows Media";
        public string album { get; set; } = "";
        public string appId { get; set; } = "";
        public bool isPlaying { get; set; } = false;
        public double position { get; set; } = 0;
        public double duration { get; set; } = 0;
        public string thumbnail { get; set; } = "";
        public bool hasActiveMedia { get; set; } = false;
    }

    public class CommandDto
    {
        public string action { get; set; } = "";
    }

    class Program
    {
        private static GlobalSystemMediaTransportControlsSessionManager? _manager;
        private static GlobalSystemMediaTransportControlsSession? _currentSession;
        private static readonly object _lock = new();

        private static MediaUpdateDto _currentDto = new()
        {
            title = "No media playing",
            artist = "Spotify / Windows Media",
            album = "",
            appId = "",
            isPlaying = false,
            position = 0,
            duration = 0,
            thumbnail = "",
            hasActiveMedia = false
        };

        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            try
            {
                _manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                if (_manager != null)
                {
                    _manager.CurrentSessionChanged += Manager_CurrentSessionChanged;
                    AttachToSession(_manager.GetCurrentSession());
                }
            }
            catch (Exception ex)
            {
                EmitJson(_currentDto);
            }

            // Start stdin command reader loop
            _ = Task.Run(CommandReaderLoop);

            // Initial immediate metadata fetch
            _ = UpdateFullMetadataAsync();

            // Keep process alive indefinitely
            await Task.Delay(Timeout.Infinite);
        }

        private static void Manager_CurrentSessionChanged(GlobalSystemMediaTransportControlsSessionManager sender, CurrentSessionChangedEventArgs args)
        {
            AttachToSession(sender.GetCurrentSession());
            _ = UpdateFullMetadataAsync();
        }

        private static void AttachToSession(GlobalSystemMediaTransportControlsSession? session)
        {
            lock (_lock)
            {
                if (_currentSession != null)
                {
                    try
                    {
                        _currentSession.PlaybackInfoChanged -= Session_PlaybackInfoChanged;
                        _currentSession.MediaPropertiesChanged -= Session_MediaPropertiesChanged;
                        _currentSession.TimelinePropertiesChanged -= Session_TimelinePropertiesChanged;
                    }
                    catch { }
                }

                _currentSession = session;

                if (_currentSession != null)
                {
                    try
                    {
                        _currentSession.PlaybackInfoChanged += Session_PlaybackInfoChanged;
                        _currentSession.MediaPropertiesChanged += Session_MediaPropertiesChanged;
                        _currentSession.TimelinePropertiesChanged += Session_TimelinePropertiesChanged;
                    }
                    catch { }
                }
            }
        }

        // ── 1. Instant Synchronous Playback Changes (0ms Lag) ────────────────────────
        private static void Session_PlaybackInfoChanged(GlobalSystemMediaTransportControlsSession sender, PlaybackInfoChangedEventArgs args)
        {
            try
            {
                var playbackInfo = sender.GetPlaybackInfo();
                if (playbackInfo != null)
                {
                    bool isPlaying = playbackInfo.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
                    lock (_lock)
                    {
                        _currentDto.isPlaying = isPlaying;
                        _currentDto.hasActiveMedia = !string.IsNullOrWhiteSpace(_currentDto.title) && _currentDto.title != "No media playing";
                    }
                    EmitJson(_currentDto);
                }
            }
            catch { }
        }

        // ── 2. Instant Media Properties Changes (Track / Artist / Album) ─────────────
        private static void Session_MediaPropertiesChanged(GlobalSystemMediaTransportControlsSession sender, MediaPropertiesChangedEventArgs args)
        {
            _ = UpdateFullMetadataAsync();
        }

        private static void Session_TimelinePropertiesChanged(GlobalSystemMediaTransportControlsSession sender, TimelinePropertiesChangedEventArgs args)
        {
            try
            {
                var timeline = sender.GetTimelineProperties();
                if (timeline != null)
                {
                    lock (_lock)
                    {
                        _currentDto.position = Math.Max(0, timeline.Position.TotalSeconds);
                        _currentDto.duration = Math.Max(0, timeline.EndTime.TotalSeconds);
                    }
                    EmitJson(_currentDto);
                }
            }
            catch { }
        }

        private static async Task UpdateFullMetadataAsync()
        {
            try
            {
                GlobalSystemMediaTransportControlsSession? session;
                lock (_lock)
                {
                    session = _currentSession ?? _manager?.GetCurrentSession();
                }

                if (session == null)
                {
                    lock (_lock)
                    {
                        _currentDto = new MediaUpdateDto
                        {
                            title = "No media playing",
                            artist = "Spotify / Windows Media",
                            album = "",
                            appId = "",
                            isPlaying = false,
                            position = 0,
                            duration = 0,
                            thumbnail = "",
                            hasActiveMedia = false
                        };
                    }
                    EmitJson(_currentDto);
                    return;
                }

                var playbackInfo = session.GetPlaybackInfo();
                var timeline = session.GetTimelineProperties();
                var mediaProps = await session.TryGetMediaPropertiesAsync();

                if (mediaProps == null || string.IsNullOrWhiteSpace(mediaProps.Title))
                {
                    lock (_lock)
                    {
                        _currentDto.hasActiveMedia = false;
                        _currentDto.isPlaying = false;
                    }
                    EmitJson(_currentDto);
                    return;
                }

                bool isPlaying = playbackInfo?.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
                string appId = session.SourceAppUserModelId ?? "";

                lock (_lock)
                {
                    _currentDto.title = mediaProps.Title ?? "";
                    _currentDto.artist = mediaProps.Artist ?? "";
                    _currentDto.album = mediaProps.AlbumTitle ?? "";
                    _currentDto.appId = appId;
                    _currentDto.isPlaying = isPlaying;
                    _currentDto.position = Math.Max(0, timeline?.Position.TotalSeconds ?? 0);
                    _currentDto.duration = Math.Max(0, timeline?.EndTime.TotalSeconds ?? 0);
                    _currentDto.hasActiveMedia = true;
                }

                // Emit title/artist/appId immediately without waiting for thumbnail
                EmitJson(_currentDto);

                // Fetch thumbnail in background with 350ms cancellation timeout to prevent COM apartment deadlocks
                if (mediaProps.Thumbnail != null)
                {
                    _ = FetchThumbnailAsync(mediaProps.Thumbnail);
                }
            }
            catch
            {
                EmitJson(_currentDto);
            }
        }

        private static async Task FetchThumbnailAsync(IRandomAccessStreamReference thumbnailRef)
        {
            try
            {
                using var cts = new CancellationTokenSource(350);
                var streamTask = thumbnailRef.OpenReadAsync().AsTask(cts.Token);
                using var stream = await streamTask;
                using var memStream = new MemoryStream();
                using var netStream = stream.AsStreamForRead();
                await netStream.CopyToAsync(memStream, cts.Token);

                string base64 = "data:image/jpeg;base64," + Convert.ToBase64String(memStream.ToArray());
                lock (_lock)
                {
                    _currentDto.thumbnail = base64;
                }
                EmitJson(_currentDto);
            }
            catch { }
        }

        private static void EmitJson(MediaUpdateDto dto)
        {
            try
            {
                string json;
                lock (_lock)
                {
                    json = JsonSerializer.Serialize(dto);
                }
                Console.WriteLine(json);
            }
            catch { }
        }

        private static async Task CommandReaderLoop()
        {
            while (true)
            {
                try
                {
                    var line = await Console.In.ReadLineAsync();
                    if (string.IsNullOrWhiteSpace(line)) continue;

                    var cmd = JsonSerializer.Deserialize<CommandDto>(line);
                    if (cmd == null || string.IsNullOrWhiteSpace(cmd.action)) continue;

                    GlobalSystemMediaTransportControlsSession? session;
                    lock (_lock)
                    {
                        session = _currentSession ?? _manager?.GetCurrentSession();
                    }

                    if (session == null) continue;

                    string act = cmd.action.ToLowerInvariant();

                    // Optimistically flip local state & emit instantly
                    if (act == "toggle")
                    {
                        lock (_lock) { _currentDto.isPlaying = !_currentDto.isPlaying; }
                        EmitJson(_currentDto);
                        await session.TryTogglePlayPauseAsync();
                    }
                    else if (act == "play")
                    {
                        lock (_lock) { _currentDto.isPlaying = true; }
                        EmitJson(_currentDto);
                        await session.TryPlayAsync();
                    }
                    else if (act == "pause")
                    {
                        lock (_lock) { _currentDto.isPlaying = false; }
                        EmitJson(_currentDto);
                        await session.TryPauseAsync();
                    }
                    else if (act == "next")
                    {
                        await session.TrySkipNextAsync();
                    }
                    else if (act == "previous")
                    {
                        await session.TrySkipPreviousAsync();
                    }
                }
                catch { }
            }
        }
    }
}
