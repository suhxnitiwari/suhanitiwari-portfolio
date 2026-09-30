using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Tiwari_Suhani_HW3.Services;

namespace Tiwari_Suhani_HW3.Controllers
{
    public class SpotifyController : Controller
    {
        private readonly SpotifyService _spotifyService;
        private readonly IConfiguration _configuration;
        private readonly IMemoryCache _cache;
        private readonly IWebHostEnvironment _environment;
        private readonly string _tokenFilePath = "spotify-token.json";

        // My top artists/songs/genres change slowly, so each result is kept for 12 hours:
        // every visitor in that window gets the saved copy, and only the first visit after it
        // expires asks Spotify again. Change this number to refresh more or less often.
        private static readonly TimeSpan SpotifyDataLifetime = TimeSpan.FromHours(12);

        public SpotifyController(SpotifyService spotifyService, IConfiguration configuration, IMemoryCache cache, IWebHostEnvironment environment)
        {
            _spotifyService = spotifyService;
            _configuration = configuration;
            _cache = cache;
            _environment = environment;
        }

        // Connecting a Spotify account replaces whose music the site shows, so on the live site it's
        // switched off: only works on my laptop, or live if I set Spotify__AllowConnect=true for a moment.
        // Only the values Spotify actually accepts, so nobody can fill the cache with made-up requests
        private static readonly string[] TimeRanges = { "short_term", "medium_term", "long_term" };
        private static string SafeRange(string timeRange) => TimeRanges.Contains(timeRange) ? timeRange : "medium_term";
        private static int SafeLimit(int limit) => Math.Clamp(limit, 1, 50);

        private bool CanConnect() =>
            _environment.IsDevelopment() || _configuration.GetValue<bool>("Spotify:AllowConnect");

        // Return the saved copy if there is one; otherwise ask Spotify and save the answer.
        // Empty or failed results aren't saved, so a hiccup doesn't stick around for 12 hours.
        private async Task<IActionResult> CachedSpotifyJson<T>(string key, Func<string, Task<T?>> load, TimeSpan? lifetime = null)
        {
            if (_cache.TryGetValue(key, out T? saved) && saved != null)
            {
                return Json(saved);
            }

            var accessToken = await GetFreshAccessTokenAsync();
            if (string.IsNullOrEmpty(accessToken))
            {
                return Unauthorized();
            }

            var data = await load(accessToken);
            if (data != null && !(data is System.Collections.ICollection { Count: 0 }))
            {
                _cache.Set(key, data, lifetime ?? SpotifyDataLifetime);
            }
            return Json(data);
        }

        private async Task<string?> GetFreshAccessTokenAsync()
        {
            var refreshToken = _configuration["Spotify:RefreshToken"];

            if (System.IO.File.Exists(_tokenFilePath))
            {
                var json = await System.IO.File.ReadAllTextAsync(_tokenFilePath);
                var tokenData = JsonSerializer.Deserialize<JsonElement>(json);
                if (tokenData.TryGetProperty("refresh_token", out var rt))
                {
                    refreshToken = rt.GetString();
                }
            }

            if (string.IsNullOrEmpty(refreshToken))
            {
                return null;
            }

            return await _spotifyService.GetValidAccessTokenAsync(refreshToken);
        }

        public IActionResult Login()
        {
            if (!CanConnect())
            {
                return NotFound();
            }

            var authUrl = _spotifyService.GetAuthorizationUrl();
            return Redirect(authUrl);
        }

        // Must match the Redirect URI registered in the Spotify developer dashboard
        [Route("home/spotify-callback")]
        public async Task<IActionResult> Callback(string code, string error)
        {
            if (!CanConnect())
            {
                return NotFound();
            }

            if (error != null)
            {
                return BadRequest("Authorization failed");
            }

            var (accessToken, refreshToken) = await _spotifyService.GetAccessTokenAsync(code);
            if (accessToken != null && refreshToken != null)
            {
                // Save refresh token to file for permanent storage
                var tokenData = new { refresh_token = refreshToken, access_token = accessToken };
                var json = JsonSerializer.Serialize(tokenData);
                await System.IO.File.WriteAllTextAsync(_tokenFilePath, json);

                return RedirectToAction("Index", "Home");
            }

            return BadRequest("Failed to get access token");
        }

        [HttpGet]
        public async Task<IActionResult> GetTopTracks(int limit = 10, string timeRange = "medium_term")
        {
            limit = SafeLimit(limit); timeRange = SafeRange(timeRange);
            return await CachedSpotifyJson($"top-tracks:{limit}:{timeRange}", async token => await _spotifyService.GetTopTracksAsync(token, limit, timeRange));
        }

        [HttpGet]
        public async Task<IActionResult> GetTopArtists(int limit = 10, string timeRange = "medium_term")
        {
            limit = SafeLimit(limit); timeRange = SafeRange(timeRange);
            return await CachedSpotifyJson($"top-artists:{limit}:{timeRange}", async token => await _spotifyService.GetTopArtistsAsync(token, limit, timeRange));
        }

        // An artist's five most popular songs, found through Spotify search (ids are 22 letters and numbers)
        [HttpGet]
        public async Task<IActionResult> GetArtistTopTracks(string id, string name)
        {
            if (string.IsNullOrEmpty(id) || id.Length > 40 || !id.All(char.IsLetterOrDigit)) return BadRequest();
            if (string.IsNullOrWhiteSpace(name) || name.Length > 100) return BadRequest();
            return await CachedSpotifyJson($"artist-top-tracks:{id}", async token => await _spotifyService.GetArtistTopTracksAsync(token, id, name), TimeSpan.FromHours(12));
        }

        [HttpGet]
        public async Task<IActionResult> GetTopGenres(int limit = 5, string timeRange = "medium_term")
        {
            limit = SafeLimit(limit); timeRange = SafeRange(timeRange);
            return await CachedSpotifyJson($"top-genres:{limit}:{timeRange}", async token => await _spotifyService.GetTopGenresAsync(token, limit, timeRange));
        }

        // My last 50 plays, for the listening clock. Kept for 10 minutes.
        [HttpGet]
        public async Task<IActionResult> GetRecentlyPlayed()
        {
            return await CachedSpotifyJson("recently-played", async token => await _spotifyService.GetRecentlyPlayedAsync(token), TimeSpan.FromMinutes(10));
        }

        // What I'm listening to right now (null when nothing is playing). Kept for 30 seconds.
        [HttpGet]
        public async Task<IActionResult> GetNowPlaying()
        {
            return await CachedSpotifyJson("now-playing", async token => await _spotifyService.GetNowPlayingAsync(token), TimeSpan.FromSeconds(30));
        }

        // More about one artist in my Music Universe (no Spotify login needed). Kept for a week.
        [HttpGet]
        public async Task<IActionResult> GetArtistInfo(string name)
        {
            if (string.IsNullOrWhiteSpace(name) || name.Length > 100) return BadRequest();
            var info = await _cache.GetOrCreateAsync($"artist-info:{name.ToLowerInvariant()}", entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7);
                return _spotifyService.GetArtistInfoAsync(name);
            });
            return Json(info);
        }

        // Music Lab: everything Spotify will share, for the page to chart. Kept for an hour.
        [HttpGet]
        public async Task<IActionResult> GetMusicLab()
        {
            return await CachedSpotifyJson("music-lab", async token => await _spotifyService.GetMusicLabAsync(token), TimeSpan.FromHours(1));
        }

        [HttpGet]
        public async Task<IActionResult> GetTopAlbum(string timeRange = "medium_term")
        {
            timeRange = SafeRange(timeRange);
            return await CachedSpotifyJson($"top-album:{timeRange}", async token => await _spotifyService.GetTopAlbumAsync(token, timeRange));
        }
    }
}
