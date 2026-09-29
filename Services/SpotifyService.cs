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
                    SpotifyUrl = SpotifyLink(track),
                    PlayedAt = item.TryGetProperty("played_at", out var at) && at.TryGetDateTime(out var when) ? when : null
                });
            }
            return plays;
        }

        // What I'm listening to this very moment, or null when nothing is playing
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
                SpotifyUrl = SpotifyLink(track)
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
        public DateTime? PlayedAt { get; set; }
    }

    public class NowPlaying
    {
        public string? Name { get; set; } = "";
        public string? Artist { get; set; } = "";
        public string? AlbumArt { get; set; } = "";
        public string? SpotifyUrl { get; set; } = "";
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
