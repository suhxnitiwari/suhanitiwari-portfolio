using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Tiwari_Suhani_HW3.Services
{
    public class SpotifyService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private const string ApiUrl = "https://api.spotify.com/v1";

        private readonly ILogger<SpotifyService> _logger;

        public SpotifyService(HttpClient httpClient, IConfiguration configuration, ILogger<SpotifyService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        // Spotify sometimes sends an empty list (e.g. a local file has no album art): these return "" instead of crashing
        private static string FirstName(JsonElement parent, string listName) =>
            parent.TryGetProperty(listName, out var list) && list.ValueKind == JsonValueKind.Array && list.GetArrayLength() > 0
                ? list[0].GetProperty("name").GetString() ?? ""
                : "";

        private static string FirstImageUrl(JsonElement parent) =>
            parent.TryGetProperty("images", out var images) && images.ValueKind == JsonValueKind.Array && images.GetArrayLength() > 0
                ? images[0].GetProperty("url").GetString() ?? ""
                : "";

        private static string SpotifyLink(JsonElement item) =>
            item.TryGetProperty("external_urls", out var urls) && urls.TryGetProperty("spotify", out var link)
                ? link.GetString() ?? ""
                : "";

        // Spotify access tokens last about an hour, so one is shared by every request until
        // just before it expires, instead of asking Spotify for a new one on every call.
        private static string? _cachedAccessToken;
        private static string? _cachedForRefreshToken;
        private static DateTime _cachedTokenExpiresAt = DateTime.MinValue;
        private static readonly SemaphoreSlim TokenLock = new(1, 1);

        public string GetAuthorizationUrl()
        {
            var clientId = _configuration["Spotify:ClientId"] ?? "";
            var redirectUri = _configuration["Spotify:RedirectUri"] ?? "";
            var scopes = "user-read-currently-playing user-read-playback-state user-top-read user-read-recently-played user-read-private";

            var authUrl = "https://accounts.spotify.com/authorize";
            return $"{authUrl}?client_id={clientId}&response_type=code&redirect_uri={Uri.EscapeDataString(redirectUri)}&scope={Uri.EscapeDataString(scopes)}";
        }

        public async Task<(string? accessToken, string? refreshToken)> GetAccessTokenAsync(string code)
        {
            var clientId = _configuration["Spotify:ClientId"] ?? "";
            var clientSecret = _configuration["Spotify:ClientSecret"] ?? "";
            var redirectUri = _configuration["Spotify:RedirectUri"] ?? "";
            var tokenUrl = "https://accounts.spotify.com/api/token";

            var authString = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));

            var request = new HttpRequestMessage(HttpMethod.Post, tokenUrl);
            request.Headers.Add("Authorization", $"Basic {authString}");

            var content = new Dictionary<string, string>
            {
                { "grant_type", "authorization_code" },
                { "code", code },
                { "redirect_uri", redirectUri }
            };

            request.Content = new FormUrlEncodedContent(content);

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var json = JsonSerializer.Deserialize<JsonElement>(responseBody);
                var accessToken = json.GetProperty("access_token").GetString();
                var refreshToken = json.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
                return (accessToken, refreshToken);
            }

            return (null, null);
        }

        public async Task<string?> GetValidAccessTokenAsync(string refreshToken)
        {
            if (HasFreshToken(refreshToken))
            {
                return _cachedAccessToken;
            }

            // Only one request fetches a new token; any others arriving at the same time wait and reuse it
            await TokenLock.WaitAsync();
            try
            {
                if (HasFreshToken(refreshToken))
                {
                    return _cachedAccessToken;
                }

                var (token, lifetimeSeconds) = await RequestNewAccessTokenAsync(refreshToken);
                if (token == null)
                {
                    return null;
                }

                _cachedAccessToken = token;
                _cachedForRefreshToken = refreshToken;
                // renew a minute early so a token never expires in the middle of a page load
                _cachedTokenExpiresAt = DateTime.UtcNow.AddSeconds(lifetimeSeconds - 60);
                _logger.LogInformation("Got a new Spotify access token, reusing it for {Minutes} minutes", (lifetimeSeconds - 60) / 60);
                return token;
            }
            finally
            {
                TokenLock.Release();
            }
        }

        private static bool HasFreshToken(string refreshToken) =>
            _cachedAccessToken != null
            && _cachedForRefreshToken == refreshToken
            && DateTime.UtcNow < _cachedTokenExpiresAt;

        private async Task<(string? Token, int LifetimeSeconds)> RequestNewAccessTokenAsync(string refreshToken)
        {
            var clientId = _configuration["Spotify:ClientId"];
            var clientSecret = _configuration["Spotify:ClientSecret"];
            var tokenUrl = "https://accounts.spotify.com/api/token";

            var authString = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));

            var request = new HttpRequestMessage(HttpMethod.Post, tokenUrl);
            request.Headers.Add("Authorization", $"Basic {authString}");

            var content = new Dictionary<string, string>
            {
                { "grant_type", "refresh_token" },
                { "refresh_token", refreshToken }
            };

            request.Content = new FormUrlEncodedContent(content);

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var json = JsonSerializer.Deserialize<JsonElement>(responseBody);
                var lifetime = json.TryGetProperty("expires_in", out var expires) ? expires.GetInt32() : 3600;
                return (json.GetProperty("access_token").GetString(), lifetime);
            }

            _logger.LogWarning("Spotify token refresh failed: {Status}", (int)response.StatusCode);
            return (null, 0);
        }

        public async Task<List<TopTrack>> GetTopTracksAsync(string accessToken, int limit = 10, string timeRange = "medium_term")
        {
            var tracks = new List<TopTrack>();
            var request = new HttpRequestMessage(HttpMethod.Get, 
                $"{ApiUrl}/me/top/tracks?limit={limit}&time_range={timeRange}");
            request.Headers.Add("Authorization", $"Bearer {accessToken}");

            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync();
                var json = JsonSerializer.Deserialize<JsonElement>(responseBody);

                if (json.TryGetProperty("items", out var items))
                {
                    int position = 1;
                    foreach (var track in items.EnumerateArray())
                    {
                        var hasAlbum = track.TryGetProperty("album", out var album);
                        tracks.Add(new TopTrack
                        {
                            Position = position++,
                            Name = track.GetProperty("name").GetString(),
                            Artist = FirstName(track, "artists"),
                            AlbumArt = hasAlbum ? FirstImageUrl(album) : "",
                            SpotifyUrl = SpotifyLink(track),
                            ReleaseYear = hasAlbum ? ReleaseYear(album) : null,
                            Popularity = track.TryGetProperty("popularity", out var popularity) ? popularity.GetInt32() : 0
                        });
                    }
                }
            }

            return tracks;
        }

        public async Task<List<TopArtist>> GetTopArtistsAsync(string accessToken, int limit = 10, string timeRange = "medium_term")
        {
            var artists = new List<TopArtist>();
            var request = new HttpRequestMessage(HttpMethod.Get, 
                $"{ApiUrl}/me/top/artists?limit={limit}&time_range={timeRange}");
            request.Headers.Add("Authorization", $"Bearer {accessToken}");

            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync();
                var json = JsonSerializer.Deserialize<JsonElement>(responseBody);

                if (json.TryGetProperty("items", out var items))
                {
                    int position = 1;
                    foreach (var artist in items.EnumerateArray())
                    {
                        var imageUrl = FirstImageUrl(artist);

                        var genres = new List<string>();
                        if (artist.TryGetProperty("genres", out var genreArray))
                        {
                            foreach (var genre in genreArray.EnumerateArray())
                            {
                                var genreName = genre.GetString();
                                if (!string.IsNullOrEmpty(genreName))
                                {
                                    genres.Add(genreName);
                                }
                            }
                        }

                        artists.Add(new TopArtist
                        {
                            Position = position++,
                            Name = artist.GetProperty("name").GetString(),
                            Image = imageUrl,
                            SpotifyUrl = SpotifyLink(artist),
                            Genres = genres
                        });
                    }
                }
            }

            return artists;
        }

        // The last few songs I played (Spotify gives up to 50), newest first, for the listening clock
        public async Task<List<RecentPlay>> GetRecentlyPlayedAsync(string accessToken, int limit = 50)
        {
            var plays = new List<RecentPlay>();
            var request = new HttpRequestMessage(HttpMethod.Get, $"{ApiUrl}/me/player/recently-played?limit={limit}");
            request.Headers.Add("Authorization", $"Bearer {accessToken}");
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return plays;

            var json = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
            if (!json.TryGetProperty("items", out var items)) return plays;

            foreach (var item in items.EnumerateArray())
            {
                if (!item.TryGetProperty("track", out var track)) continue;
                plays.Add(new RecentPlay
                {
                    Name = track.GetProperty("name").GetString(),
                    Artist = FirstName(track, "artists"),
                    AlbumArt = track.TryGetProperty("album", out var album) ? FirstImageUrl(album) : "",
                    Album = album.ValueKind == JsonValueKind.Object && album.TryGetProperty("name", out var albumName) ? albumName.GetString() : "",
                    DurationMs = track.TryGetProperty("duration_ms", out var length) ? length.GetInt32() : 0,
                    SpotifyUrl = SpotifyLink(track),
                    PlayedAt = item.TryGetProperty("played_at", out var at) && at.TryGetDateTime(out var when) ? when : null
                });
            }
            return plays;
        }

        // What I'm listening to this very moment, or null when nothing is playing
        // ===== Music Lab: every kind of data Spotify will give me, gathered in one go =====
        // Nothing is charted here; the page builds the charts. Status records what each Spotify call answered
        // (200 = data, 403 = Spotify no longer shares it with apps like mine), so a locked chart can say so.
        public async Task<MusicLab> GetMusicLabAsync(string accessToken)
        {
            var lab = new MusicLab();

            async Task<JsonElement?> Get(string key, string path)
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"{ApiUrl}{path}");
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                var response = await _httpClient.SendAsync(request);
                lab.Status[key] = (int)response.StatusCode;
                if (!response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NoContent) return null;
                var body = await response.Content.ReadAsStringAsync();
                return string.IsNullOrWhiteSpace(body) ? null : JsonSerializer.Deserialize<JsonElement>(body);
            }

            static string Str(JsonElement e, string name) =>
                e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
            static int Int(JsonElement e, string name) =>
                e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;
            static List<string> Names(JsonElement e, string list) =>
                e.TryGetProperty(list, out var arr) && arr.ValueKind == JsonValueKind.Array
                    ? arr.EnumerateArray().Select(a => Str(a, "name")).ToList() : new();

            LabTrack Track(JsonElement t)
            {
                var hasAlbum = t.TryGetProperty("album", out var album) && album.ValueKind == JsonValueKind.Object;
                return new LabTrack
                {
                    Id = Str(t, "id"),
                    Name = Str(t, "name"),
                    Artists = Names(t, "artists"),
                    Album = hasAlbum ? Str(album, "name") : "",
                    AlbumType = hasAlbum ? Str(album, "album_type") : "",
                    AlbumArt = hasAlbum ? FirstImageUrl(album) : "",
                    ReleaseDate = hasAlbum ? Str(album, "release_date") : "",
                    AlbumTracks = hasAlbum ? Int(album, "total_tracks") : 0,
                    TrackNumber = Int(t, "track_number"),
                    DurationMs = Int(t, "duration_ms"),
                    Popularity = Int(t, "popularity"),
                    Explicit = t.TryGetProperty("explicit", out var x) && x.ValueKind == JsonValueKind.True,
                    Url = SpotifyLink(t)
                };
            }

            foreach (var range in new[] { "short_term", "medium_term", "long_term" })
            {
                var tracks = await Get($"top-tracks:{range}", $"/me/top/tracks?limit=50&time_range={range}");
                lab.TopTracks[range] = tracks is { } tj && tj.TryGetProperty("items", out var ti)
                    ? ti.EnumerateArray().Select(Track).ToList() : new();

                var artists = await Get($"top-artists:{range}", $"/me/top/artists?limit=50&time_range={range}");
                lab.TopArtists[range] = artists is { } aj && aj.TryGetProperty("items", out var ai)
                    ? ai.EnumerateArray().Select(a => new LabArtist
                    {
                        Id = Str(a, "id"),
                        Name = Str(a, "name"),
                        Image = FirstImageUrl(a),
                        Popularity = Int(a, "popularity"),
                        Followers = a.TryGetProperty("followers", out var f) ? Int(f, "total") : 0,
                        Genres = a.TryGetProperty("genres", out var g) && g.ValueKind == JsonValueKind.Array
                            ? g.EnumerateArray().Select(x => x.GetString() ?? "").ToList() : new(),
                        Url = SpotifyLink(a)
                    }).ToList() : new();
            }

            var recent = await Get("recently-played", "/me/player/recently-played?limit=50");
            if (recent is { } rj && rj.TryGetProperty("items", out var ri))
            {
                foreach (var item in ri.EnumerateArray())
                {
                    if (!item.TryGetProperty("track", out var t)) continue;
                    lab.Recent.Add(new LabPlay
                    {
                        Track = Track(t),
                        PlayedAt = item.TryGetProperty("played_at", out var at) && at.TryGetDateTime(out var when) ? when : null,
                        Context = item.TryGetProperty("context", out var c) && c.ValueKind == JsonValueKind.Object ? Str(c, "type") : ""
                    });
                }
            }

            if (await Get("me", "/me") is { } me)
            {
                lab.Profile = new LabProfile
                {
                    Country = Str(me, "country"),
                    Plan = Str(me, "product"),
                    Followers = me.TryGetProperty("followers", out var f) ? Int(f, "total") : 0
                };
            }

            if (await Get("player", "/me/player") is { } player)
            {
                var device = player.TryGetProperty("device", out var d) && d.ValueKind == JsonValueKind.Object ? d : default;
                lab.Player = new LabPlayer
                {
                    Device = device.ValueKind == JsonValueKind.Object ? Str(device, "name") : "",
                    DeviceType = device.ValueKind == JsonValueKind.Object ? Str(device, "type") : "",
                    Volume = device.ValueKind == JsonValueKind.Object ? Int(device, "volume_percent") : 0,
                    Shuffle = player.TryGetProperty("shuffle_state", out var sh) && sh.ValueKind == JsonValueKind.True,
                    Repeat = Str(player, "repeat_state"),
                    Playing = player.TryGetProperty("is_playing", out var ip) && ip.ValueKind == JsonValueKind.True,
                    Context = player.TryGetProperty("context", out var pc) && pc.ValueKind == JsonValueKind.Object ? Str(pc, "type") : ""
                };
            }

            // Mood data (energy, happiness, tempo...). Spotify switched this off for newer apps in late 2024; try anyway.
            var ids = lab.TopTracks["medium_term"].Select(t => t.Id).Where(id => id != "").Take(50).ToList();
            if (ids.Count > 0 && await Get("audio-features", $"/audio-features?ids={string.Join(',', ids)}") is { } af
                && af.TryGetProperty("audio_features", out var list))
            {
                foreach (var f in list.EnumerateArray())
                {
                    if (f.ValueKind != JsonValueKind.Object) continue;
                    double D(string name) => f.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : 0;
                    lab.Features.Add(new LabFeatures
                    {
                        Id = Str(f, "id"),
                        Energy = D("energy"), Valence = D("valence"), Danceability = D("danceability"),
                        Acousticness = D("acousticness"), Instrumentalness = D("instrumentalness"),
                        Speechiness = D("speechiness"), Tempo = D("tempo"), Mode = (int)D("mode"), Key = (int)D("key")
                    });
                }
            }

            // Related artists for my #1: also switched off for newer apps; try anyway
            var topArtistId = lab.TopArtists["medium_term"].FirstOrDefault()?.Id;
            if (!string.IsNullOrEmpty(topArtistId)) await Get("related-artists", $"/artists/{topArtistId}/related-artists");

            return lab;
        }

        public async Task<NowPlaying?> GetNowPlayingAsync(string accessToken)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{ApiUrl}/me/player/currently-playing");
            request.Headers.Add("Authorization", $"Bearer {accessToken}");
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NoContent) return null;

            var body = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(body)) return null;

            var json = JsonSerializer.Deserialize<JsonElement>(body);
            if (!json.TryGetProperty("item", out var track) || track.ValueKind != JsonValueKind.Object) return null;
            var isPlaying = json.TryGetProperty("is_playing", out var playing) && playing.GetBoolean();
            if (!isPlaying) return null;

            return new NowPlaying
            {
                Name = track.GetProperty("name").GetString(),
                Artist = FirstName(track, "artists"),
                AlbumArt = track.TryGetProperty("album", out var album) ? FirstImageUrl(album) : "",
                Album = album.ValueKind == JsonValueKind.Object && album.TryGetProperty("name", out var albumName) ? albumName.GetString() : "",
                SpotifyUrl = SpotifyLink(track),
                // the player card ticks the progress bar forward from here, so a cached answer still reads right
                ProgressMs = json.TryGetProperty("progress_ms", out var progress) && progress.ValueKind == JsonValueKind.Number ? progress.GetInt32() : 0,
                DurationMs = track.TryGetProperty("duration_ms", out var length) ? length.GetInt32() : 0,
                FetchedAt = DateTime.UtcNow
            };
        }

        // "2019-06-21", "2019-06" or "2019" -> 2019
        private static int? ReleaseYear(JsonElement album)
        {
            if (!album.TryGetProperty("release_date", out var date)) return null;
            var text = date.GetString();
            return text != null && text.Length >= 4 && int.TryParse(text.AsSpan(0, 4), out var year) ? year : null;
        }

        // Spotify has no "top album" endpoint, so pick the album that shows up most in my
        // top 50 songs (higher-ranked songs count for more), then load that album's tracklist.
        public async Task<TopAlbum?> GetTopAlbumAsync(string accessToken, string timeRange = "medium_term")
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{ApiUrl}/me/top/tracks?limit=50&time_range={timeRange}");
            request.Headers.Add("Authorization", $"Bearer {accessToken}");
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;

            var json = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
            var scores = new Dictionary<string, (int score, int songs, bool isFullAlbum)>();
            var position = 0;

            foreach (var track in json.GetProperty("items").EnumerateArray())
            {
                var album = track.GetProperty("album");
                var id = album.GetProperty("id").GetString();
                if (string.IsNullOrEmpty(id)) continue;

                var current = scores.GetValueOrDefault(id);
                var isFullAlbum = album.TryGetProperty("album_type", out var type) && type.GetString() == "album";
                scores[id] = (current.score + 50 - position, current.songs + 1, isFullAlbum);
                position++;
            }

            // Prefer real albums over singles, so one hit single can't win "top album"
            var best = scores
                .OrderByDescending(pair => pair.Value.isFullAlbum)
                .ThenByDescending(pair => pair.Value.score)
                .FirstOrDefault();
            if (best.Key == null) return null;

            var albumRequest = new HttpRequestMessage(HttpMethod.Get, $"{ApiUrl}/albums/{best.Key}");
            albumRequest.Headers.Add("Authorization", $"Bearer {accessToken}");
            var albumResponse = await _httpClient.SendAsync(albumRequest);
            if (!albumResponse.IsSuccessStatusCode) return null;

            var albumJson = JsonSerializer.Deserialize<JsonElement>(await albumResponse.Content.ReadAsStringAsync());

            return new TopAlbum
            {
                Name = albumJson.GetProperty("name").GetString(),
                Artist = FirstName(albumJson, "artists"),
                AlbumArt = FirstImageUrl(albumJson),
                SpotifyUrl = SpotifyLink(albumJson),
                SongsInMyTop = best.Value.songs,
                Tracks = albumJson.GetProperty("tracks").GetProperty("items").EnumerateArray()
                    .Select(track => track.GetProperty("name").GetString() ?? "")
                    .ToList()
            };
        }

        // Spotify no longer sends genres for artists, so look each top artist up on
        // MusicBrainz (free, no key) and rank genres by how high the artist is in my top list.
        public async Task<List<GenreShare>> GetTopGenresAsync(string accessToken, int limit = 5, string timeRange = "medium_term")
        {
            const int artistCount = 10;
            var artists = await GetTopArtistsAsync(accessToken, artistCount, timeRange);
            var scores = new Dictionary<string, int>();

            foreach (var artist in artists)
            {
                if (string.IsNullOrEmpty(artist.Name)) continue;

                var weight = artistCount + 1 - artist.Position;
                foreach (var genre in await GetArtistGenresAsync(artist.Name))
                {
                    scores[genre] = scores.GetValueOrDefault(genre) + weight;
                }
            }

            // Percent = this genre's share of all the weighted genre tags, so the
            // shown genres plus "other" add up to 100%
            var total = scores.Values.Sum();
            return scores
                .OrderByDescending(pair => pair.Value)
                .Take(limit)
                .Select(pair => new GenreShare { Name = pair.Key, Percent = Math.Round(100.0 * pair.Value / total, 1) })
                .ToList();
        }

        // Genres per artist are cached for the life of the app, since they rarely change
        // and MusicBrainz only allows about one request per second.
        private static readonly Dictionary<string, List<string>> GenreCache = new();
        private static readonly SemaphoreSlim MusicBrainzLock = new(1, 1);
        private static DateTime _lastMusicBrainzCall = DateTime.MinValue;

        private async Task<List<string>> GetArtistGenresAsync(string artistName)
        {
            await MusicBrainzLock.WaitAsync();
            try
            {
                if (GenreCache.TryGetValue(artistName, out var cached))
                {
                    return cached;
                }

                var wait = _lastMusicBrainzCall.AddMilliseconds(1100) - DateTime.UtcNow;
                if (wait > TimeSpan.Zero)
                {
                    await Task.Delay(wait);
                }
                _lastMusicBrainzCall = DateTime.UtcNow;

                var query = Uri.EscapeDataString($"artist:\"{artistName}\"");
                var request = new HttpRequestMessage(HttpMethod.Get,
                    $"https://musicbrainz.org/ws/2/artist/?query={query}&fmt=json&limit=1");
                // MusicBrainz requires a User-Agent that identifies the app
                request.Headers.Add("User-Agent", "SuhaniPersonalSite/1.0 ( http://localhost:5142 )");

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    return new List<string>();
                }

                var json = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
                var genres = new List<string>();

                if (json.TryGetProperty("artists", out var results) && results.GetArrayLength() > 0
                    && results[0].TryGetProperty("tags", out var tags))
                {
                    // Tags are community votes; keep the top 3 that are real genres
                    // (skip ones like "2020s" or "female vocals").
                    genres = tags.EnumerateArray()
                        .Select(tag => (name: tag.GetProperty("name").GetString() ?? "", count: tag.GetProperty("count").GetInt32()))
                        .Where(tag => tag.name != "" && !tag.name.Any(char.IsDigit) && !tag.name.Contains("vocal") && !tag.name.Contains("singer"))
                        .OrderByDescending(tag => tag.count)
                        .Take(3)
                        .Select(tag => tag.name)
                        .ToList();
                }

                GenreCache[artistName] = genres;
                return genres;
            }
            catch (HttpRequestException)
            {
                return new List<string>();
            }
            finally
            {
                MusicBrainzLock.Release();
            }
        }

        // Genres, hometown and (for bands) the year they formed, from MusicBrainz; the first two sentences of
        // the artist's Wikipedia summary as a short "about". Wikipedia and MusicBrainz are both free and need no key.
        public async Task<ArtistInfo> GetArtistInfoAsync(string artistName)
        {
            var info = new ArtistInfo { Genres = await GetArtistGenresAsync(artistName) };

            await MusicBrainzLock.WaitAsync();
            try
            {
                var wait = _lastMusicBrainzCall.AddMilliseconds(1100) - DateTime.UtcNow;
                if (wait > TimeSpan.Zero) await Task.Delay(wait);
                _lastMusicBrainzCall = DateTime.UtcNow;

                var query = Uri.EscapeDataString($"artist:\"{artistName}\"");
                var request = new HttpRequestMessage(HttpMethod.Get, $"https://musicbrainz.org/ws/2/artist/?query={query}&fmt=json&limit=1");
                request.Headers.Add("User-Agent", "SuhaniPersonalSite/1.0 ( https://suhanitiwari.com )");
                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var json = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
                    if (json.TryGetProperty("artists", out var results) && results.GetArrayLength() > 0)
                    {
                        var artist = results[0];
                        string? AreaName(string key) =>
                            artist.TryGetProperty(key, out var area) && area.ValueKind == JsonValueKind.Object && area.TryGetProperty("name", out var n) ? n.GetString() : null;
                        info.From = AreaName("begin-area") ?? AreaName("area");
                        var isGroup = artist.TryGetProperty("type", out var type) && type.GetString() == "Group";
                        if (isGroup && artist.TryGetProperty("life-span", out var span) && span.TryGetProperty("begin", out var begin) && begin.GetString() is { Length: >= 4 } year)
                        {
                            info.Formed = year[..4];
                        }
                    }
                }
            }
            catch (HttpRequestException) { }
            finally
            {
                MusicBrainzLock.Release();
            }

            // Wikipedia: try the plain name, then the usual music disambiguations
            var music = new[] { "singer", "musician", "band", "rapper", "songwriter", "group", "producer", "duo" };
            foreach (var title in new[] { artistName, $"{artistName} (singer)", $"{artistName} (musician)", $"{artistName} (band)", $"{artistName} (rapper)" })
            {
                try
                {
                    var request = new HttpRequestMessage(HttpMethod.Get, $"https://en.wikipedia.org/api/rest_v1/page/summary/{Uri.EscapeDataString(title.Replace(' ', '_'))}");
                    request.Headers.Add("User-Agent", "SuhaniPersonalSite/1.0 ( https://suhanitiwari.com )");
                    var response = await _httpClient.SendAsync(request);
                    if (!response.IsSuccessStatusCode) continue;
                    var json = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
                    if (json.TryGetProperty("type", out var kind) && kind.GetString() == "disambiguation") continue;
                    var description = json.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
                    var extract = json.TryGetProperty("extract", out var e) ? e.GetString() ?? "" : "";
                    if (!music.Any(word => description.Contains(word, StringComparison.OrdinalIgnoreCase) || extract.Contains(word, StringComparison.OrdinalIgnoreCase))) continue;

                    var sentences = System.Text.RegularExpressions.Regex.Split(extract, @"(?<=[.!?])\s+(?=[A-Z])");
                    info.About = string.Join(" ", sentences.Take(2)).Trim();
                    if (json.TryGetProperty("content_urls", out var urls) && urls.TryGetProperty("desktop", out var desk) && desk.TryGetProperty("page", out var page))
                    {
                        info.AboutUrl = page.GetString();
                    }
                    break;
                }
                catch (HttpRequestException) { }
            }

            return info;
        }

    }

    public class TopTrack
    {
        public int Position { get; set; }
        public string? Name { get; set; } = "";
        public string? Artist { get; set; } = "";
        public string? AlbumArt { get; set; } = "";
        public string? SpotifyUrl { get; set; } = "";
        public int? ReleaseYear { get; set; }
        public int Popularity { get; set; }
    }

    public class RecentPlay
    {
        public string? Name { get; set; } = "";
        public string? Artist { get; set; } = "";
        public string? AlbumArt { get; set; } = "";
        public string? SpotifyUrl { get; set; } = "";
        public string? Album { get; set; } = "";
        public int DurationMs { get; set; }
        public DateTime? PlayedAt { get; set; }
    }

    public class MusicLab
    {
        public Dictionary<string, int> Status { get; set; } = new();
        public Dictionary<string, List<LabTrack>> TopTracks { get; set; } = new();
        public Dictionary<string, List<LabArtist>> TopArtists { get; set; } = new();
        public List<LabPlay> Recent { get; set; } = new();
        public LabProfile? Profile { get; set; }
        public LabPlayer? Player { get; set; }
        public List<LabFeatures> Features { get; set; } = new();
    }

    public class LabTrack
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public List<string> Artists { get; set; } = new();
        public string Album { get; set; } = "";
        public string AlbumType { get; set; } = "";
        public string AlbumArt { get; set; } = "";
        public string ReleaseDate { get; set; } = "";
        public int AlbumTracks { get; set; }
        public int TrackNumber { get; set; }
        public int DurationMs { get; set; }
        public int Popularity { get; set; }
        public bool Explicit { get; set; }
        public string Url { get; set; } = "";
    }

    public class LabArtist
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Image { get; set; } = "";
        public int Popularity { get; set; }
        public int Followers { get; set; }
        public List<string> Genres { get; set; } = new();
        public string Url { get; set; } = "";
    }

    public class LabPlay
    {
        public LabTrack Track { get; set; } = new();
        public DateTime? PlayedAt { get; set; }
        public string Context { get; set; } = "";
    }

    public class LabProfile
    {
        public string Country { get; set; } = "";
        public string Plan { get; set; } = "";
        public int Followers { get; set; }
    }

    public class LabPlayer
    {
        public string Device { get; set; } = "";
        public string DeviceType { get; set; } = "";
        public int Volume { get; set; }
        public bool Shuffle { get; set; }
        public string Repeat { get; set; } = "";
        public bool Playing { get; set; }
        public string Context { get; set; } = "";
    }

    public class LabFeatures
    {
        public string Id { get; set; } = "";
        public double Energy { get; set; }
        public double Valence { get; set; }
        public double Danceability { get; set; }
        public double Acousticness { get; set; }
        public double Instrumentalness { get; set; }
        public double Speechiness { get; set; }
        public double Tempo { get; set; }
        public int Mode { get; set; }
        public int Key { get; set; }
    }

    public class NowPlaying
    {
        public string? Name { get; set; } = "";
        public string? Artist { get; set; } = "";
        public string? AlbumArt { get; set; } = "";
        public string? SpotifyUrl { get; set; } = "";
        public string? Album { get; set; } = "";
        public int ProgressMs { get; set; }
        public int DurationMs { get; set; }
        public DateTime FetchedAt { get; set; }
    }

    // More about one artist for the Music Universe card: genres and hometown from MusicBrainz, a short bio from Wikipedia
    public class ArtistInfo
    {
        public List<string> Genres { get; set; } = new();
        public string? From { get; set; }
        public string? Formed { get; set; }
        public string? About { get; set; }
        public string? AboutUrl { get; set; }
    }

    public class TopArtist
    {
        public int Position { get; set; }
        public string? Name { get; set; } = "";
        public string? Image { get; set; } = "";
        public string? SpotifyUrl { get; set; } = "";
        public List<string> Genres { get; set; } = new();
    }

    public class GenreShare
    {
        public string Name { get; set; } = "";
        public double Percent { get; set; }
    }

    public class TopAlbum
    {
        public string? Name { get; set; } = "";
        public string? Artist { get; set; } = "";
        public string? AlbumArt { get; set; } = "";
        public string? SpotifyUrl { get; set; } = "";
        public int SongsInMyTop { get; set; }
        public List<string> Tracks { get; set; } = new();
    }
}
